import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import type {
  AuthChallengeResult,
  AuthProvider,
  AuthVerifyResult,
} from '@/ports/AuthProvider';

/**
 * Вход через Telegram Login Widget — ADR-0003.
 *
 * КРИТИЧНО: без проверки HMAC-подписи вход подделывается тривиально —
 * достаточно отправить произвольный telegram id (угроза T2).
 *
 * Алгоритм Telegram:
 *   secret     = SHA256(bot_token)
 *   check_str  = отсортированные "key=value", склеенные через \n, без hash
 *   signature  = HMAC_SHA256(check_str, secret)
 *   валидно, если signature === переданный hash
 */

/** Данные старше этого срока отклоняются — защита от повторного использования */
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

const telegramPayloadSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.union([z.number(), z.string()]).transform(Number),
  hash: z.string(),
});

export type TelegramPayload = z.infer<typeof telegramPayloadSchema>;

export class TelegramAuthProvider implements AuthProvider {
  readonly id = 'telegram' as const;

  /**
   * У Telegram нет этапа запроса — виджет сразу возвращает подписанные
   * данные. Параметры принимаются, чтобы сигнатура совпадала с портом
   * AuthProvider и провайдеры были взаимозаменяемы.
   */
  async challenge(
    _identifier: string,
    _meta: { ip: string },
  ): Promise<AuthChallengeResult> {
    return { status: 'sent' };
  }

  async verify(
    payload: unknown,
    _meta: { ip: string },
  ): Promise<AuthVerifyResult> {
    const parsed = telegramPayloadSchema.safeParse(payload);
    if (!parsed.success) return { status: 'invalid' };

    const data = parsed.data;

    if (!verifyTelegramSignature(data)) return { status: 'invalid' };

    const ageSeconds = Math.floor(Date.now() / 1000) - data.auth_date;
    if (ageSeconds > MAX_AUTH_AGE_SECONDS || ageSeconds < -60) {
      return { status: 'expired' };
    }

    return {
      status: 'verified',
      identity: {
        provider: 'telegram',
        externalId: data.id,
        email: null,
        verifiedAt: new Date(),
      },
    };
  }
}

export function verifyTelegramSignature(payload: TelegramPayload): boolean {
  const botToken = getEnv().TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN не задан — вход через Telegram невозможен');
  }

  const { hash, ...fields } = payload;

  const checkString = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join('\n');

  const secretKey = createHash('sha256').update(botToken).digest();
  const signature = createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(hash, 'utf8');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
