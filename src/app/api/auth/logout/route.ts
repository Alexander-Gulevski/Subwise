import { destroyAllSessions, destroySession } from '@/server/auth/session';
import { getSessionUser } from '@/server/auth/session';
import { fail, ok } from '@/server/http';

/**
 * POST /api/auth/logout — завершение сессии.
 * Тело { all: true } отзывает все сессии пользователя (FR-09).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { all?: boolean };

    if (body.all) {
      const user = await getSessionUser();
      if (user) {
        await destroyAllSessions(user.id);
        return ok({ status: 'logged_out' });
      }
    }

    await destroySession();
    return ok({ status: 'logged_out' });
  } catch (error) {
    return fail(error);
  }
}
