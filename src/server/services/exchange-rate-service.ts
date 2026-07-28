import { CbrExchangeRateSource } from '@/adapters/exchange-rate/cbr/cbr-source';
import type { ExchangeRate } from '@/domain/money';
import type { ExchangeRateSource } from '@/ports/ExchangeRateSource';
import { db } from '@/server/db';

/**
 * Загрузка курсов валют — FR-08.
 *
 * Запускается раз в сутки. Идемпотентна: повторный вызов за тот же
 * день перезаписывает те же строки, а не плодит дубли — это гарантирует
 * уникальный индекс (currency, date) в схеме (NFR-05).
 */

let source: ExchangeRateSource | null = null;

function getSource(): ExchangeRateSource {
  if (!source) source = new CbrExchangeRateSource();
  return source;
}

/** Подмена источника в тестах: сеть в них запрещена (docs/07, раздел 5) */
export function setExchangeRateSource(custom: ExchangeRateSource | null): void {
  source = custom;
}

export type SyncResult = {
  saved: number;
  date: Date | null;
};

export async function syncExchangeRates(): Promise<SyncResult> {
  const rates = await getSource().fetchRates(new Date());

  if (rates.length === 0) return { saved: 0, date: null };

  await persist(rates);

  return { saved: rates.length, date: rates[0]?.date ?? null };
}

async function persist(rates: ExchangeRate[]): Promise<void> {
  await db.$transaction(
    rates.map((rate) =>
      db.exchangeRate.upsert({
        where: {
          currency_date: { currency: rate.currency, date: rate.date },
        },
        update: { rateMinor: rate.rateMinor },
        create: {
          currency: rate.currency,
          date: rate.date,
          rateMinor: rate.rateMinor,
          source: 'cbr',
        },
      }),
    ),
  );
}

/**
 * Есть ли курс на сегодня.
 *
 * Нужно, чтобы не дёргать источник лишний раз: он и так отдаёт
 * один курс на календарный день.
 */
export async function hasTodayRates(now = new Date()): Promise<boolean> {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const count = await db.exchangeRate.count({ where: { date: today } });
  return count > 0;
}
