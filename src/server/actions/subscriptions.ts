'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '@/domain/money';
import { requireSubscriptionQuota, requireUser } from '@/server/auth/guards';
import { FREE_PLAN_SUBSCRIPTION_LIMIT } from '@/server/plan-limits';
import { subscriptionService } from '@/server/services/subscription-service';

/**
 * Точки входа для работы с подписками.
 *
 * Обязательный порядок в каждом действии (docs/04-api-contract.md):
 *   1. Schema.parse         валидация
 *   2. requireUser          аутентификация
 *   3. проверка владения    ← выполняется внутри сервиса через userId
 *   4. requireFeature       тариф, где нужен
 *   5. вызов сервиса
 *   6. аудит                ← внутри сервиса
 *
 * Владение здесь обеспечивается конструктивно: сервис и репозиторий
 * принимают userId и фильтруют по нему. Метода «получить по id» без
 * userId в проекте нет — забыть проверку физически негде.
 */

const idSchema = z.object({ id: z.string().min(1) });

const createSchema = z
  .object({
    serviceId: z.string().min(1).nullish(),
    customName: z.string().trim().min(1).max(120).nullish(),
    categoryId: z.string().min(1).nullish(),
    amountMinor: z.number().int().positive(),
    currency: z.enum(
      SUPPORTED_CURRENCIES as unknown as [string, ...string[]],
    ),
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
    isTrial: z.boolean().optional(),
    trialEndsAt: z.coerce.date().nullish(),
    paymentLabel: z.string().trim().max(60).nullish(),
    note: z.string().trim().max(500).nullish(),
  })
  .refine((data) => data.serviceId || data.customName, {
    message: 'Укажи сервис из каталога или введи название',
    path: ['customName'],
  })
  .refine((data) => data.period !== 'custom' || data.periodDays, {
    message: 'Для произвольного периода укажи число дней',
    path: ['periodDays'],
  })
  .refine((data) => !data.isTrial || data.trialEndsAt, {
    message: 'Укажи дату окончания триала',
    path: ['trialEndsAt'],
  });

export async function createSubscriptionAction(input: unknown) {
  const data = createSchema.parse(input);
  const user = await requireUser();

  await requireSubscriptionQuota(user, FREE_PLAN_SUBSCRIPTION_LIMIT);

  const created = await subscriptionService.create(user.id, {
    ...data,
    currency: data.currency as (typeof SUPPORTED_CURRENCIES)[number],
  });

  revalidatePath('/app');
  return created;
}

export async function pauseSubscriptionAction(input: unknown) {
  const { id } = idSchema.parse(input);
  const user = await requireUser();

  const result = await subscriptionService.pause(user.id, id);

  revalidatePath('/app');
  return result;
}

export async function resumeSubscriptionAction(input: unknown) {
  const { id } = idSchema.parse(input);
  const user = await requireUser();

  const result = await subscriptionService.resume(user.id, id);

  revalidatePath('/app');
  return result;
}

export async function deleteSubscriptionAction(input: unknown) {
  const { id } = idSchema.parse(input);
  const user = await requireUser();

  await subscriptionService.softDelete(user.id, id);

  revalidatePath('/app');
  return { ok: true as const };
}

export async function restoreSubscriptionAction(input: unknown) {
  const { id } = idSchema.parse(input);
  const user = await requireUser();

  const result = await subscriptionService.restore(user.id, id);

  revalidatePath('/app');
  return result;
}
