import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '@testing-library/jest-dom/vitest';

/**
 * Подготовка окружения тестов.
 *
 * Тесты не ходят в сеть — docs/07-testing-strategy.md, раздел 5.
 * Внешние API (ЦБ РФ, Telegram, SMTP) мокаются через MSW.
 */

process.env.TZ = 'UTC';

/**
 * Переменные для интеграционных тестов берутся из .env.test.
 *
 * Отдельный файл нужен, чтобы тесты работали на СВОЕЙ базе:
 * иначе прогон набора стирал бы данные разработчика.
 * Уже заданные переменные (например, из CI) не перезаписываются.
 */
const envTestPath = resolve(process.cwd(), '.env.test');

if (existsSync(envTestPath)) {
  for (const line of readFileSync(envTestPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (!(key in process.env)) process.env[key] = value;
  }
}
