import type { CurrencyCode } from '@/domain/money';

/**
 * Источник данных о подписках — FR-10.
 *
 * ИНВАРИАНТ: ни один источник НЕ создаёт Subscription. Он возвращает
 * только кандидатов, каждого из которых подтверждает пользователь.
 * Это защита от ложных срабатываний: одна неверно созданная подписка
 * обесценивает все цифры на дашборде.
 */

export type ImportSourceId = 'csv' | 'email' | 'bank';

export type ImportConnection = {
  readonly id: string;
  readonly userId: string;
  readonly source: ImportSourceId;
  readonly status: 'active' | 'expired' | 'revoked' | 'error';
};

export type ImportCandidate = {
  /** Как выглядело в источнике: "YM*PLUS 399.00" */
  readonly rawLabel: string;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly occurredAt: Date;
  /** Предположение о сервисе. Требует подтверждения пользователем */
  readonly guessedServiceId: string | null;
  /** 0..1 — насколько уверены в распознавании */
  readonly confidence: number;
};

export interface ImportSource {
  readonly id: ImportSourceId;
  /** Тариф, требуемый для этого источника. Проверяется на сервере */
  readonly requiredPlan: 'free' | 'pro';

  /** Подключение источника. Требует явного согласия пользователя */
  connect(userId: string, payload: unknown): Promise<ImportConnection>;

  /** Возвращает КАНДИДАТОВ. Никогда не создаёт подписки сам */
  scan(connection: ImportConnection): Promise<ImportCandidate[]>;

  /** Отзыв доступа. Обязан очистить сохранённые токены */
  disconnect(connection: ImportConnection): Promise<void>;
}
