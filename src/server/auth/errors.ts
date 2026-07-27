/**
 * Ошибки прикладного слоя — коды из docs/04-api-contract.md.
 *
 * ВАЖНО: чужой ресурс возвращает NOT_FOUND, а не FORBIDDEN.
 * Разные коды позволяют перебором узнать, какие идентификаторы
 * существуют в системе (T1).
 */

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'PLAN_REQUIRED'
  | 'LIMIT_EXCEEDED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INTERNAL';

const HTTP_STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  PLAN_REQUIRED: 402,
  LIMIT_EXCEEDED: 409,
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly httpStatus: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: AppErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.details = details;
  }
}

export const errors = {
  unauthenticated: () =>
    new AppError('UNAUTHENTICATED', 'Нужно войти в аккаунт'),

  /** Используется для чужих ресурсов тоже — намеренно (T1) */
  notFound: (what = 'Ресурс') => new AppError('NOT_FOUND', `${what} не найден`),

  planRequired: (feature: string) =>
    new AppError('PLAN_REQUIRED', 'Функция доступна на расширенном тарифе', {
      feature,
    }),

  limitExceeded: (limit: number) =>
    new AppError(
      'LIMIT_EXCEEDED',
      `На бесплатном тарифе можно вести до ${limit} подписок`,
      { limit },
    ),

  validation: (details: Record<string, unknown>) =>
    new AppError('VALIDATION_FAILED', 'Проверь введённые данные', details),

  rateLimited: (retryAfterSeconds: number) =>
    new AppError('RATE_LIMITED', 'Слишком много попыток, попробуй позже', {
      retryAfterSeconds,
    }),
} as const;
