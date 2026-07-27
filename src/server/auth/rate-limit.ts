import Redis from 'ioredis';
import { getEnv } from '@/lib/env';

/**
 * Ограничение частоты запросов — docs/04-api-contract.md, раздел 7.
 *
 * Счётчики живут в Redis: они должны переживать перезапуск приложения,
 * иначе лимит обходится рестартом.
 */

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(getEnv().REDIS_URL, { maxRetriesPerRequest: 3 });
  }
  return redis;
}

export type RateLimitResult = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
};

export const RATE_LIMITS = {
  /** Запрос OTP: 3 за 15 минут на адрес и на IP (T3) */
  authChallenge: { limit: 3, windowSeconds: 15 * 60 },
  /** Попытки входа: 5 за 15 минут на IP */
  authVerify: { limit: 5, windowSeconds: 15 * 60 },
  publicCatalog: { limit: 60, windowSeconds: 60 },
  clientApi: { limit: 120, windowSeconds: 60 },
  import: { limit: 10, windowSeconds: 60 * 60 },
} as const;

export async function checkRateLimit(
  bucket: keyof typeof RATE_LIMITS,
  identifier: string,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[bucket];
  const key = `rl:${bucket}:${identifier}`;

  const client = getRedis();
  const count = await client.incr(key);

  if (count === 1) {
    await client.expire(key, windowSeconds);
  }

  const ttl = await client.ttl(key);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

/** Сброс счётчика после успешного входа — чтобы не наказывать за прошлые попытки */
export async function resetRateLimit(
  bucket: keyof typeof RATE_LIMITS,
  identifier: string,
): Promise<void> {
  await getRedis().del(`rl:${bucket}:${identifier}`);
}
