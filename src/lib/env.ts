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

/**
 * Необязательная переменная.
 *
 * Пустая строка приводится к undefined: в .env необязательные переменные
 * принято оставлять как `KEY=` (см. .env.example), и без этого приведения
 * Zod считает их заданными и валит проверку `.min()`.
 */
function optionalString(minLength = 1) {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(minLength).optional(),
  );
}

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  ENCRYPTION_KEY: hex32,
  SESSION_SECRET: hex32,

  TELEGRAM_BOT_TOKEN: optionalString(),
  TELEGRAM_BOT_USERNAME: optionalString(),
  TELEGRAM_WEBHOOK_SECRET: optionalString(16),

  SMTP_HOST: optionalString(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString(),
  SMTP_PASSWORD: optionalString(),
  SMTP_FROM: optionalString(),

  CRON_SECRET: optionalString(16),

  CBR_RATES_URL: z
    .string()
    .url()
    .default('https://www.cbr-xml-daily.ru/daily_json.js'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/** Разбор произвольного источника. Вынесен отдельно, чтобы тестировать без process.env. */
export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = serverSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // Печатаем только ИМЕНА переменных и причины — никогда значения.
    throw new Error(`Некорректная конфигурация окружения:\n${issues}`);
  }

  return parsed.data;
}

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
