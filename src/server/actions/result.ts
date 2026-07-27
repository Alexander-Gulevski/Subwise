import { ZodError } from 'zod';
import { AppError, type AppErrorCode } from '@/server/auth/errors';

/**
 * Результат Server Action.
 *
 * Действия вызываются из клиентских компонентов напрямую. Брошенное
 * исключение React показал бы как безликую ошибку, а в продакшене
 * ещё и без текста — поэтому ошибки возвращаются значением.
 *
 * Внутри сервисов по-прежнему бросаем AppError: там исключение уместно
 * и прерывает выполнение. Обёртка переводит его на границе.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: AppErrorCode;
        message: string;
        /** Ошибки по полям формы: { amountMinor: 'Введи сумму' } */
        fields?: Record<string, string>;
      };
    };

export async function runAction<T>(
  operation: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join('.') || '_';
        // Первая ошибка по полю информативнее последней
        if (!fields[key]) fields[key] = issue.message;
      }

      return {
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Проверь введённые данные',
          fields,
        },
      };
    }

    if (error instanceof AppError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && typeof error.details === 'object'
            ? {}
            : {}),
        },
      };
    }

    // Детали внутренних ошибок наружу не отдаём — только в логи (T11)
    console.error(
      JSON.stringify({ level: 'error', msg: 'action failed', error: String(error) }),
    );

    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Что-то пошло не так' },
    };
  }
}
