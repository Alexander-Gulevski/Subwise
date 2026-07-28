/**
 * Деньги в Subwise — ADR-0004.
 *
 * ЕДИНСТВЕННЫЙ допустимый способ хранить и считать деньги:
 * целое число минорных единиц (копеек, центов). 399,00 ₽ → 39900.
 *
 * `float` для денег запрещён: 0.1 + 0.2 !== 0.3, и при суммировании
 * десятков подписок ошибка становится видна пользователю.
 */

export type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'BYN';

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = [
  'RUB',
  'USD',
  'EUR',
  'KZT',
  'BYN',
] as const;

export const BASE_CURRENCY: CurrencyCode = 'RUB';

/**
 * Число знаков после запятой у валюты.
 * Вынесено таблицей, а не константой 2: валюты без дробной части
 * (JPY) появятся при выходе за пределы СНГ.
 */
export const CURRENCY_EXPONENT: Record<CurrencyCode, number> = {
  RUB: 2,
  USD: 2,
  EUR: 2,
  KZT: 2,
  BYN: 2,
};

export type Money = {
  /** Целое число минорных единиц. Никогда не дробное */
  readonly minor: number;
  readonly currency: CurrencyCode;
};

/**
 * Курс к рублю, умноженный на RATE_SCALE.
 * USD по 78,4521 ₽ → rateMinor = 784521.
 */
export const RATE_SCALE = 10_000;

export type ExchangeRate = {
  readonly currency: CurrencyCode;
  /** Курс × RATE_SCALE. Сколько рублей за одну единицу валюты */
  readonly rateMinor: number;
  /** Дата курса — история должна быть воспроизводима */
  readonly date: Date;
};

/** Результат пересчёта. isStale означает, что свежий курс недоступен (NFR-05) */
export type ConvertedMoney = Money & {
  readonly rateDate: Date;
  readonly isStale: boolean;
};

