import { TelegramAuthProvider } from '@/adapters/auth/telegram/telegram-auth';
import { AppError } from '@/server/auth/errors';
import { checkRateLimit } from '@/server/auth/rate-limit';
import { fail, getClientIp, ok } from '@/server/http';
import { signInWithIdentity } from '@/server/services/auth-service';

const provider = new TelegramAuthProvider();

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
    const result = await provider.verify(body, { ip });

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
