import { SUPPORTED_CURRENCIES, type CurrencyCode } from './types';

/**
 * Валюта по региону пользователя — FR-08.
 *
 * Нужна, чтобы новая подписка сразу предлагала правильную валюту:
 * человеку из Казахстана незачем каждый раз менять RUB на KZT.
 *
 * Регион определяется по часовому поясу устройства, а не по GPS:
 * запрос доступа к местоположению ради выбора валюты был бы
 * несоразмерным (NFR-04) и отпугнул бы половину пользователей
 * системным диалогом.
 */

/** Запасная валюта, когда регион неизвестен или его валюта не поддержана */
export const FALLBACK_CURRENCY: CurrencyCode = 'USD';

/**
 * Регион (ISO 3166-1 alpha-2) → валюта.
 *
 * Перечислены только те регионы, чью валюту мы поддерживаем, плюс
 * зона евро. Остальные попадут в запасной вариант — это честнее,
 * чем показывать валюту, в которой мы не умеем считать итоги.
 */
const REGION_CURRENCY: Record<string, string> = {
  RU: 'RUB',
  KZ: 'KZT',
  BY: 'BYN',

  US: 'USD',

  // Зона евро
  AT: 'EUR', BE: 'EUR', HR: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR',
  FR: 'EUR', DE: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LV: 'EUR',
  LT: 'EUR', LU: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SK: 'EUR',
  SI: 'EUR', ES: 'EUR',
};

/**
 * Валюта для региона.
 *
 * Возвращает USD, если регион неизвестен или его валюты нет среди
 * поддерживаемых: например, для Украины (UAH) или Узбекистана (UZS)
 * мы пока не умеем пересчитывать итоги.
 */
export function currencyForRegion(region: string | null | undefined): CurrencyCode {
  if (!region) return FALLBACK_CURRENCY;

  const candidate = REGION_CURRENCY[region.trim().toUpperCase()];
  if (!candidate) return FALLBACK_CURRENCY;

  return (SUPPORTED_CURRENCIES as readonly string[]).includes(candidate)
    ? (candidate as CurrencyCode)
    : FALLBACK_CURRENCY;
}

/**
 * Часовые пояса России, Казахстана и Беларуси.
 *
 * Перечислены явно, потому что по названию зоны страну не вывести:
 * «Asia/Omsk» — Россия, «Asia/Almaty» — Казахстан, а общего префикса
 * у них нет. Для остальных регионов хватает языка браузера.
 */
const TIMEZONE_REGION: Record<string, string> = {
  'Europe/Kaliningrad': 'RU',
  'Europe/Moscow': 'RU',
  'Europe/Simferopol': 'RU',
  'Europe/Kirov': 'RU',
  'Europe/Volgograd': 'RU',
  'Europe/Astrakhan': 'RU',
  'Europe/Saratov': 'RU',
  'Europe/Ulyanovsk': 'RU',
  'Europe/Samara': 'RU',
  'Asia/Yekaterinburg': 'RU',
  'Asia/Omsk': 'RU',
  'Asia/Novosibirsk': 'RU',
  'Asia/Barnaul': 'RU',
  'Asia/Tomsk': 'RU',
  'Asia/Novokuznetsk': 'RU',
  'Asia/Krasnoyarsk': 'RU',
  'Asia/Irkutsk': 'RU',
  'Asia/Chita': 'RU',
  'Asia/Yakutsk': 'RU',
  'Asia/Khandyga': 'RU',
  'Asia/Vladivostok': 'RU',
  'Asia/Ust-Nera': 'RU',
  'Asia/Magadan': 'RU',
  'Asia/Sakhalin': 'RU',
  'Asia/Srednekolymsk': 'RU',
  'Asia/Kamchatka': 'RU',
  'Asia/Anadyr': 'RU',

  'Asia/Almaty': 'KZ',
  'Asia/Aqtau': 'KZ',
  'Asia/Aqtobe': 'KZ',
  'Asia/Atyrau': 'KZ',
  'Asia/Oral': 'KZ',
  'Asia/Qostanay': 'KZ',
  'Asia/Qyzylorda': 'KZ',

  'Europe/Minsk': 'BY',
};

export function regionForTimezone(timezone: string | null | undefined): string | null {
  if (!timezone) return null;
  return TIMEZONE_REGION[timezone] ?? null;
}

/**
 * Регион по данным устройства.
 *
 * Часовой пояс важнее языка: человек в Алматы вполне может держать
 * интерфейс на русском, и язык подсказал бы рубли вместо тенге.
 */
export function resolveRegion(input: {
  timezone?: string | null;
  locale?: string | null;
}): string | null {
  const byTimezone = regionForTimezone(input.timezone);
  if (byTimezone) return byTimezone;

  return regionFromLocale(input.locale);
}

/** «ru-RU» → «RU». Локаль без региона («ru») региона не даёт. */
export function regionFromLocale(locale: string | null | undefined): string | null {
  if (!locale) return null;

  const parts = locale.split(/[-_]/);
  const region = parts.find((part) => /^[A-Za-z]{2}$/.test(part) && part === part.toUpperCase());

  return region ?? null;
}
