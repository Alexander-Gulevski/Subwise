import type { BillingCycle } from '@/domain/billing-cycle';
import { money, type Money } from '@/domain/money';

/**
 * Приведение стоимости к месяцу и году.
 *
 * Дашборд обещает ответить «сколько я плачу в месяц», а подписки
 * бывают недельные, квартальные и годовые. Без нормализации итог
 * пришлось бы считать только по фактическим списаниям месяца —
 * и он скакал бы втрое от месяца к месяцу.
 *
 * Расчёт в минорных единицах, округление — один раз, на выходе
 * (ADR-0004).
 */

/**
 * Недель в году: 365,25 / 7. Дробное значение намеренно —
 * 52 недели дают недобор почти в целую неделю за год.
 */
const WEEKS_PER_YEAR = 365.25 / 7;
const DAYS_PER_YEAR = 365.25;
const MONTHS_PER_YEAR = 12;

/** Во сколько раз годовая стоимость больше стоимости одного списания. */
export function chargesPerYear(cycle: BillingCycle): number {
  switch (cycle.period) {
    case 'weekly':
      return WEEKS_PER_YEAR;
    case 'monthly':
      return 12;
    case 'quarterly':
      return 4;
    case 'semiannual':
      return 2;
    case 'yearly':
      return 1;
    case 'custom': {
      const days = cycle.periodDays;
      if (!days || !Number.isInteger(days) || days <= 0) {
        throw new Error(
          'Для периода custom требуется periodDays — целое положительное число дней',
        );
      }
      return DAYS_PER_YEAR / days;
    }
  }
}

/** Годовая стоимость подписки. */
export function yearlyCost(amount: Money, cycle: BillingCycle): Money {
  return money(Math.round(amount.minor * chargesPerYear(cycle)), amount.currency);
}

/**
 * Месячная стоимость.
 *
 * Считается от годовой, а не отдельной формулой: так «в месяц × 12»
 * и «в год» не расходятся между собой на глазах у пользователя.
 */
export function monthlyCost(amount: Money, cycle: BillingCycle): Money {
  const perYear = amount.minor * chargesPerYear(cycle);
  return money(Math.round(perYear / MONTHS_PER_YEAR), amount.currency);
}
