/**
 * Типы для config/security-headers.mjs.
 *
 * Сам модуль написан на JavaScript, потому что next.config.mjs
 * загружается Node напрямую, без транспиляции TypeScript.
 * Декларация нужна, чтобы тест на TypeScript видел сигнатуру.
 */

export type SecurityHeader = {
  key: string;
  value: string;
};

export function buildSecurityHeaders(isDev: boolean): SecurityHeader[];
