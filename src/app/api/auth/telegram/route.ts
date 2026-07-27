import { checkRateLimit } from '@/lib/rate-limit';
import { AppError } from '@/server/auth/errors';
import { fail, getClientIp, ok } from '@/server/http';
import { signInWithIdentity } from '@/server/services/auth-service';
import { getTelegramProvider } from '@/server/services/auth-providers';

/**
 * POST /api/auth/telegram — вход по данным Telegram Login Widget.
 *
 * Подпись проверяется внутри провайдера через HMAC-SHA256 с токеном
 * бота. Без неё вход подделывается тривиально (T2).
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const limit = await checkRateLimit('authVerify', `ip:${ip}`);
    if (!limit.allowed) {
      throw new AppError('RATE_LIMITED', 'Слишком много попыток', {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const body = await request.json().catch(() => null);
    const result = await getTelegramProvider().verify(body, { ip });

    if (result.status === 'unavailable') {
      // Проблема на нашей стороне, а не в данных запроса
      throw new AppError(
        'PROVIDER_UNAVAILABLE',
        'Вход через Telegram сейчас недоступен',
      );
    }

    if (result.status !== 'verified') {
      // Не уточняем, что именно не так: подпись, срок или формат
      throw new AppError('VALIDATION_FAILED', 'Не удалось подтвердить вход');
    }

    const { isNewUser } = await signInWithIdentity(result.identity, {
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return ok({ isNewUser });
  } catch (error) {
    return fail(error);
  }
}
