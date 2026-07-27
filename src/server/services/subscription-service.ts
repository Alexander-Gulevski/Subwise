import type { SubscriptionStatus } from '@prisma/client';
import {
  nextOccurrenceAfter,
  occurrencesBetween,
  type BillingCycle,
} from '@/domain/billing-cycle';
import { money, type CurrencyCode } from '@/domain/money';
import { assertTransition, chargesPerYear } from '@/domain/subscription';
import { errors } from '@/server/auth/errors';
import {
  subscriptionRepository,
  type CreateSubscriptionData,
  type SubscriptionRecord,
} from '@/server/repositories/subscription-repository';
import { writeAudit } from './audit';

/**
 * Сценарии работы с подписками — FR-01.
 *
 * Здесь НЕТ отмены: перевод в статус `cancelled` выполняет только
 * CancellationProvider.confirm() (ADR-0002). Попытка сделать это здесь
 * будет отклонена доменной проверкой assertTransition.
 */

/**
 * Насколько вперёд материализуются прогнозы списаний.
 *
 * Хранить их бесконечно незачем: прогноз дальше года не нужен ни
 * напоминаниям, ни аналитике, а недельная подписка иначе создаёт
 * полсотни строк на пустом месте.
 */
const SCHEDULE_HORIZON_MONTHS = 12;
const SCHEDULE_MAX_EVENTS = 12;

export type CreateSubscriptionInput = {
  serviceId?: string | null;
  customName?: string | null;
  categoryId?: string | null;
  amountMinor: number;
  currency: CurrencyCode;
  period: BillingCycle['period'];
  periodDays?: number | null;
  /** Дата первого списания. Задаёт якорный день месяца */
  firstBillingAt: Date;
  isTrial?: boolean;
  trialEndsAt?: Date | null;
  paymentLabel?: string | null;
  note?: string | null;
};

