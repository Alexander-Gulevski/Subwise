'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/domain/money';
import { requireSubscriptionQuota, requireUser } from '@/server/auth/guards';
import { FREE_PLAN_SUBSCRIPTION_LIMIT } from '@/server/plan-limits';
import { subscriptionService } from '@/server/services/subscription-service';
import { runAction, type ActionResult } from './result';

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
 * Владение обеспечивается конструктивно: сервис и репозиторий принимают
 * userId и фильтруют по нему. Метода «получить по id» без userId
 * в проекте нет — забыть проверку физически негде.
 */

const idSchema = z.object({ id: z.string().min(1) });

const createSchema = z
  .object({
    serviceId: z.string().min(1).nullish(),
    customName: z
      .string()
      .trim()
      .min(1, 'Введи название сервиса')
      .max(120, 'Название длиннее 120 символов')
      .nullish(),
    categoryId: z.string().min(1).nullish(),
    amountMinor: z
      .number({ invalid_type_error: 'Введи сумму' })
      .int()
      .positive('Сумма должна быть больше нуля'),
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
    firstBillingAt: z.coerce.date({ invalid_type_error: 'Укажи дату списания' }),
    isTrial: z.boolean().optional(),
    trialEndsAt: z.coerce.date().nullish(),
    paymentLabel: z.string().trim().max(60).nullish(),
    note: z.string().trim().max(500, 'Заметка длиннее 500 символов').nullish(),
  })
  .refine((data) => data.serviceId || data.customName, {
    message: 'Укажи сервис из каталога или введи название',
    path: ['customName'],
  })
  .refine((data) => data.period !== 'custom' || data.periodDays, {
    message: 'Укажи, через сколько дней списывают',
    path: ['periodDays'],
  })
  .refine((data) => !data.isTrial || data.trialEndsAt, {
    message: 'Укажи дату окончания триала',
    path: ['trialEndsAt'],
  });

export async function createSubscriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = createSchema.parse(input);
    const user = await requireUser();

    await requireSubscriptionQuota(user, FREE_PLAN_SUBSCRIPTION_LIMIT);

    const created = await subscriptionService.create(user.id, {
      ...data,
      currency: data.currency as CurrencyCode,
    });

    revalidatePath('/app');
    return { id: created.id };
  });
}

/**
 * Изменяемые поля.
 *
 * Все необязательные: форма присылает только то, что реально меняет.
 * Отсутствие ключа означает «не трогать», null — «очистить».
 */
const updateSchema = z
  .object({
    id: z.string().min(1),
    customName: z
      .string()
      .trim()
      .min(1, 'Введи название сервиса')
      .max(120, 'Название длиннее 120 символов')
      .optional(),
    categoryId: z.string().min(1).nullish(),
    amountMinor: z
      .number({ invalid_type_error: 'Введи сумму' })
      .int()
      .positive('Сумма должна быть больше нуля')
      .optional(),
    currency: z
      .enum(SUPPORTED_CURRENCIES as unknown as [string, ...string[]])
      .optional(),
    period: z
      .enum(['weekly', 'monthly', 'quarterly', 'semiannual', 'yearly', 'custom'])
      .optional(),
    periodDays: z.number().int().positive().max(3650).nullish(),
    firstBillingAt: z.coerce.date().optional(),
    trialEndsAt: z.coerce.date().nullish(),
    paymentLabel: z.string().trim().max(60).nullish(),
    note: z.string().trim().max(500, 'Заметка длиннее 500 символов').nullish(),
  })
  .refine((data) => data.period !== 'custom' || data.periodDays, {
    message: 'Укажи, через сколько дней списывают',
    path: ['periodDays'],
  });

export async function updateSubscriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { id, ...changes } = updateSchema.parse(input);
    const user = await requireUser();

    const result = await subscriptionService.update(user.id, id, {
      ...changes,
      currency: changes.currency as CurrencyCode | undefined,
    });

    revalidatePath('/app');
    revalidatePath(`/app/subscriptions/${id}`);
    return { id: result.id };
  });
}

export async function pauseSubscriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { id } = idSchema.parse(input);
    const user = await requireUser();

    const result = await subscriptionService.pause(user.id, id);

    revalidatePath('/app');
    return { id: result.id };
  });
}

export async function resumeSubscriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { id } = idSchema.parse(input);
    const user = await requireUser();

    const result = await subscriptionService.resume(user.id, id);

    revalidatePath('/app');
    return { id: result.id };
  });
}

export async function deleteSubscriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { id } = idSchema.parse(input);
    const user = await requireUser();

    await subscriptionService.softDelete(user.id, id);

    revalidatePath('/app');
    return { id };
  });
}

export async function restoreSubscriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { id } = idSchema.parse(input);
    const user = await requireUser();

    const result = await subscriptionService.restore(user.id, id);

    revalidatePath('/app');
    return { id: result.id };
  });
}
