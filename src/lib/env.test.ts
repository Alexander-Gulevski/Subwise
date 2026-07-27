import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

/**
 * Регрессия: пустые плейсхолдеры в .env роняли приложение.
 *
 * В .env.example необязательные переменные записаны как `KEY=`.
 * Zod-модификатор .optional() пропускает только undefined, поэтому
 * пустая строка считалась заданным значением и валила .min().
 * Симптом: 500 на POST /api/auth/email/request при полностью
 * корректном локальном окружении.
 */

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

const minimal = {
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  ENCRYPTION_KEY: KEY_A,
  SESSION_SECRET: KEY_B,
};

describe('обязательные переменные', () => {
  it('минимального набора достаточно', () => {
    const env = parseEnv(minimal);
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.NODE_ENV).toBe('development');
    expect(env.SMTP_PORT).toBe(587);
  });

  it('отсутствие обязательной переменной — ошибка с её именем', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = minimal;
    expect(() => parseEnv(withoutDb)).toThrow(/DATABASE_URL/);
  });

  it('ключ шифрования неверной длины отклоняется', () => {
    expect(() => parseEnv({ ...minimal, ENCRYPTION_KEY: 'слишком короткий' })).toThrow(
      /ENCRYPTION_KEY/,
    );
  });

  it('текст ошибки не содержит значений переменных', () => {
    try {
      parseEnv({ ...minimal, ENCRYPTION_KEY: 'секретное-значение-которое-не-должно-утечь' });
      expect.unreachable('должно было бросить');
    } catch (error) {
      expect(String(error)).not.toContain('секретное-значение');
      expect(String(error)).toContain('ENCRYPTION_KEY');
    }
  });
});

describe('необязательные переменные', () => {
  it('пустые строки трактуются как незаданные', () => {
    const env = parseEnv({
      ...minimal,
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_BOT_USERNAME: '',
      TELEGRAM_WEBHOOK_SECRET: '',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASSWORD: '',
      CRON_SECRET: '',
    });

    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it('заданные значения проходят', () => {
    const env = parseEnv({ ...minimal, SMTP_HOST: 'smtp.example.ru' });
    expect(env.SMTP_HOST).toBe('smtp.example.ru');
  });

  it('слишком короткий секрет отклоняется, а не молча принимается', () => {
    // 16 символов — минимум для CRON_SECRET: короткий секрет перебирается
    expect(() => parseEnv({ ...minimal, CRON_SECRET: 'коротко' })).toThrow(
      /CRON_SECRET/,
    );
  });
});
