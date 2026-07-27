import { z } from 'zod';
import { generateOtpCode, hashOtp, safeEqual } from '@/lib/crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import type {
  AuthChallengeResult,
  AuthProvider,
  AuthVerifyResult,
} from '@/ports/AuthProvider';
import type { OtpMailer, OtpStore } from '@/ports/OtpStore';

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
 *
 * Хранилище и отправка писем приходят через порты: адаптер не вправе
 * обращаться к БД напрямую и должен тестироваться без SMTP.
 */

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export class EmailOtpAuthProvider implements AuthProvider {
  readonly id = 'email_otp' as const;

  constructor(
    private readonly store: OtpStore,
    private readonly mailer: OtpMailer,
  ) {}

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

    await this.store.issue(
      email,
      hashOtp(code, email),
      new Date(Date.now() + OTP_TTL_MS),
    );

    // Код уходит только в письмо. Логировать его запрещено (T11).
    await this.mailer.send(email, code);

    return { status: 'sent' };
  }

  async verify(payload: unknown, meta: { ip: string }): Promise<AuthVerifyResult> {
    const parsed = verifySchema.safeParse(payload);
    if (!parsed.success) return { status: 'invalid' };

    const email = normalizeEmail(parsed.data.email);

    const byIp = await checkRateLimit('authVerify', `ip:${meta.ip}`);
    if (!byIp.allowed) return { status: 'too_many_attempts' };

    const otp = await this.store.findLatestActive(email);
    if (!otp) return { status: 'invalid' };

    if (otp.attempts >= MAX_ATTEMPTS) return { status: 'too_many_attempts' };
    if (otp.expiresAt.getTime() <= Date.now()) return { status: 'expired' };

    if (!safeEqual(otp.codeHash, hashOtp(parsed.data.code, email))) {
      await this.store.incrementAttempts(otp.id);
      return { status: 'invalid' };
    }

    await this.store.consumeAll(email);

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
