import {
  CURRENCY_EXPONENT,
  RATE_SCALE,
  type ConvertedMoney,
  type CurrencyCode,
  type ExchangeRate,
  type Money,
} from './types';

/** Создаёт денежную величину. Дробные минорные единицы — ошибка. */
export function money(minor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(minor)) {
    throw new Error(
      `Минорные единицы должны быть целым числом, получено ${minor}. ` +
        'Деньги хранятся в копейках — см. ADR-0004',
    );
  }
  return { minor, currency };
}

export function zero(currency: CurrencyCode): Money {
  return { minor: 0, currency };
}

/** Сложение. Разные валюты складывать нельзя — сначала пересчитай в одну. */
export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minor: a.minor + b.minor, currency: a.currency };
}

/**
 * Сумма списка. Складывает в минорных единицах, поэтому
 * сумма частей всегда равна целому — без накопления ошибки.
 */
export function sum(items: readonly Money[], currency: CurrencyCode): Money {
  let total = 0;
  for (const item of items) {
    if (item.currency !== currency) {
      throw new Error(
        `Нельзя суммировать ${item.currency} в ${currency} без пересчёта`,
      );
    }
    total += item.minor;
  }
  return { minor: total, currency };
}

/** Умножение на целое (например, месячная цена × 12). */
export function multiply(amount: Money, factor: number): Money {
  return { minor: Math.round(amount.minor * factor), currency: amount.currency };
}

/**
 * Пересчёт в базовую валюту.
 *
 * Выполняется ТОЛЬКО на отображении и в агрегатах, никогда при записи:
 * исходная сумма подписки неприкосновенна (ADR-0004).
 *
 * Округление — здесь, на финальном шаге. Промежуточные вычисления
 * идут в минорных единицах без округления.
 */
export function convert(
  amount: Money,
  target: CurrencyCode,
  rates: {
    /** Курс исходной валюты. Не нужен, если исходная валюта — RUB */
    from?: ExchangeRate;
    /** Курс целевой валюты. Не нужен, если целевая — RUB */
    to?: ExchangeRate;
  },
  options: { isStale?: boolean } = {},
): ConvertedMoney {
  const rateDate = rates.from?.date ?? rates.to?.date ?? new Date(0);
  const isStale = options.isStale ?? false;

  if (amount.currency === target) {
    return { ...amount, rateDate, isStale };
  }

  // Пивот через рубль: RUB ← исходная, RUB → целевая.
  const inRubMinor = toRubMinor(amount, rates.from);
  const minor = fromRubMinor(inRubMinor, target, rates.to);

  return { minor, currency: target, rateDate, isStale };
}

function toRubMinor(amount: Money, rate?: ExchangeRate): number {
  if (amount.currency === 'RUB') return amount.minor;

  if (!rate) {
    throw new Error(`Нет курса для ${amount.currency} — пересчёт невозможен`);
  }
  if (rate.currency !== amount.currency) {
    throw new Error(
      `Передан курс ${rate.currency}, а сумма в ${amount.currency}`,
    );
  }

  const scale = exponentScale('RUB', amount.currency);
  return (amount.minor * rate.rateMinor * scale) / RATE_SCALE;
}

function fromRubMinor(
  rubMinor: number,
  target: CurrencyCode,
  rate?: ExchangeRate,
): number {
  if (target === 'RUB') return Math.round(rubMinor);

  if (!rate) {
    throw new Error(`Нет курса для ${target} — пересчёт невозможен`);
  }
  if (rate.currency !== target) {
    throw new Error(`Передан курс ${rate.currency}, а нужен ${target}`);
  }

  const scale = exponentScale(target, 'RUB');
  return Math.round((rubMinor * RATE_SCALE * scale) / rate.rateMinor);
}

/** Множитель разницы в числе знаков между валютами. */
function exponentScale(to: CurrencyCode, from: CurrencyCode): number {
  return 10 ** (CURRENCY_EXPONENT[to] - CURRENCY_EXPONENT[from]);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Нельзя складывать ${a.currency} и ${b.currency} без пересчёта`,
    );
  }
}
