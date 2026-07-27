import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { generateSessionToken, hashToken } from '@/lib/crypto';

/**
 * Сессии — ADR-0003.
 *
 *   • токен отдаётся в cookie httpOnly + Secure + SameSite=Lax
 *   • в БД лежит SHA-256 хеш токена, не сам токен (T7)
 *   • срок 30 дней со скользящим продлением
 */

export const SESSION_COOKIE = 'subwise_session';
const SESSION_DAYS = 30;
/** Продлеваем не чаще раза в сутки, чтобы не писать в БД на каждый запрос */
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export type SessionUser = {
  readonly id: string;
  readonly plan: 'free' | 'pro';
};

export async function createSession(
  userId: string,
  userAgent?: string,
): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: userAgent ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** Текущий пользователь или null. Не бросает — для необязательной авторизации. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, plan: true, deletedAt: true } } },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Аккаунт помечен на удаление — доступ прекращается сразу
  if (session.user.deletedAt) return null;

  if (Date.now() - session.lastSeenAt.getTime() > REFRESH_THRESHOLD_MS) {
    await db.session.update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }

  return { id: session.user.id, plan: session.user.plan };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** «Выйти на всех устройствах» — FR-09 */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
