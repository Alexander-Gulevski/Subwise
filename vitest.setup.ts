import '@testing-library/jest-dom/vitest';

/**
 * Тесты не ходят в сеть — docs/07-testing-strategy.md, раздел 5.
 * Внешние API (ЦБ РФ, Telegram, SMTP) мокаются через MSW.
 */
process.env.TZ = 'UTC';
