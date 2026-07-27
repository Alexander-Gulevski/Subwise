import { daysUntil } from '@/domain/billing-cycle';
import {
  BASE_CURRENCY,
  convert,
  money,
  sum,
  type CurrencyCode,
  type ExchangeRate,
  type Money,
} from '@/domain/money';
import { monthlyCost, yearlyCost } from '@/domain/subscription';
import { db } from '@/server/db';
import {
  subscriptionRepository,
  type SubscriptionRecord,
} from '@/server/repositories/subscription-repository';
import { toCycle } from './subscription-service';

/**
 * Данные главного экрана — FR-02.
 *
 * Дашборд отвечает на три вопроса сверху вниз: сколько я плачу,
 * что спишут ближайшим, где утечка (docs/05-ux-flows.md).
 */

export type SubscriptionView = SubscriptionRecord & {
  displayName: string;
  categorySlug: string | null;
  /**
   * Сумма одного списания — то, что реально спишут с карты.
   * Именно её видит пользователь в строке подписки: показать вместо неё
   * месячный эквивалент значит соврать про сумму на карте.
   */
  amount: Money;
  amountInBase: Money | null;
  /** Приведённая к месяцу стоимость. Нужна только для итогов */
  monthly: Money;
  monthlyInBase: Money | null;
  daysUntilCharge: number | null;
};

export type DashboardSummary = {
  baseCurrency: CurrencyCode;
  monthlyTotal: Money;
  yearlyTotal: Money;
  /**
   * Сколько подписок не попало в итог из-за отсутствия курса.
   * Показывается явно: молча занижать сумму нельзя — пользователь
   * решит, что мы потеряли его подписку.
   */
  unconvertedCount: number;
  /** Курс устарел, взят последний известный (NFR-05) */
  hasStaleRate: boolean;
  trials: SubscriptionView[];
  upcoming: SubscriptionView[];
  active: SubscriptionView[];
  paused: SubscriptionView[];
};

const UPCOMING_WINDOW_DAYS = 30;

export async function getDashboard(
  userId: string,
  now = new Date(),
): Promise<DashboardSummary> {
  const [records, settings] = await Promise.all([
    subscriptionRepository.listOwned(userId),
    db.userSettings.findUnique({
      where: { userId },
      select: { baseCurrency: true },
    }),
  ]);

  const baseCurrency = (settings?.baseCurrency ?? BASE_CURRENCY) as CurrencyCode;

  const [names, categorySlugs, rates] = await Promise.all([
    resolveNames(records),
    resolveCategorySlugs(records),
    loadRates(records, baseCurrency),
  ]);

  const views: SubscriptionView[] = records.map((record) => {
    const amount = money(record.amountMinor, record.currency);
    const cycle = toCycle(record);
    const monthly = monthlyCost(amount, cycle);

    return {
      ...record,
      displayName: names.get(record.id) ?? 'Подписка',
      categorySlug: record.categoryId
        ? (categorySlugs.get(record.categoryId) ?? null)
        : null,
      amount,
      amountInBase: toBase(amount, baseCurrency, rates),
      monthly,
      monthlyInBase: toBase(monthly, baseCurrency, rates),
      daysUntilCharge: record.nextBillingAt
        ? daysUntil(now, record.nextBillingAt)
        : null,
    };
  });

  // Пауза не участвует в расходах (FR-03)
  const counted = views.filter(
    (view) => view.status === 'active' || view.status === 'trial',
  );

  const convertible = counted.filter((view) => view.monthlyInBase !== null);
  const monthlyTotal = sum(
    convertible.map((view) => view.monthlyInBase as Money),
    baseCurrency,
  );

  return {
    baseCurrency,
    monthlyTotal,
    yearlyTotal: yearlyCost(monthlyTotal, { period: 'monthly' }),
    unconvertedCount: counted.length - convertible.length,
    hasStaleRate: rates.stale,
    trials: views
      .filter((view) => view.status === 'trial')
      .sort(byDaysUntilCharge),
    upcoming: counted
      .filter(
        (view) =>
          view.daysUntilCharge !== null &&
          view.daysUntilCharge >= 0 &&
          view.daysUntilCharge <= UPCOMING_WINDOW_DAYS,
      )
      .sort(byDaysUntilCharge),
    active: views.filter((view) => view.status === 'active'),
    paused: views.filter((view) => view.status === 'paused'),
  };
}

function byDaysUntilCharge(a: SubscriptionView, b: SubscriptionView): number {
  return (a.daysUntilCharge ?? Infinity) - (b.daysUntilCharge ?? Infinity);
}

/** Название берётся из каталога, если подписка привязана к сервису */
async function resolveNames(
  records: SubscriptionRecord[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const serviceIds = records
    .map((record) => record.serviceId)
    .filter((id): id is string => Boolean(id));

  const services =
    serviceIds.length > 0
      ? await db.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true },
        })
      : [];

  const byId = new Map(services.map((service) => [service.id, service.name]));

  for (const record of records) {
    names.set(
      record.id,
      (record.serviceId ? byId.get(record.serviceId) : null) ??
        record.customName ??
        'Подписка',
    );
  }

  return names;
}

/** Слаг категории задаёт цвет монограммы (docs/10-design-system.md) */
async function resolveCategorySlugs(
  records: SubscriptionRecord[],
): Promise<Map<string, string>> {
  const ids = records
    .map((record) => record.categoryId)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return new Map();

  const categories = await db.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true },
  });

  return new Map(categories.map((category) => [category.id, category.slug]));
}

type RateBook = { map: Map<CurrencyCode, ExchangeRate>; stale: boolean };

/**
 * Курсы для валют, встречающихся у пользователя.
 *
 * Свежего курса может не быть — берём последний известный и помечаем
 * ответ как устаревший. Отсутствие курса не блокирует приложение
 * (NFR-05), но и не даёт молча посчитать неверный итог.
 */
async function loadRates(
  records: SubscriptionRecord[],
  baseCurrency: CurrencyCode,
): Promise<RateBook> {
  const needed = new Set<CurrencyCode>();
  for (const record of records) {
    if (record.currency !== baseCurrency) needed.add(record.currency);
  }
  if (baseCurrency !== 'RUB') needed.add(baseCurrency);

  if (needed.size === 0) return { map: new Map(), stale: false };

  const rows = await db.exchangeRate.findMany({
    where: { currency: { in: [...needed] } },
    orderBy: { date: 'desc' },
    distinct: ['currency'],
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let stale = false;
  const map = new Map<CurrencyCode, ExchangeRate>();

  for (const row of rows) {
    if (row.date.getTime() < today.getTime()) stale = true;
    map.set(row.currency as CurrencyCode, {
      currency: row.currency as CurrencyCode,
      rateMinor: row.rateMinor,
      date: row.date,
    });
  }

  return { map, stale };
}

function toBase(
  amount: Money,
  baseCurrency: CurrencyCode,
  rates: RateBook,
): Money | null {
  if (amount.currency === baseCurrency) return amount;

  const from = amount.currency === 'RUB' ? undefined : rates.map.get(amount.currency);
  const to = baseCurrency === 'RUB' ? undefined : rates.map.get(baseCurrency);

  if (amount.currency !== 'RUB' && !from) return null;
  if (baseCurrency !== 'RUB' && !to) return null;

  return convert(amount, baseCurrency, { from, to });
}
