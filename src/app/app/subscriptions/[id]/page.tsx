import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SubscriptionActions } from '@/components/features/subscriptions/subscription-actions';
import {
  SubscriptionForm,
  type SubscriptionFormValues,
} from '@/components/features/subscriptions/subscription-form';
import { CURRENCY_EXPONENT, type CurrencyCode } from '@/domain/money';
import { AppError } from '@/server/auth/errors';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';
import { subscriptionService } from '@/server/services/subscription-service';

export const metadata: Metadata = { title: 'Подписка' };

/**
 * Карточка подписки: правка и действия.
 *
 * Владение проверяется сервисом через userId. Чужая подписка отдаёт
 * NOT_FOUND и превращается в 404 — неотличимо от несуществующей (T1).
 */
export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const subscription = await subscriptionService
    .get(user.id, id)
    .catch((error: unknown) => {
      if (error instanceof AppError && error.code === 'NOT_FOUND') return null;
      throw error;
    });

  if (!subscription) notFound();

  const [categories, service] = await Promise.all([
    db.category.findMany({
      where: { isSystem: true },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true },
    }),
    subscription.serviceId
      ? db.service.findUnique({
          where: { id: subscription.serviceId },
          select: { name: true },
        })
      : null,
  ]);

  const initial: SubscriptionFormValues = {
    id: subscription.id,
    serviceId: subscription.serviceId,
    customName: service?.name ?? subscription.customName ?? '',
    amount: toAmountInput(subscription.amountMinor, subscription.currency),
    currency: subscription.currency,
    period: subscription.period,
    periodDays: subscription.periodDays ? String(subscription.periodDays) : '',
    firstBillingAt: toDateInput(subscription.billingAnchorAt),
    categoryId: subscription.categoryId ?? '',
    isTrial: subscription.status === 'trial',
    trialEndsAt: subscription.trialEndsAt
      ? toDateInput(subscription.trialEndsAt)
      : '',
    paymentLabel: subscription.paymentLabel ?? '',
    note: subscription.note ?? '',
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{initial.customName}</h1>

      <SubscriptionForm categories={categories} initial={initial} />

      <hr className="border-border" />

      <SubscriptionActions id={subscription.id} status={subscription.status} />
    </div>
  );
}

/** Копейки → строка для поля ввода: 39900 → «399», 39950 → «399,50» */
function toAmountInput(minor: number, currency: CurrencyCode): string {
  const exponent = CURRENCY_EXPONENT[currency];
  const value = minor / 10 ** exponent;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(exponent).replace('.', ',');
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