export const subscriptionService = {
  async create(
    userId: string,
    input: CreateSubscriptionInput,
  ): Promise<SubscriptionRecord> {
    if (!input.serviceId && !input.customName?.trim()) {
      throw errors.validation({
        customName: 'Укажи сервис из каталога или введи название',
      });
    }

    // Проверяем период ДО вставки: иначе некорректная запись сначала
    // сохранится и упадёт только при построении расписания
    chargesPerYear({ period: input.period, periodDays: input.periodDays ?? null });

    const isTrial = Boolean(input.isTrial && input.trialEndsAt);
    const status: SubscriptionStatus = isTrial ? 'trial' : 'active';

    // У триала первое платное списание — день окончания триала.
    // Он же становится якорем: дальше расписание считается от него.
    const anchor = isTrial ? input.trialEndsAt! : input.firstBillingAt;

    const data: CreateSubscriptionData = {
      userId,
      serviceId: input.serviceId ?? null,
      customName: input.customName?.trim() || null,
      categoryId: input.categoryId ?? null,
      amountMinor: input.amountMinor,
      currency: input.currency,
      period: input.period,
      periodDays: input.periodDays ?? null,
      status,
      billingAnchorAt: anchor,
      nextBillingAt: anchor,
      trialEndsAt: isTrial ? input.trialEndsAt! : null,
      paymentLabel: input.paymentLabel ?? null,
      note: input.note ?? null,
    };

    const created = await subscriptionRepository.create(data);
    await rebuildSchedule(created);

    await writeAudit({
      userId,
      action: 'subscription.created',
      entityType: 'Subscription',
      entityId: created.id,
      after: { status: created.status, period: created.period },
    });

    return created;
  },

  async pause(userId: string, subscriptionId: string): Promise<SubscriptionRecord> {
    const current = await requireOwned(userId, subscriptionId);

    assertTransition(current.status, 'paused', 'user');

    // На паузе подписка не участвует в расходах и не порождает
    // напоминаний, но запись сохраняется (FR-03)
    await subscriptionRepository.updateOwned(userId, subscriptionId, {
      status: 'paused',
      nextBillingAt: null,
    });
    await subscriptionRepository.cancelScheduledEvents(subscriptionId);

    await writeAudit({
      userId,
      action: 'subscription.paused',
      entityType: 'Subscription',
      entityId: subscriptionId,
      before: { status: current.status },
      after: { status: 'paused' },
    });

    return requireOwned(userId, subscriptionId);
  },

  async resume(
    userId: string,
    subscriptionId: string,
    now = new Date(),
  ): Promise<SubscriptionRecord> {
    const current = await requireOwned(userId, subscriptionId);

    assertTransition(current.status, 'active', 'user');

    // Якорь сохраняется, поэтому день месяца после паузы не съезжает
    const next = nextOccurrenceAfter(
      current.billingAnchorAt,
      toCycle(current),
      now,
    );

    await subscriptionRepository.updateOwned(userId, subscriptionId, {
      status: 'active',
      nextBillingAt: next,
    });

    const resumed = await requireOwned(userId, subscriptionId);
    await rebuildSchedule(resumed);

    await writeAudit({
      userId,
      action: 'subscription.resumed',
      entityType: 'Subscription',
      entityId: subscriptionId,
      before: { status: current.status },
      after: { status: 'active' },
    });

    return resumed;
  },

  async softDelete(userId: string, subscriptionId: string): Promise<void> {
    const affected = await subscriptionRepository.softDelete(userId, subscriptionId);
    if (affected === 0) throw errors.notFound('Подписка');

    await subscriptionRepository.cancelScheduledEvents(subscriptionId);

    await writeAudit({
      userId,
      action: 'subscription.deleted',
      entityType: 'Subscription',
      entityId: subscriptionId,
    });
  },

  async restore(userId: string, subscriptionId: string): Promise<SubscriptionRecord> {
    const affected = await subscriptionRepository.restore(userId, subscriptionId);
    if (affected === 0) {
      // Либо чужая, либо не существует, либо срок восстановления вышел —
      // ответ одинаков, чтобы не раскрывать, что именно (T1)
      throw errors.notFound('Подписка');
    }

    const restored = await requireOwned(userId, subscriptionId);
    await rebuildSchedule(restored);

    await writeAudit({
      userId,
      action: 'subscription.restored',
      entityType: 'Subscription',
      entityId: subscriptionId,
    });

    return restored;
  },

  async list(
    userId: string,
    filter: { statuses?: SubscriptionStatus[] } = {},
  ): Promise<SubscriptionRecord[]> {
    return subscriptionRepository.listOwned(userId, filter);
  },

  async get(userId: string, subscriptionId: string): Promise<SubscriptionRecord> {
    return requireOwned(userId, subscriptionId);
  },
};

/** Чужая подписка неотличима от несуществующей — это намеренно (T1) */
async function requireOwned(
  userId: string,
  subscriptionId: string,
): Promise<SubscriptionRecord> {
  const found = await subscriptionRepository.findOwned(userId, subscriptionId);
  if (!found) throw errors.notFound('Подписка');
  return found;
}

export function toCycle(record: SubscriptionRecord): BillingCycle {
  return { period: record.period, periodDays: record.periodDays };
}

/**
 * Пересчёт прогнозов списаний.
 *
 * Подтверждённые события не трогаются: они факт, а не прогноз.
 */
async function rebuildSchedule(
  record: SubscriptionRecord,
  now = new Date(),
): Promise<void> {
  if (record.status !== 'active' && record.status !== 'trial') {
    await subscriptionRepository.cancelScheduledEvents(record.id);
    return;
  }

  const horizon = new Date(now);
  horizon.setUTCMonth(horizon.getUTCMonth() + SCHEDULE_HORIZON_MONTHS);

  const dates = occurrencesBetween(
    record.billingAnchorAt,
    toCycle(record),
    new Date(now.getTime() - 1),
    horizon,
  ).slice(0, SCHEDULE_MAX_EVENTS);

  const amount = money(record.amountMinor, record.currency);

  await subscriptionRepository.replaceScheduledEvents(
    record.id,
    dates.map((dueAt) => ({
      dueAt,
      // Сумма фиксируется на момент события: цена подписки могла измениться
      amountMinor: amount.minor,
      currency: amount.currency,
    })),
  );
}
