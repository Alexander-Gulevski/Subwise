/**
 * Заголовки безопасности — docs/06-security-privacy.md, раздел 5.
 *
 * Вынесены из next.config.mjs отдельным модулем, чтобы политику можно
 * было проверять тестом как чистую функцию, без подмены NODE_ENV.
 *
 * Формат .mjs, а не .ts: next.config.mjs загружается Node напрямую,
 * без транспиляции TypeScript.
 */

/**
 * @param {boolean} isDev
 * @returns {{ key: string, value: string }[]}
 */
export function buildSecurityHeaders(isDev) {
  /**
   * ВАЖНО про 'unsafe-eval': дев-сборка Next.js выполняет модули и HMR
   * через eval. Без послабления рантайм webpack молча не стартует —
   * страница отрисовывается, но НЕ гидрируется: обработчики не
   * подключаются, а формы отправляются браузером нативно.
   *
   * Симптом обманчивый: в консоли пусто, сервер отвечает 200,
   * проверки API через curl проходят. Видно только по тому, что форма
   * входа перезагружает страницу вместо перехода ко второму шагу.
   *
   * В продакшене послабления нет: там eval не нужен.
   */
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  // ws: нужен дев-серверу для HMR
  const connectSrc = isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'";

  return [
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "img-src 'self' data: https:",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        connectSrc,
        // Основное приложение не встраивается в чужие фреймы.
        // Для маршрутов Telegram Mini App политика переопределяется
        // отдельно на этапе M3.
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'geolocation=(), camera=(), microphone=(), payment=()',
    },
  ];
}
