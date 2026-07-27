import { z } from 'zod';
import { EmailOtpAuthProvider } from '@/adapters/auth/email-otp/email-otp-auth';
import { fail, getClientIp, ok } from '@/server/http';

const schema = z.object({ email: z.string().email() });

const provider = new EmailOtpAuthProvider();

/**
 * POST /api/auth/email/request — запрос кода входа.
 *
 * ВАЖНО: ответ ОДИНАКОВ независимо от того, существует ли аккаунт
 * и был ли код отправлен. Иначе эндпоинт превращается в проверку
 * существования email (угроза T10).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);

    // Даже при невалидном email отвечаем так же — не подсказываем формат
    if (!parsed.success) {
      return ok({ status: 'sent' });
    }

    const result = await provider.challenge(parsed.data.email, {
      ip: getClientIp(request),
    });

    if (result.status === 'rate_limited') {
      return ok(
        { status: 'sent' },
        { headers: { 'Retry-After': String(result.retryAfterSeconds) } },
      );
    }

    return ok({ status: 'sent' });
  } catch (error) {
    return fail(error);
  }
}
