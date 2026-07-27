import { describe, expect, it } from 'vitest';
import { add, convert, money, multiply, sum, zero } from './money';
import { formatMoney, parseMinor } from './format';
import type { ExchangeRate } from './types';

/**
 * Деньги — docs/07-testing-strategy.md, раздел 3.1.
 *
 * Проверяем то, ради чего выбраны минорные единицы: отсутствие
 * потерь при сложении и корректность округления только на выходе.
 */

const rateUsd: ExchangeRate = {
  currency: 'USD',
  rateMinor: 784_521, // 78,4521 ₽ за доллар
  date: new Date('2026-07-27T00:00:00.000Z'),
};

describe('создание', () => {
  it('дробные минорные единицы — ошибка, а не тихое округление', () => {
    expect(() => money(399.5, 'RUB')).toThrow(/целым числом/);
  });

  it('ноль', () => {
    expect(zero('RUB')).toEqual({ minor: 0, currency: 'RUB' });
  });
});

describe('арифметика', () => {
  it('сумма частей равна целому — потерь копеек нет', () => {
    // Классический случай, на котором float даёт 0.30000000000000004
    const a = money(10, 'RUB'); // 0,10 ₽
    const b = money(20, 'RUB'); // 0,20 ₽
    expect(add(a, b).minor).toBe(30);
  });

  it('суммирование списка подписок', () => {
    const items = [
      money(39_900, 'RUB'), // 399 ₽
      money(29_900, 'RUB'), // 299 ₽
      money(19_900, 'RUB'), // 199 ₽
    ];
    expect(sum(items, 'RUB')).toEqual({ minor: 89_700, currency: 'RUB' });
  });

  it('разные валюты складывать нельзя без пересчёта', () => {
    expect(() => add(money(100, 'RUB'), money(100, 'USD'))).toThrow(
      /без пересчёта/,
    );
  });

  it('годовая стоимость месячной подписки', () => {
    expect(multiply(money(39_900, 'RUB'), 12).minor).toBe(478_800);
  });
});

describe('конвертация', () => {
  it('та же валюта возвращается без изменений', () => {
    const result = convert(money(39_900, 'RUB'), 'RUB', {});
    expect(result.minor).toBe(39_900);
  });

  it('USD в RUB по курсу ЦБ', () => {
    // 10,99 $ × 78,4521 = 862,19 ₽
    const result = convert(money(1099, 'USD'), 'RUB', { from: rateUsd });
    expect(result.minor).toBe(86_219);
    expect(result.currency).toBe('RUB');
  });

  it('обратная конвертация RUB в USD', () => {
    const result = convert(money(86_219, 'RUB'), 'USD', { to: rateUsd });
    expect(result.minor).toBe(1099);
  });

  it('без курса конвертация падает, а не выдаёт неверное число', () => {
    expect(() => convert(money(1099, 'USD'), 'RUB', {})).toThrow(/Нет курса/);
  });

  it('устаревший курс помечается — интерфейс обязан это показать', () => {
    const result = convert(money(1099, 'USD'), 'RUB', { from: rateUsd }, { isStale: true });
    expect(result.isStale).toBe(true);
    expect(result.rateDate).toEqual(rateUsd.date);
  });
});

describe('форматирование', () => {
  it('круглая сумма выводится без копеек', () => {
    // «399 ₽» читается лучше, чем «399,00 ₽»
    expect(formatMoney(money(39_900, 'RUB'))).toMatch(/^399\s?₽$/u);
  });

  it('дробная сумма показывает копейки', () => {
    expect(formatMoney(money(39_950, 'RUB'))).toMatch(/399,50/u);
  });

  it('доллары форматируются в русской локали', () => {
    expect(formatMoney(money(1099, 'USD'))).toMatch(/10,99/u);
  });
});

describe('разбор ввода', () => {
  it('принимает запятую и пробелы', () => {
    expect(parseMinor('399,50', 2)).toBe(39_950);
    expect(parseMinor('1 299', 2)).toBe(129_900);
  });

  it('отклоняет мусор и неположительные значения', () => {
    expect(parseMinor('abc', 2)).toBeNull();
    expect(parseMinor('0', 2)).toBeNull();
    expect(parseMinor('-100', 2)).toBeNull();
  });
});
