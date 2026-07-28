import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExchangeRate } from '@/domain/money';
import type { ExchangeRateSource } from '@/ports/ExchangeRateSource';
import { db } from '@/server/db';
import {
  hasTodayRates,
  setExchangeRateSource,
  syncExchangeRates,
} from './exchange-rate-service';
import { utcDate } from '@/server/__tests__/helpers';

/**
 * Загрузка курсов — FR-08, NFR-05.
 *
 * Источник подменяется: сеть в тестах запрещена (docs/07, раздел 5),
 * а проверять надо не ЦБ, а нашу идемпотентность и деградацию.
 */

function fakeSource(
  rates: ExchangeRate[],
  onFetch?: () => void,
): ExchangeRateSource {
  return {
    id: 'cbr',
    supportedCurrencies: ['RUB', 'USD', 'EUR', 'KZT', 'BYN'],
    async fetchRates() {
      onFetch?.();
      return rates;
    },
  };
}

const day = utcDate('2026-07-28');

const sample: ExchangeRate[] = [
  { currency: 'USD', rateMinor: 784_521, date: day },
  { currency: 'KZT', rateMinor: 1_560, date: day },
];

beforeEach(async () => {
  await db.exchangeRate.deleteMany();
});

afterEach(() => {
  setExchangeRateSource(null);
});

afterAll(async () => {
  await db.exchangeRate.deleteMany();
  await db.$disconnect();
});

describe('загрузка', () => {
  it('сохраняет курсы в базу', async () => {
    setExchangeRateSource(fakeSource(sample));

    const result = await syncExchangeRates();

    expect(result.saved).toBe(2);

    const saved = await db.exchangeRate.findMany({ orderBy: { currency: 'asc' } });
    expect(saved.map((row) => [row.currency, row.rateMinor])).toEqual([
      ['KZT', 1_560],
      ['USD', 784_521],
    ]);
  });

  it('источник без данных не создаёт записей', async () => {
    setExchangeRateSource(fakeSource([]));

    const result = await syncExchangeRates();

    expect(result.saved).toBe(0);
    expect(await db.exchangeRate.count()).toBe(0);
  });
});

describe('ИДЕМПОТЕНТНОСТЬ', () => {
  it('повторный запуск за тот же день не плодит дубли', async () => {
    setExchangeRateSource(fakeSource(sample));

    await syncExchangeRates();
    await syncExchangeRates();
    await syncExchangeRates();

    // Планировщик можно перезапускать безопасно (NFR-05)
    expect(await db.exchangeRate.count()).toBe(2);
  });

  it('повторный запуск обновляет курс, если он изменился', async () => {
    setExchangeRateSource(fakeSource(sample));
    await syncExchangeRates();

    setExchangeRateSource(
      fakeSource([{ currency: 'USD', rateMinor: 800_000, date: day }]),
    );
    await syncExchangeRates();

    const usd = await db.exchangeRate.findFirst({ where: { currency: 'USD' } });
    expect(usd?.rateMinor).toBe(800_000);
    expect(await db.exchangeRate.count()).toBe(2);
  });

  it('курсы за разные дни живут рядом', async () => {
    setExchangeRateSource(fakeSource(sample));
    await syncExchangeRates();

    setExchangeRateSource(
      fakeSource([
        { currency: 'USD', rateMinor: 790_000, date: utcDate('2026-07-29') },
      ]),
    );
    await syncExchangeRates();

    // История нужна, чтобы пересчёт прошлых периодов был воспроизводим
    expect(await db.exchangeRate.count()).toBe(3);
  });
});

describe('деградация', () => {
  it('ошибка источника пробрасывается, а не глотается молча', async () => {
    setExchangeRateSource({
      id: 'cbr',
      supportedCurrencies: ['RUB', 'USD', 'EUR', 'KZT', 'BYN'],
      async fetchRates() {
        throw new Error('источник недоступен');
      },
    });

    // Молча проглоченная ошибка означала бы, что курсы тихо устарели
    // и никто об этом не узнал
    await expect(syncExchangeRates()).rejects.toThrow(/недоступен/);
  });

  it('падение загрузки не портит уже сохранённые курсы', async () => {
    setExchangeRateSource(fakeSource(sample));
    await syncExchangeRates();

    setExchangeRateSource({
      id: 'cbr',
      supportedCurrencies: ['RUB', 'USD', 'EUR', 'KZT', 'BYN'],
      async fetchRates() {
        throw new Error('источник недоступен');
      },
    });

    await expect(syncExchangeRates()).rejects.toThrow();

    // Последний известный курс на месте — на нём и работает деградация
    expect(await db.exchangeRate.count()).toBe(2);
  });
});

describe('проверка наличия курсов на сегодня', () => {
  it('видит сохранённые за сегодня', async () => {
    setExchangeRateSource(fakeSource(sample));
    await syncExchangeRates();

    expect(await hasTodayRates(day)).toBe(true);
  });

  it('вчерашние за сегодняшние не считает', async () => {
    setExchangeRateSource(fakeSource(sample));
    await syncExchangeRates();

    expect(await hasTodayRates(utcDate('2026-07-29'))).toBe(false);
  });
});
