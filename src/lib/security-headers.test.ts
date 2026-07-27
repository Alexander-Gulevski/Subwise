import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from '../../config/security-headers.mjs';

/**
 * Регрессия: CSP ломала гидрацию в разработке.
 *
 * Дев-сборка Next.js выполняет модули и HMR через eval. Политика
 * `script-src 'self' 'unsafe-inline'` без 'unsafe-eval' молча не давала
 * стартовать рантайму webpack: страница отрисовывалась, но React
 * не гидрировался — обработчики не подключались, а формы отправлялись
 * браузером нативно.
 *
 * Симптом был обманчивый: в консоли пусто, сервер отвечает 200,
 * проверки API через curl проходят. Видно только по тому, что форма
 * входа перезагружает страницу вместо перехода ко второму шагу.
 */

type HeaderEntry = { key: string; value: string };

function csp(isDev: boolean): string {
  const headers = buildSecurityHeaders(isDev) as HeaderEntry[];
  const found = headers.find((h) => h.key === 'Content-Security-Policy');
  if (!found) throw new Error('CSP отсутствует в заголовках');
  return found.value;
}

describe('Content-Security-Policy', () => {
  it('в разработке разрешает eval — иначе Next.js не гидрируется', () => {
    expect(csp(true)).toContain("'unsafe-eval'");
  });

  it('в продакшене eval запрещён', () => {
    expect(csp(false)).not.toContain("'unsafe-eval'");
  });

  it('в разработке разрешает websocket для HMR', () => {
    expect(csp(true)).toMatch(/connect-src[^;]*ws:/);
  });

  it('в продакшене websocket не разрешён', () => {
    expect(csp(false)).toMatch(/connect-src 'self'(;|$)/);
  });

  it('встраивание в чужие фреймы запрещено в обоих режимах', () => {
    expect(csp(true)).toContain("frame-ancestors 'none'");
    expect(csp(false)).toContain("frame-ancestors 'none'");
  });

  it('источники по умолчанию ограничены своим доменом', () => {
    expect(csp(false)).toContain("default-src 'self'");
    expect(csp(false)).toContain("form-action 'self'");
  });
});

describe('прочие заголовки безопасности', () => {
  it('HSTS, nosniff, Referrer-Policy и Permissions-Policy на месте', () => {
    const keys = (buildSecurityHeaders(false) as HeaderEntry[]).map((h) => h.key);

    expect(keys).toContain('Strict-Transport-Security');
    expect(keys).toContain('X-Content-Type-Options');
    expect(keys).toContain('Referrer-Policy');
    expect(keys).toContain('Permissions-Policy');
  });
});
