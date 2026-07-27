/**
 * Состояния подписки и допустимые переходы — docs/03-data-model.md.
 *
 * Главный инвариант (ADR-0002): в `cancelled` можно попасть ТОЛЬКО
 * через CancellationProvider.confirm(). Здесь описано, какие переходы
 * возможны в принципе; кто именно вправе их инициировать — проверяется
 * в server/services.
 */

export type SubscriptionStatus =
  | 'active'
  | 'trial'
  | 'paused'
  | 'cancelled'
  | 'expired';

/** Кто инициирует переход. Различие важно для аудита и для запретов. */
export type TransitionActor =
  | 'user'
  /** Фоновая задача по наступлению даты */
  | 'system'
  /** Только CancellationProvider.confirm() */
  | 'cancellation-provider';

type Transition = {
  readonly from: SubscriptionStatus;
  readonly to: SubscriptionStatus;
  readonly actor: TransitionActor;
};

const TRANSITIONS: readonly Transition[] = [
  // Триал заканчивается — фоновая задача переводит в платную
  { from: 'trial', to: 'active', actor: 'system' },
  { from: 'trial', to: 'cancelled', actor: 'cancellation-provider' },
  { from: 'trial', to: 'paused', actor: 'user' },

  { from: 'active', to: 'paused', actor: 'user' },
  { from: 'active', to: 'cancelled', actor: 'cancellation-provider' },

  { from: 'paused', to: 'active', actor: 'user' },
  { from: 'paused', to: 'cancelled', actor: 'cancellation-provider' },

  // Оплаченный период закончился после отмены
  { from: 'cancelled', to: 'expired', actor: 'system' },
] as const;

export function canTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
  actor: TransitionActor,
): boolean {
  return TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.actor === actor,
  );
}

/**
 * Проверяет переход и бросает осмысленную ошибку.
 * Вызывается в server/services перед записью статуса.
 */
export function assertTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
  actor: TransitionActor,
): void {
  if (canTransition(from, to, actor)) return;

  const allowedActor = TRANSITIONS.find((t) => t.from === from && t.to === to);

  if (allowedActor) {
    throw new Error(
      `Переход ${from} → ${to} допустим только для «${allowedActor.actor}», ` +
        `а инициатор — «${actor}». См. ADR-0002`,
    );
  }

  throw new Error(`Переход ${from} → ${to} невозможен`);
}

/** Учитывается ли подписка в расчёте расходов. Пауза — не учитывается. */
export function countsTowardSpending(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trial';
}

/** Генерируются ли для подписки события списаний и напоминания. */
export function generatesBillingEvents(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trial';
}

/** Финальные состояния — выхода из них нет. */
export function isTerminal(status: SubscriptionStatus): boolean {
  return status === 'expired';
}
