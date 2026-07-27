import { describe, expect, it } from 'vitest';
import { money } from '@/domain/money';
import { chargesPerYear, monthlyCost, yearlyCost } from './cost';
import type { BillingCycle } from '@/domain/billing-cycle';

/**
 * Нормализация стоимости — docs/07-testing-strategy.md, раздел 3.1.
 *
 * Контр-метрика продукта: если итоги на дашборде не сходятся,
 * пользователь перестаёт верить всем цифрам сразу.
 */

const monthly: BillingCycle = { period: 'monthly' };
const yearly: BillingCycle = { period: 'yearly' };
const quarterly: BillingCycle = { period: 'quarterly' };
const weekly: BillingCycle = { period: 'weekly' };

describe('месячная стоимость', () => {
  it('месячная подписка остаётся собой', () => {
    expect(monthlyCost(money(39_900, 'RUB'), monthly).minor).toBe(39_900);
  });

  it('годовая делится на 12', () => {
    // 3990 ₽ в год = 332,50 ₽ в месяц
    expect(monthlyCost(money(399_000, 'RUB'), yearly).minor).toBe(33_250);
  });

  it('квартальная делится на 3', () => {
    expect(monthlyCost(money(90_000, 'RUB'), quarterly).minor).toBe(30_000);
  });

  it('недельная считается по 365,25 дня, а не по 52 неделям', () => {
    // 100 ₽ в неделю: 100 × 52,178… / 12 = 434,82 ₽
    // Расчёт по 52 неделям дал бы 433,33 ₽ — недобор почти на неделю в год
    expect(monthlyCost(money(10_000, 'RUB'), weekly).minor).toBe(43_482);
  });

  it('произвольный период в днях', () => {
    const cycle: BillingCycle = { period: 'custom', periodDays: 30 };
    // 300 ₽ каждые 30 дней = 304,38 ₽ в месяц
    expect(monthlyCost(money(30_000, 'RUB'), cycle).minor).toBe(30_438);
  });
});

describe('годовая стоимость', () => {
  it('месячная умножается на 12', () => {
    expect(yearlyCost(money(39_900, 'RUB'), monthly).minor).toBe(478_800);
  });

  it('годовая остаётся собой', () => {
    expect(yearlyCost(money(399_000, 'RUB'), yearly).minor).toBe(399_000);
  });

  it('квартальная умножается на 4', () => {
    expect(yearlyCost(money(90_000, 'RUB'), quarterly).minor).toBe(360_000);
  });
});

describe('согласованность месяца и года', () => {
  it('месячная стоимость × 12 близка к годовой для любого периода', () => {
    // Пользователь видит обе цифры одновременно. Расхождение больше
    // рубля он заметит и посчитает ошибкой.
    const cases: Array<[string, BillingCycle]> = [
      ['weekly', weekly],
      ['monthly', monthly],
      ['quarterly', quarterly],
      ['yearly', yearly],
      ['custom-45', { period: 'custom', periodDays: 45 }],
    ];

    for (const [name, cycle] of cases) {
      const amount = money(39_900, 'RUB');
      const perMonth = monthlyCost(amount, cycle).minor;
      const perYear = yearlyCost(amount, cycle).minor;

      expect(Math.abs(perMonth * 12 - perYear), name).toBeLessThanOrEqual(100);
    }
  });
});

describe('защита от некорректных данных', () => {
  it('custom без periodDays — ошибка, а не молчаливый ноль', () => {
    expect(() => chargesPerYear({ period: 'custom' })).toThrow(/periodDays/);
  });

  it('custom с нулём дней отклоняется', () => {
    expect(() => chargesPerYear({ period: 'custom', periodDays: 0 })).toThrow(
      /periodDays/,
    );
  });
});
