import type { CurrencyCode, ExchangeRate } from '@/domain/money';

/**
 * Источник курсов валют — FR-08.
 *
 * ИНВАРИАНТ: недоступность источника не блокирует приложение.
 * Используется последний известный курс, ответ помечается isStale,
 * и интерфейс это показывает (NFR-05).
 */
export interface ExchangeRateSource {
  readonly id: 'cbr';

  /** Курсы на дату. Источник ЦБ РФ обновляется раз в сутки */
  fetchRates(date: Date): Promise<ExchangeRate[]>;

  readonly supportedCurrencies: readonly CurrencyCode[];
}
