/**
 * Способ отменить подписку — ADR-0002.
 *
 * Центральная абстракция проекта. В MVP единственная реализация —
 * GuideCancellationProvider (пошаговая инструкция). Виртуальные карты
 * и автоматизация добавляются как новые реализации, без изменений
 * в экранах и сервисах.
 *
 * ИНВАРИАНТ: подписка переходит в статус `cancelled` только через
 * confirm(). Прямая запись статуса из любого другого места запрещена.
 */

export type CancellationKind = 'guide' | 'virtual-card' | 'automated';

export type CancellationStep = {
  readonly order: number;
  readonly title: string;
  readonly description: string;
  readonly imageUrl?: string;
};

export type CancellationFlow = {
  readonly flowId: string;
  readonly kind: CancellationKind;
  readonly steps: readonly CancellationStep[];
  /** Прямая ссылка в раздел управления подпиской, не на главную сервиса */
  readonly deepLink: string | null;
  /**
   * Показываются ДО шагов — например, «доступ сохранится до конца
   * оплаченного периода». Скрывать их нельзя (docs/05-ux-flows.md).
   */
  readonly warnings: readonly string[];
  /** Дата последней проверки инструкции. Пользователь должен её видеть */
  readonly guideCheckedAt: Date | null;
};

export type CancellationOutcome =
  | 'succeeded'
  | 'failed'
  | 'postponed'
  | 'guide_outdated';

export type CancellationResult = {
  readonly outcome: CancellationOutcome;
  /** Заполняется только при 'succeeded' */
  readonly accessUntil: Date | null;
  /** Что предложить пользователю дальше при 'failed' */
  readonly alternatives: readonly ('pause' | 'remind-later' | 'report-guide')[];
};

/** Минимум, который провайдеру нужно знать о подписке */
export type CancellableSubscription = {
  readonly id: string;
  readonly serviceId: string | null;
  readonly customName: string | null;
  readonly nextBillingAt: Date | null;
};

export interface CancellationProvider {
  readonly kind: CancellationKind;

  /** Может ли провайдер отменить подписку этого сервиса */
  supports(serviceId: string | null): Promise<boolean>;

  /** Начинает отмену: возвращает шаги гида либо статус автоматической отмены */
  start(subscription: CancellableSubscription): Promise<CancellationFlow>;

  /**
   * Завершает отмену.
   * Для гида outcome приходит от пользователя («получилось?»),
   * для автоматизации — от результата выполнения.
   */
  confirm(
    flowId: string,
    outcome: CancellationOutcome,
    note?: string,
  ): Promise<CancellationResult>;
}
