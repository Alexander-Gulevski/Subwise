import { getEnv } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { AppError } from '@/server/auth/errors';
import { fail, ok } from '@/server/http';
import { syncExchangeRates } from '@/server/services/exchange-rate-service';

/**
 * POST /api/cron/exchange-rates — загрузка курсов ЦБ РФ.
 *
 * Служебный эндпоинт: требует секрет в заголовке и при его отсутствии
 * отвечает 401 без объяснений (docs/04-api-contract.md, раздел 5).
 *
 * Идемпотентен: повторный вызов за тот же день перезаписывает те же
 * строки. Планировщик можно перезапускать безопасно (NFR-05).
 */
export async function POST(request: Request) {
  try {
    const expected = getEnv().CRON_SECRET;

    // Не задан секрет — эндпоинт закрыт. Открывать служебный вход
    // из-за неполной конфигурации нельзя
    if (!expected) {
      throw new AppError('UNAUTHENTICATED', 'Недоступно');
    }

    const provided = request.headers.get('x-cron-secret');

    if (!provided || !safeEqual(provided, expected)) {
      throw new AppError('UNAUTHENTICATED', 'Недоступно');
    }

    const result = await syncExchangeRates();

    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'курсы обновлены',
        saved: result.saved,
        date: result.date?.toISOString().slice(0, 10) ?? null,
      }),
    );

    return ok({
      saved: result.saved,
      date: result.date?.toISOString().slice(0, 10) ?? null,
    });
  } catch (error) {
    return fail(error);
  }
}
