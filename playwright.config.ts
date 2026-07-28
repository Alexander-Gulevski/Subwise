import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Сквозные тесты — docs/07-testing-strategy.md, раздел 4.
 *
 * Тесты обращаются к базе напрямую (e2e/helpers.ts), поэтому им нужен
 * DATABASE_URL из .env — Node сам его не подхватывает.
 */
for (const file of ['.env']) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!(key in process.env)) {
      process.env[key] = trimmed.slice(separator + 1).trim().replace(/^"|"$/g, '');
    }
  }
}

const PORT = process.env.PORT ?? '3000';
const baseURL = `http://localhost:${PORT}`;

/**
 * Против какой сборки гонять.
 *
 * По умолчанию — dev-сервер, потому что именно в нём жил баг с CSP:
 * production-сборке eval не нужен, и прогон по ней ничего бы не показал.
 * Разработчик должен ловить поломку в том окружении, где работает сам.
 *
 * E2E_TARGET=build переключает на production-сборку — так имеет смысл
 * гонять перед релизом, чтобы проверить строгую политику и оптимизации.
 */
const useBuild = process.env.E2E_TARGET === 'build';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],

  /**
   * Дефолтные 5 секунд не переживают холодный старт: dev-сервер Next.js
   * компилирует каждый маршрут при первом обращении, и это занимает
   * секунды. Локально флак заметен на первом прогоне после правок,
   * а в CI сервер холодный ВСЕГДА — там падал бы весь набор.
   *
   * Поднимаем пороги, а не отключаем проверки: медленный первый заход
   * это свойство режима разработки, а не дефект приложения.
   */
  expect: { timeout: 15_000 },
  timeout: 60_000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Mobile-first: основной сценарий проверяется на узком экране (NFR-08)
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],

  webServer: {
    command: useBuild ? 'npm run build && npm run start' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
