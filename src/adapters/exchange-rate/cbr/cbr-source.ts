import { z } from 'zod';
import {
  RATE_SCALE,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
  type ExchangeRate,
} from '@/domain/money';
import { getEnv } from '@/lib/env';
import type { ExchangeRateSource } from '@/ports/ExchangeRateSource';

/**
 * Курсы валют из открытого зеркала ЦБ РФ — FR-08.
 *
 * ГЛАВНАЯ ТОНКОСТЬ: ЦБ котирует валюты за разное число единиц.
 * Доллар — за 1, тенге — за 100, донг — за 10 000. Поле Nominal
 * несёт это число, и без деления на него тенге оказался бы дороже
 * доллара в сто раз.
 */

const valuteSchema = z.object({
  CharCode: z.string(),
  Nominal: z.number().positive(),
  Value: z.number().positive(),
});

const responseSchema = z.object({
  Date: z.string(),
  Valute: z.record(z.string(), valuteSchema),
});

export type CbrResponse = z.infer<typeof responseSchema>;

export class CbrExchangeRateSource implements ExchangeRateSource {
  readonly id = 'cbr' as const;
  readonly supportedCurrencies = SUPPORTED_CURRENCIES;

  async fetchRates(): Promise<ExchangeRate[]> {
    const url = getEnv().CBR_RATES_URL;

    const response = await fetch(url, {
      // Курсы не настолько срочны, чтобы держать соединение долго:
      // лучше упасть и отработать деградацией на последний известный
      signal: AbortSignal.timeout(10_000),
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Источник курсов ответил ${response.status}`);
    }

    return parseCbrResponse(await response.json());
  }
}

/**
 * Разбор ответа.
 *
 * Вынесен отдельной чистой функцией: так формат проверяется тестом
 * без сети, а сеть в тестах у нас запрещена (docs/07, раздел 5).
 */
export function parseCbrResponse(payload: unknown): ExchangeRate[] {
  const parsed = responseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error('Источник курсов вернул неожиданный формат');
  }

  const date = toUtcDate(parsed.data.Date);
  const rates: ExchangeRate[] = [];

  for (const currency of SUPPORTED_CURRENCIES) {
    // Рубль — база, его курса к самому себе в ответе нет и не нужно
    if (currency === 'RUB') continue;

    const valute = parsed.data.Valute[currency];
    // Валюты может не оказаться в выдаче — пропускаем её, а не роняем
    // загрузку остальных
    if (!valute) continue;

    const perUnit = valute.Value / valute.Nominal;

    rates.push({
      currency: currency as CurrencyCode,
      rateMinor: Math.round(perUnit * RATE_SCALE),
      date,
    });
  }

  return rates;
}

/**
 * Дата курса без времени.
 *
 * ЦБ отдаёт момент публикации со смещением («2026-07-28T11:30:00+03:00»),
 * а хранить нужно календарный день: курс действует на дату, а не
 * на минуту. Берём день по московскому времени — это дата, которую
 * ЦБ и имеет в виду.
 */
function toUtcDate(input: string): Date {
  const parsed = new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Источник курсов вернул некорректную дату: ${input}`);
  }

  const moscow = new Date(parsed.getTime() + 3 * 60 * 60 * 1000);

  return new Date(
    Date.UTC(
      moscow.getUTCFullYear(),
      moscow.getUTCMonth(),
      moscow.getUTCDate(),
    ),
  );
}
