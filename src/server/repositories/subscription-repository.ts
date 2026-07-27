import type { Prisma, SubscriptionStatus } from '@prisma/client';
import { db } from '@/server/db';
import type { BillingPeriod } from '@/domain/billing-cycle';
import type { CurrencyCode } from '@/domain/money';

/**
 * Доступ к подпискам.
 *
 * ГЛАВНОЕ ПРАВИЛО: каждый метод принимает userId и фильтрует по нему.
 * Метода «получить подписку по id» без userId здесь нет и быть не может —
 * именно так появляется доступ к чужим данным (угроза T1).
 *
 * Мягко удалённые записи по умолчанию исключены: они существуют только
 * ради восстановления в течение 30 дней (FR-01).
 */

export type SubscriptionRecord = {
  id: string;
  userId: string;
  serviceId: string | null;
  customName: string | null;
  categoryId: string | null;
  amountMinor: number;
  currency: CurrencyCode;
  period: BillingPeriod;
  periodDays: number | null;
  status: SubscriptionStatus;
  billingAnchorAt: Date;
  nextBillingAt: Date | null;
  trialEndsAt: Date | null;
  accessUntil: Date | null;
  cancelledAt: Date | null;
  paymentLabel: string | null;
  note: string | null;
};

export type CreateSubscriptionData = {
  userId: string;
  serviceId?: string | null;
  customName?: string | null;
  categoryId?: string | null;
  amountMinor: number;
  currency: CurrencyCode;
  period: BillingPeriod;
  periodDays?: number | null;
  status: SubscriptionStatus;
  billingAnchorAt: Date;
  nextBillingAt: Date | null;
  trialEndsAt?: Date | null;
  paymentLabel?: string | null;
  note?: string | null;
};

const SELECT = {
  id: true,
  userId: true,
  serviceId: true,
  customName: true,
  categoryId: true,
  amountMinor: true,
  currency: true,
  period: true,
  periodDays: true,
  status: true,
  billingAnchorAt: true,
  nextBillingAt: true,
  trialEndsAt: true,
  accessUntil: true,
  cancelledAt: true,
  paymentLabel: true,
  note: true,
} satisfies Prisma.SubscriptionSelect;

function toRecord(row: {
  currency: string;
  period: string;
  [key: string]: unknown;
}): SubscriptionRecord {
  // Значения приходят из enum'ов БД, поэтому приведение безопасно.
  // Соответствие доменных типов и enum'ов Prisma закрыто тестом.
  return row as unknown as SubscriptionRecord;
}

export const subscriptionRepository = {
  async create(data: CreateSubscriptionData): Promise<SubscriptionRecord> {
    const row = await db.subscription.create({ data, select: SELECT });
    return toRecord(row);
  },

  /** Возвращает null и для чужой подписки, и для несуществующей — по построению */
  async findOwned(
    userId: string,
    subscriptionId: string,
  ): Promise<SubscriptionRecord | null> {
    const row = await db.subscription.findFirst({
      where: { id: subscriptionId, userId, deletedAt: null },
      select: SELECT,
    });
    return row ? toRecord(row) : null;
  },

  async listOwned(
    userId: string,
    filter: { statuses?: SubscriptionStatus[] } = {},
  ): Promise<SubscriptionRecord[]> {
    const rows = await db.subscription.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(filter.statuses ? { status: { in: filter.statuses } } : {}),
      },
      orderBy: [{ nextBillingAt: 'asc' }, { createdAt: 'desc' }],
      select: SELECT,
    });
    return rows.map(toRecord);
  },

  async countActive(userId: string): Promise<number> {
    return db.subscription.count({ where: { userId, deletedAt: null } });
  },

  /**
   * updateMany, а не update: он принимает userId в условии.
   * update по одному id прошёл бы мимо проверки владения.
   */
  async updateOwned(
    userId: string,
    subscriptionId: string,
    data: Prisma.SubscriptionUpdateManyMutationInput,
  ): Promise<number> {
    const result = await db.subscription.updateMany({
      where: { id: subscriptionId, userId, deletedAt: null },
      data,
    });
    return result.count;
  },

  async softDelete(userId: string, subscriptionId: string): Promise<number> {
    const result = await db.subscription.updateMany({
      where: { id: subscriptionId, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  },

  /** Восстановление доступно 30 дней (FR-01) */
  async restore(
    userId: string,
    subscriptionId: string,
    withinDays = 30,
  ): Promise<number> {
    const threshold = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);

    const result = await db.subscription.updateMany({
      where: {
        id: subscriptionId,
        userId,
        deletedAt: { not: null, gte: threshold },
      },
      data: { deletedAt: null },
    });
    return result.count;
  },

  /** Пересоздание расписания: старые прогнозы удаляются, подтверждённые списания остаются */
  async replaceScheduledEvents(
    subscriptionId: string,
    events: Array<{ dueAt: Date; amountMinor: number; currency: string }>,
  ): Promise<void> {
    await db.$transaction([
      db.billingEvent.deleteMany({
        where: { subscriptionId, status: 'scheduled' },
      }),
      db.billingEvent.createMany({
        data: events.map((event) => ({ subscriptionId, ...event })),
        skipDuplicates: true,
      }),
    ]);
  },

  async cancelScheduledEvents(subscriptionId: string): Promise<void> {
    await db.billingEvent.updateMany({
      where: { subscriptionId, status: 'scheduled' },
      data: { status: 'skipped' },
    });
  },
};
