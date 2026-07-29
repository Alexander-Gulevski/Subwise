'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '@/domain/money';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';
import { runAction, type ActionResult } from './result';

/**
 * Настройки пользователя — FR-07, FR-08.
 *
 * Базовая валюта — именно настройка, а не результат угадывания.
 * Определение по региону не способно отличить Беларусь от России:
 * обе в UTC+3, и Windows в Минске часто выставлен на московское
 * время. Поэтому угадывание только предлагает начальное значение,
 * а последнее слово всегда за пользователем.
 */

const currencySchema = z.object({
  baseCurrency: z.enum(SUPPORTED_CURRENCIES as unknown as [string, ...string[]]),
});

export async function updateBaseCurrencyAction(
  input: unknown,
): Promise<ActionResult<{ baseCurrency: string }>> {
  return runAction(async () => {
    const { baseCurrency } = currencySchema.parse(input);
    const user = await requireUser();

    await db.userSettings.updateMany({
      where: { userId: user.id },
      data: { baseCurrency },
    });

    // Итоги на дашборде считаются в базовой валюте — их надо пересчитать
    revalidatePath('/app');
    revalidatePath('/app/settings');

    return { baseCurrency };
  });
}

/**
 * Сохраняет предложенную валюту при первом входе.
 *
 * Вызывается онбордингом. Не перезаписывает уже выбранное: если
 * пользователь однажды указал валюту сам, угадывание не вправе
 * её менять.
 */
export async function seedBaseCurrencyAction(
  input: unknown,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { baseCurrency } = currencySchema.parse(input);
    const user = await requireUser();

    await db.userSettings.updateMany({
      where: { userId: user.id, onboardedAt: null },
      data: { baseCurrency },
    });

    return null;
  });
}
