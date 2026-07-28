import { describe, expect, it } from 'vitest';
import { parseCbrResponse } from './cbr-source';

/**
 * Разбор ответа ЦБ РФ — FR-08.
 *
 * Главное, что здесь проверяется: учёт поля Nominal. ЦБ котирует
 * доллар за 1 единицу, а тенге за 100 — без деления тенге оказался бы
 * дороже доллара в сто раз, и итоги на дашборде стали бы абсурдными.
 */

const response = {
  Date: '2026-07-28T11:30:00+03:00',
  Valute: {
    USD: { CharCode: 'USD', Nominal: 1, Value: 78.4521 },
    EUR: { CharCode: 'EUR', Nominal: 1, Value: 85.2 },
    KZT: { CharCode: 'KZT', Nominal: 100, Value: 15.6 },
    BYN: { CharCode: 'BYN', Nominal: 1, Value: 24.5 },
    // Валюта, которую мы не поддерживаем — должна быть проигнорирована
    JPY: { CharCode: 'JPY', Nominal: 100, Value: 52.1 },
  },
};

function rateFor(code: string, payload: unknown = response) {
  return parseCbrResponse(payload).find((rate) => rate.currency === code);
}

describe('пересчёт котировок', () => {
  it('валюта за одну единицу берётся как есть', () => {
    // 78,4521 ₽ за доллар × 10000
    expect(rateFor('USD')?.rateMinor).toBe(784_521);
  });

  it('валюта за сто единиц делится на номинал', () => {
    // 15,6 ₽ за 100 тенге → 0,156 ₽ за тенге × 10000 = 1560.
    // Без деления вышло бы 156 000 — тенге дороже доллара вдвое
    expect(rateFor('KZT')?.rateMinor).toBe(1_560);
  });

  it('белорусский рубль', () => {
    expect(rateFor('BYN')?.rateMinor).toBe(245_000);
  });

  it('порядок величин осмысленный: доллар дороже тенге', () => {
    const usd = rateFor('USD')?.rateMinor ?? 0;
    const kzt = rateFor('KZT')?.rateMinor ?? 0;
    expect(usd).toBeGreaterThan(kzt * 100);
  });
});

describe('состав выдачи', () => {
  it('рубль не попадает в курсы — он база', () => {
    expect(rateFor('RUB')).toBeUndefined();
  });

  it('неподдерживаемые валюты игнорируются', () => {
    const codes = parseCbrResponse(response).map((rate) => rate.currency);
    expect(codes).not.toContain('JPY');
    expect(codes.sort()).toEqual(['BYN', 'EUR', 'KZT', 'USD']);
  });

  it('отсутствие валюты не роняет разбор остальных', () => {
    const partial = {
      Date: response.Date,
      Valute: { USD: response.Valute.USD },
    };

    const rates = parseCbrResponse(partial);
    expect(rates).toHaveLength(1);
    expect(rates[0]?.currency).toBe('USD');
  });
});

describe('дата курса', () => {
  it('берётся календарный день, а не момент публикации', () => {
    // Курс действует на дату, а не на минуту
    expect(rateFor('USD')?.date.toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('публикация поздним вечером по Москве не уезжает на предыдущий день', () => {
    const late = {
      Date: '2026-07-28T23:30:00+03:00',
      Valute: { USD: response.Valute.USD },
    };

    expect(rateFor('USD', late)?.date.toISOString()).toBe(
      '2026-07-28T00:00:00.000Z',
    );
  });
});

describe('защита от мусора', () => {
  it('неожиданный формат отклоняется с понятной ошибкой', () => {
    expect(() => parseCbrResponse({ foo: 'bar' })).toThrow(/формат/);
    expect(() => parseCbrResponse(null)).toThrow(/формат/);
  });

  it('нулевой номинал отклоняется, а не даёт деление на ноль', () => {
    const broken = {
      Date: response.Date,
      Valute: { USD: { CharCode: 'USD', Nominal: 0, Value: 78 } },
    };

    expect(() => parseCbrResponse(broken)).toThrow(/формат/);
  });

  it('некорректная дата отклоняется', () => {
    const broken = { Date: 'не дата', Valute: { USD: response.Valute.USD } };
    expect(() => parseCbrResponse(broken)).toThrow(/дату/);
  });
});
