import { resetRateLimit } from '@/lib/rate-limit';
import { AppError } from '@/server/auth/errors';
import { fail, getClientIp, ok } from '@/server/http';
import { signInWithIdentity } from '@/server/services/auth-service';
import { getEmailOtpProvider } from '@/server/services/auth-providers';

/** POST /api/auth/email/verify — проверка кода и создание сессии */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const ip = getClientIp(request);

    const result = await getEmailOtpProvider().verify(body, { ip });

    switch (result.status) {
      case 'verified': {
        const { isNewUser } = await signInWithIdentity(result.identity, {
          userAgent: request.headers.get('user-agent') ?? undefined,
        });
        // Успешный вход снимает счётчик неудачных попыток
        await resetRateLimit('authVerify', `ip:${ip}`);
        return ok({ isNewUser });
      }

      case 'expired':
        throw new AppError('VALIDATION_FAILED', 'Код истёк, запроси новый');

      case 'too_many_attempts':
        throw new AppError('RATE_LIMITED', 'Слишком много попыток', {
          retryAfterSeconds: 900,
        });

      default:
        throw new AppError('VALIDATION_FAILED', 'Неверный код');
    }
  } catch (error) {
    return fail(error);
  }
}
