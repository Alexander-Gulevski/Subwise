import { z } from 'zod';
import { db } from '@/server/db';
import {
  generateOtpCode,
  hashOtp,
  safeEqual,
} from '@/server/auth/crypto';
import { checkRateLimit } from '@/server/auth/rate-limit';
import type {
  AuthChallengeResult,
  AuthProvider,
  AuthVerifyResult,
} from '@/ports/AuthProvider';
import { sendOtpEmail } from './mailer';

/**
 * Вход по одноразовому коду на email — ADR-0003.
 *
 * Паролей в системе нет. Параметры кода (docs/06, T3):
 *   • 6 цифр, crypto.randomInt — не Math.random
 *   • живёт 10 минут, одноразовый
 *   • не более 5 попыток ввода
 *   • не более 3 запросов за 15 минут на адрес и на IP
 *   • в БД хранится хеш кода
 *
 * ВАЖНО: ответ на запрос кода одинаков независимо от того, существует
 * ли аккаунт. Иначе эндпоинт превращается в проверку существования
 * email (угроза T10).
 */

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export class EmailOtpAuthProvider implements AuthProvider {
  readonly id = 'email_otp' as const;

  async challenge(
    identifier: string,
    meta: { ip: string },
  ): Promise<AuthChallengeResult> {
    const email = normalizeEmail(identifier);

    const byEmail = await checkRateLimit('authChallenge', `email:${email}`);
    const byIp = await checkRateLimit('authChallenge', `ip:${meta.ip}`);

    if (!byEmail.allowed || !byIp.allowed) {
      return {
        status: 'rate_limited',
        retryAfterSeconds: Math.max(
          byEmail.retryAfterSeconds,
          byIp.retryAfterSeconds,
        ),
      };
    }

    const code = generateOtpCode();

    await db.emailOtp.create({
      data: {
        email,
        codeHash: hashOtp(code, email),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    // Код уходит только в письмо. Логировать его запрещено (T11).
    await sendOtpEmail(email, code);

    return { status: 'sent' };
  }

  async verify(payload: unknown, meta: { ip: string }): Promise<AuthVerifyResult> {
    const parsed = verifySchema.safeParse(payload);
    if (!parsed.success) return { status: 'invalid' };

    const email = normalizeEmail(parsed.data.email);

    const byIp = await checkRateLimit('authVerify', `ip:${meta.ip}`);
    if (!byIp.allowed) return { status: 'too_many_attempts' };

    const otp = await db.emailOtp.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) return { status: 'invalid' };

    if (otp.attempts >= MAX_ATTEMPTS) return { status: 'too_many_attempts' };

    if (otp.expiresAt.getTime() <= Date.now()) return { status: 'expired' };

    const expected = hashOtp(parsed.data.code, email);

    if (!safeEqual(otp.codeHash, expected)) {
      await db.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      return { status: 'invalid' };
    }

    // Код одноразовый: гасим его и все остальные активные для этого адреса
    await db.emailOtp.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });

    return {
      status: 'verified',
      identity: {
        provider: 'email_otp',
        externalId: email,
        email,
        verifiedAt: new Date(),
      },
    };
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
