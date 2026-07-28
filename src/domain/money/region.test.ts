import { describe, expect, it } from 'vitest';
import {
  FALLBACK_CURRENCY,
  currencyForRegion,
  regionForTimezone,
  regionFromLocale,
  resolveRegion,
} from './region';

/**
 * Валюта по региону — FR-08.
 *
 * Правило, ради которого всё затевалось: человеку из Казахстана
 * не нужно каждый раз менять RUB на KZT.
 */

describe('валюта по региону', () => {
  it('поддерживаемые регионы дают свою валюту', () => {
    expect(currencyForRegion('RU')).toBe('RUB');
    expect(currencyForRegion('KZ')).toBe('KZT');
    expect(currencyForRegion('BY')).toBe('BYN');
    expect(currencyForRegion('US')).toBe('USD');
  });

  it('зона евро даёт EUR', () => {
    expect(currencyForRegion('DE')).toBe('EUR');
    expect(currencyForRegion('FR')).toBe('EUR');
    expect(currencyForRegion('EE')).toBe('EUR');
  });

  it('регистр и пробелы не мешают', () => {
    expect(currencyForRegion(' kz ')).toBe('KZT');
  });

  it('регион с неподдерживаемой валютой даёт USD', () => {
    // Гривна и сум пока не поддерживаются: показать валюту,
    // в которой мы не умеем считать итоги, хуже, чем предложить доллар
    expect(currencyForRegion('UA')).toBe(FALLBACK_CURRENCY);
    expect(currencyForRegion('UZ')).toBe(FALLBACK_CURRENCY);
    expect(currencyForRegion('GB')).toBe(FALLBACK_CURRENCY);
  });

  it('неизвестный регион даёт USD', () => {
    expect(currencyForRegion(null)).toBe('USD');
    expect(currencyForRegion(undefined)).toBe('USD');
    expect(currencyForRegion('')).toBe('USD');
    expect(currencyForRegion('ZZ')).toBe('USD');
  });
});

describe('регион по часовому поясу', () => {
  it('российские зоны распознаются', () => {
    expect(regionForTimezone('Europe/Moscow')).toBe('RU');
    expect(regionForTimezone('Asia/Novosibirsk')).toBe('RU');
    expect(regionForTimezone('Asia/Kamchatka')).toBe('RU');
    expect(regionForTimezone('Europe/Kaliningrad')).toBe('RU');
  });

  it('казахстанские и белорусские зоны распознаются', () => {
    // «Asia/Omsk» это Россия, а «Asia/Almaty» — Казахстан:
    // по названию зоны страну не вывести, отсюда явный список
    expect(regionForTimezone('Asia/Almaty')).toBe('KZ');
    expect(regionForTimezone('Asia/Aqtobe')).toBe('KZ');
    expect(regionForTimezone('Europe/Minsk')).toBe('BY');
  });

  it('незнакомая зона региона не даёт', () => {
    expect(regionForTimezone('America/New_York')).toBeNull();
    expect(regionForTimezone(null)).toBeNull();
  });
});

describe('регион по локали', () => {
  it('берёт региональную часть', () => {
    expect(regionFromLocale('ru-RU')).toBe('RU');
    expect(regionFromLocale('en-US')).toBe('US');
    expect(regionFromLocale('kk_KZ')).toBe('KZ');
  });

  it('локаль без региона региона не даёт', () => {
    expect(regionFromLocale('ru')).toBeNull();
    expect(regionFromLocale('en')).toBeNull();
    expect(regionFromLocale(null)).toBeNull();
  });
});

describe('определение региона устройства', () => {
  it('часовой пояс важнее языка', () => {
    // Человек в Алматы вполне может держать интерфейс на русском.
    // По языку он получил бы рубли вместо тенге
    expect(
      resolveRegion({ timezone: 'Asia/Almaty', locale: 'ru-RU' }),
    ).toBe('KZ');
  });

  it('язык подхватывается, когда зона незнакома', () => {
    expect(
      resolveRegion({ timezone: 'America/New_York', locale: 'en-US' }),
    ).toBe('US');
  });

  it('без данных региона нет', () => {
    expect(resolveRegion({})).toBeNull();
    expect(resolveRegion({ timezone: null, locale: null })).toBeNull();
  });

  it('весь путь: зона → регион → валюта', () => {
    const cases: Array<[string, string]> = [
      ['Europe/Moscow', 'RUB'],
      ['Asia/Almaty', 'KZT'],
      ['Europe/Minsk', 'BYN'],
      ['Europe/Berlin', 'USD'], // зоны нет в списке, локали нет → запасной
    ];

    for (const [timezone, expected] of cases) {
      expect(currencyForRegion(resolveRegion({ timezone })), timezone).toBe(
        expected,
      );
    }
  });
});
