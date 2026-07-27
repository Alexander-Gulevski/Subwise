/**
 * Периодичность списаний.
 *
 * Тип объявлен в домене, а не импортируется из @prisma/client:
 * домен обязан компилироваться и тестироваться без инфраструктуры
 * (docs/02-architecture.md). Соответствие enum'у БД проверяется тестом.
 */
export type BillingPeriod =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | 'custom';

export type BillingCycle = {
  readonly period: BillingPeriod;
  /** Обязателен и осмыслен только для period = 'custom' */
  readonly periodDays?: number | null;
};

/** Сколько месяцев в периоде. null — период считается в днях. */
export const MONTHS_IN_PERIOD: Record<BillingPeriod, number | null> = {
  weekly: null,
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  custom: null,
};
