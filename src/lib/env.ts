import { z } from 'zod';

/**
 * Валидация переменных окружения при старте.
 *
 * Приложение падает сразу, если конфигурация неполна — это лучше,
 * чем упасть через час на первой отправке письма.
 *
 * Секреты читаются ТОЛЬКО отсюда и только на сервере
 * (docs/06-security-privacy.md, T5).
 */

const hex32 = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, 'ожидается 32 байта в hex (64 символа)');

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  ENCRYPTION_KEY: hex32,
  SESSION_SECRET: hex32,

  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_BOT_USERNAME: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),

  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  CRON_SECRET: z.string().min(16).optional(),

  CBR_RATES_URL: z.string().url().default('https://www.cbr-xml-daily.ru/daily_json.js'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // Печатаем только ИМЕНА переменных и причины — никогда значения.
    throw new Error(`Некорректная конфигурация окружения:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
