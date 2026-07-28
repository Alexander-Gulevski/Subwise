'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/domain/money';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';
import { FREE_PLAN_SUBSCRIPTION_LIMIT } from '@/server/plan-limits';
import { errors } from '@/server/auth/errors';
import { subscriptionService } from '@/server/services/subscription-service';
import { runAction, type ActionResult } from './result';

/**
 * Онбординг — FR-01, docs/05-ux-flows.md.
 *
 * Цель: от первого экрана до заполненного дашборда не больше
 * 90 секунд. Просьба добавить подписки по одной убивает первую
 * сессию, поэтому сетка превращает ввод в узнавание.
 */

const itemSchema = z.object({
  serviceId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.enum(SUPPORTED_CURRENCIES as unknown as [string, ...string[]]),
  period: z.enum([
    'weekly',
    'monthly',
    'quarterly',
    'semiannual',
    'yearly',
    'custom',
  ]),
  periodDays: z.number().int().positive().max(3650).nullish(),
  firstBillingAt: z.coerce.date(),
});

const completeSchema = z.object({
  items: z.array(itemSchema).max(FREE_PLAN_SUBSCRIPTION_LIMIT),
});

export async function completeOnboardingAction(
  input: unknown,
): Promise<ActionResult<{ created: number }>> {
  return runAction(async () => {
    const { items } = completeSchema.parse(input);
    const user = await requireUser();

    if (items.length > FREE_PLAN_SUBSCRIPTION_LIMIT && user.plan !== 'pro') {
      throw errors.limitExceeded(FREE_PLAN_SUBSCRIPTION_LIMIT);
    }

    // Названия берём из каталога на сервере: присланное клиентом
    // могло быть подменено, а подписка должна называться так же,
    // как сервис, на который ссылается
    const services = await db.service.findMany({
      where: { id: { in: items.map((item) => item.serviceId) }, isActive: true },
      select: { id: true, name: true, categoryId: true },
    });

    const byId = new Map(services.map((service) => [service.id, service]));

    for (const item of items) {
      const service = byId.get(item.serviceId);
      // Несуществующий сервис просто пропускаем: ронять весь онбординг
      // из-за одной устаревшей записи в каталоге незачем
      if (!service) continue;

      await subscriptionService.create(user.id, {
        serviceId: service.id,
        customName: service.name,
        categoryId: service.categoryId,
        amountMinor: item.amountMinor,
        currency: item.currency as CurrencyCode,
        period: item.period,
        periodDays: item.periodDays ?? null,
        firstBillingAt: item.firstBillingAt,
      });
    }

    await markOnboarded(user.id);

    revalidatePath('/app');
    return { created: items.filter((item) => byId.has(item.serviceId)).length };
  });
}

/**
 * Пропуск онбординга.
 *
 * Отметка обязательна: без неё пропустивший попадал бы в онбординг
 * снова при каждом заходе на пустой дашборд.
 */
export async function skipOnboardingAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireUser();
    await markOnboarded(user.id);

    revalidatePath('/app');
    return null;
  });
}

async function markOnboarded(userId: string): Promise<void> {
  await db.userSettings.updateMany({
    where: { userId, onboardedAt: null },
    data: { onboardedAt: new Date() },
  });
}
