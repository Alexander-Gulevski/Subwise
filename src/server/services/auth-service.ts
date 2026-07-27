import { db } from '@/server/db';
import { createSession } from '@/server/auth/session';
import type { VerifiedIdentity } from '@/ports/AuthProvider';

/**
 * Связывание подтверждённой личности с аккаунтом — ADR-0003.
 *
 * Один User может иметь несколько AuthIdentity: это позволяет войти
 * через Telegram и через email в один и тот же аккаунт.
 *
 * Объединение выполняется ТОЛЬКО когда оба идентификатора подтверждены.
 * Иначе достаточно было бы заявить чужой email, чтобы попасть в его аккаунт.
 */

export async function signInWithIdentity(
  identity: VerifiedIdentity,
  meta: { userAgent?: string } = {},
): Promise<{ userId: string; isNewUser: boolean }> {
  const existing = await db.authIdentity.findUnique({
    where: {
      provider_externalId: {
        provider: identity.provider,
        externalId: identity.externalId,
      },
    },
    select: { userId: true },
  });

  if (existing) {
    await createSession(existing.userId, meta.userAgent);
    return { userId: existing.userId, isNewUser: false };
  }

  // Провайдер сообщил подтверждённый email — ищем аккаунт с тем же
  // подтверждённым адресом, чтобы не плодить дубли.
  const linkedUserId = identity.email
    ? await findUserByVerifiedEmail(identity.email)
    : null;

  if (linkedUserId) {
    await db.authIdentity.create({
      data: {
        userId: linkedUserId,
        provider: identity.provider,
        externalId: identity.externalId,
        verifiedAt: identity.verifiedAt,
      },
    });
    await createSession(linkedUserId, meta.userAgent);
    return { userId: linkedUserId, isNewUser: false };
  }

  const user = await db.user.create({
    data: {
      plan: 'free',
      identities: {
        create: {
          provider: identity.provider,
          externalId: identity.externalId,
          verifiedAt: identity.verifiedAt,
        },
      },
      settings: { create: {} },
      // Дефолтное правило: одно напоминание за 3 дня (FR-06).
      // Больше — только по явному выбору пользователя.
      reminderRules: {
        create: [
          {
            type: 'upcoming_charge',
            offsetDays: 3,
            channels: ['inapp'],
          },
          {
            type: 'trial_ending',
            offsetDays: 3,
            channels: ['inapp'],
          },
          {
            type: 'trial_ending',
            offsetDays: 1,
            channels: ['inapp'],
          },
        ],
      },
    },
    select: { id: true },
  });

  await createSession(user.id, meta.userAgent);
  return { userId: user.id, isNewUser: true };
}

async function findUserByVerifiedEmail(email: string): Promise<string | null> {
  const identity = await db.authIdentity.findFirst({
    where: {
      provider: 'email_otp',
      externalId: email,
      verifiedAt: { not: null },
      user: { deletedAt: null },
    },
    select: { userId: true },
  });

  return identity?.userId ?? null;
}
