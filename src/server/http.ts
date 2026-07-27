import { NextResponse } from 'next/server';
import { AppError } from '@/server/auth/errors';

/**
 * Единый формат ответа REST — docs/04-api-contract.md, раздел 3.
 *
 *   успех:  { ok: true,  data: {...} }
 *   ошибка: { ok: false, error: { code, message, details? } }
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const headers: Record<string, string> = {};

    if (error.code === 'RATE_LIMITED') {
      const retryAfter = error.details?.['retryAfterSeconds'];
      if (typeof retryAfter === 'number') {
        headers['Retry-After'] = String(retryAfter);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.httpStatus, headers },
    );
  }

  // Детали внутренних ошибок наружу не отдаются — только в логи (T11).
  console.error('Необработанная ошибка:', error);

  return NextResponse.json(
    {
      ok: false,
      error: { code: 'INTERNAL', message: 'Что-то пошло не так' },
    },
    { status: 500 },
  );
}

/** IP клиента для rate limiting. За прокси берём первый адрес из X-Forwarded-For. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}
