import { describe, expect, it } from 'vitest';
import {
  addMonthsAnchored,
  daysUntil,
  nextOccurrenceAfter,
  occurrenceAt,
  occurrencesBetween,
} from './billing-cycle';
import type { BillingCycle } from './types';

/**
 * Даты списаний — docs/07-testing-strategy.md, раздел 3.2.
 *
 * Все даты заданы ЯВНО. Использование new Date() сделало бы тест
 * зависимым от дня запуска — он ломался бы 31 числа и в високосный год.
 */

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

const monthly: BillingCycle = { period: 'monthly' };
const yearly: BillingCycle = { period: 'yearly' };
const weekly: BillingCycle = { period: 'weekly' };
const quarterly: BillingCycle = { period: 'quarterly' };

describe('якорный день месяца', () => {
  it('подписка от 31 января не «сползает» на 28 число', () => {
    // Главный инвариант: якорь — исходный день (31), а не предыдущая
    // вычисленная дата. Иначе после февраля расписание навсегда
    // застревает на 28 числе.
    const anchor = utc('2026-01-31');

    expect(iso(occurrenceAt(anchor, monthly, 1))).toBe('2026-02-28');
    expect(iso(occurrenceAt(anchor, monthly, 2))).toBe('2026-03-31');
    expect(iso(occurrenceAt(anchor, monthly, 3))).toBe('2026-04-30');
    expect(iso(occurrenceAt(anchor, monthly, 4))).toBe('2026-05-31');
  });

  it('в високосный год февраль получает 29 число', () => {
    const anchor = utc('2028-01-31');
    expect(iso(occurrenceAt(anchor, monthly, 1))).toBe('2028-02-29');
    expect(iso(occurrenceAt(anchor, monthly, 2))).toBe('2028-03-31');
  });

  it('подписка от 30 числа корректно проходит февраль', () => {
    const anchor = utc('2026-01-30');
    expect(iso(occurrenceAt(anchor, monthly, 1))).toBe('2026-02-28');
    expect(iso(occurrenceAt(anchor, monthly, 2))).toBe('2026-03-30');
  });

  it('обычная дата не меняется', () => {
    const anchor = utc('2026-03-15');
    expect(iso(occurrenceAt(anchor, monthly, 1))).toBe('2026-04-15');
    expect(iso(occurrenceAt(anchor, monthly, 6))).toBe('2026-09-15');
  });
});

describe('годовой период', () => {
  it('29 февраля в невисокосный год становится 28 февраля', () => {
    const anchor = utc('2028-02-29');
    expect(iso(occurrenceAt(anchor, yearly, 1))).toBe('2029-02-28');
    // Якорь сохраняется: через 4 года снова 29 февраля
    expect(iso(occurrenceAt(anchor, yearly, 4))).toBe('2032-02-29');
  });

  it('переход через год', () => {
    const anchor = utc('2026-12-31');
    expect(iso(occurrenceAt(anchor, yearly, 1))).toBe('2027-12-31');
  });
});

describe('периоды в днях', () => {
  it('еженедельный период добавляет 7 дней', () => {
    const anchor = utc('2026-07-27');
    expect(iso(occurrenceAt(anchor, weekly, 1))).toBe('2026-08-03');
    expect(iso(occurrenceAt(anchor, weekly, 5))).toBe('2026-08-31');
  });

  it('custom с periodDays = 45', () => {
    const cycle: BillingCycle = { period: 'custom', periodDays: 45 };
    const anchor = utc('2026-01-01');
    expect(iso(occurrenceAt(anchor, cycle, 1))).toBe('2026-02-15');
  });

  it('custom без periodDays — ошибка, а не молчаливый неверный расчёт', () => {
    const cycle: BillingCycle = { period: 'custom' };
    expect(() => occurrenceAt(utc('2026-01-01'), cycle, 1)).toThrow(/periodDays/);
  });
});

describe('nextOccurrenceAfter', () => {
  it('возвращает сам anchor, если он ещё не наступил', () => {
    const anchor = utc('2026-09-01');
    expect(iso(nextOccurrenceAfter(anchor, monthly, utc('2026-08-15')))).toBe(
      '2026-09-01',
    );
  });

  it('находит ближайшее списание строго после указанной даты', () => {
    const anchor = utc('2026-01-31');
    expect(iso(nextOccurrenceAfter(anchor, monthly, utc('2026-02-28')))).toBe(
      '2026-03-31',
    );
  });

  it('корректно работает при большом разрыве во времени', () => {
    const anchor = utc('2020-01-31');
    expect(iso(nextOccurrenceAfter(anchor, monthly, utc('2026-07-27')))).toBe(
      '2026-07-31',
    );
  });

  it('квартальный период', () => {
    const anchor = utc('2026-01-15');
    expect(iso(nextOccurrenceAfter(anchor, quarterly, utc('2026-05-01')))).toBe(
      '2026-07-15',
    );
  });
});

describe('occurrencesBetween', () => {
  it('возвращает все списания в интервале', () => {
    const anchor = utc('2026-01-15');
    const dates = occurrencesBetween(
      anchor,
      monthly,
      utc('2026-02-01'),
      utc('2026-05-01'),
    );

    expect(dates.map(iso)).toEqual(['2026-02-15', '2026-03-15', '2026-04-15']);
  });

  it('пустой интервал даёт пустой список', () => {
    const anchor = utc('2026-01-15');
    expect(
      occurrencesBetween(anchor, monthly, utc('2026-05-01'), utc('2026-05-01')),
    ).toEqual([]);
  });
});

describe('addMonthsAnchored', () => {
  it('сохраняет время суток', () => {
    const anchor = new Date('2026-01-31T14:30:00.000Z');
    const result = addMonthsAnchored(anchor, 1);

    expect(result.toISOString()).toBe('2026-02-28T14:30:00.000Z');
  });
});

describe('daysUntil', () => {
  it('считает целые дни между датами', () => {
    expect(daysUntil(utc('2026-07-27'), utc('2026-07-30'))).toBe(3);
    expect(daysUntil(utc('2026-07-27'), utc('2026-07-27'))).toBe(0);
    expect(daysUntil(utc('2026-07-30'), utc('2026-07-27'))).toBe(-3);
  });

  it('не зависит от времени суток', () => {
    const from = new Date('2026-07-27T23:59:00.000Z');
    const to = new Date('2026-07-28T00:01:00.000Z');
    expect(daysUntil(from, to)).toBe(1);
  });
});
