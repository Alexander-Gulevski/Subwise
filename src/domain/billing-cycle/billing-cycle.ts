import { MONTHS_IN_PERIOD, type BillingCycle } from './types';

/**
 * Расчёт дат списаний.
 *
 * ГЛАВНЫЙ ИНВАРИАНТ — якорный день месяца.
 *
 * Все даты вычисляются от исходной даты подписки (anchor), а НЕ от
 * предыдущей вычисленной даты. Разница видна на подписке от 31 числа:
 *
 *   правильно:  31 янв → 28 фев → 31 мар → 30 апр → 31 мая
 *   неправильно: 31 янв → 28 фев → 28 мар → 28 апр  (дата «сползла»)
 *
 * Второй вариант — классический баг подписочных сервисов: пользователь
 * теряет три дня в месяц, и через год расписание не имеет отношения
 * к реальным списаниям.
 *
 * Все даты — UTC. Часовой пояс применяется только при отображении.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Защита от зацикливания при некорректных входных данных */
const MAX_ITERATIONS = 1_000;

/**
 * N-е списание, считая от исходной даты.
 * occurrence(anchor, cycle, 0) === anchor
 */
export function occurrenceAt(
  anchor: Date,
  cycle: BillingCycle,
  n: number,
): Date {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Номер списания должен быть целым неотрицательным, получено ${n}`);
  }
  if (n === 0) return new Date(anchor.getTime());

  const months = MONTHS_IN_PERIOD[cycle.period];

  if (months !== null) {
    return addMonthsAnchored(anchor, months * n);
  }

  const stepDays = stepInDays(cycle);
  return new Date(anchor.getTime() + stepDays * n * DAY_MS);
}

/**
 * Ближайшее списание строго после указанной даты.
 * Если anchor ещё не наступил — вернётся сам anchor.
 */
export function nextOccurrenceAfter(
  anchor: Date,
  cycle: BillingCycle,
  after: Date,
): Date {
  let n = estimateOccurrenceIndex(anchor, cycle, after);

  let guard = 0;
  while (occurrenceAt(anchor, cycle, n).getTime() <= after.getTime()) {
    n += 1;
    if (++guard > MAX_ITERATIONS) {
      throw new Error('Не удалось вычислить дату списания: проверь период подписки');
    }
  }

  // Оценка могла перелететь — откатываемся к первому подходящему.
  guard = 0;
  while (n > 0 && occurrenceAt(anchor, cycle, n - 1).getTime() > after.getTime()) {
    n -= 1;
    if (++guard > MAX_ITERATIONS) break;
  }

  return occurrenceAt(anchor, cycle, n);
}

/**
 * Все списания в интервале (from, to]. Используется планировщиком
 * и прогнозом расходов.
 */
export function occurrencesBetween(
  anchor: Date,
  cycle: BillingCycle,
  from: Date,
  to: Date,
): Date[] {
  const result: Date[] = [];
  if (to.getTime() <= from.getTime()) return result;

  let current = nextOccurrenceAfter(anchor, cycle, from);
  let guard = 0;

  while (current.getTime() <= to.getTime()) {
    result.push(current);
    current = nextOccurrenceAfter(anchor, cycle, current);
    if (++guard > MAX_ITERATIONS) {
      throw new Error('Слишком много списаний в интервале: проверь период подписки');
    }
  }

  return result;
}

/**
 * Прибавляет месяцы, сохраняя якорный день.
 *
 * Если в целевом месяце нет такого дня (31 февраля не существует),
 * берётся последний день месяца. Якорь при этом НЕ меняется —
 * следующий расчёт снова отталкивается от исходного дня.
 */
export function addMonthsAnchored(anchor: Date, months: number): Date {
  const anchorDay = anchor.getUTCDate();

  const target = new Date(
    Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth() + months,
      1,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  );

  const lastDay = daysInMonth(target.getUTCFullYear(), target.getUTCMonth());
  target.setUTCDate(Math.min(anchorDay, lastDay));

  return target;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Целых дней от `from` до `to`. Отрицательное значение — дата в прошлом. */
export function daysUntil(from: Date, to: Date): number {
  const fromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toDay - fromDay) / DAY_MS);
}

function stepInDays(cycle: BillingCycle): number {
  if (cycle.period === 'weekly') return 7;

  if (cycle.period === 'custom') {
    const days = cycle.periodDays;
    if (!days || !Number.isInteger(days) || days <= 0) {
      throw new Error(
        'Для периода custom требуется periodDays — целое положительное число дней',
      );
    }
    return days;
  }

  throw new Error(`Период ${cycle.period} считается в месяцах, не в днях`);
}

/** Грубая оценка номера списания — чтобы не итерировать с нуля. */
function estimateOccurrenceIndex(
  anchor: Date,
  cycle: BillingCycle,
  after: Date,
): number {
  if (after.getTime() <= anchor.getTime()) return 0;

  const months = MONTHS_IN_PERIOD[cycle.period];

  if (months !== null) {
    const monthsDiff =
      (after.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
      (after.getUTCMonth() - anchor.getUTCMonth());
    return Math.max(0, Math.floor(monthsDiff / months));
  }

  const stepMs = stepInDays(cycle) * DAY_MS;
  return Math.max(0, Math.floor((after.getTime() - anchor.getTime()) / stepMs));
}
