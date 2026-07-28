import { CURRENCY_EXPONENT, type Money } from './types';

/**
 * Форматирование денег.
 *
 * Только через Intl — ручная сборка строки ломается на разных локалях
 * и на валютах с другим числом знаков (NFR-07).
 */

export function formatMoney(
  amount: Money,
  locale = 'ru-RU',
  options: { hideFractionWhenWhole?: boolean } = {},
): string {
  const exponent = CURRENCY_EXPONENT[amount.currency];
  const value = amount.minor / 10 ** exponent;

  // Подписки почти всегда в круглых суммах: «399 ₽» читается лучше,
  // чем «399,00 ₽». Дробную часть показываем, только когда она есть.
  const isWhole = amount.minor % 10 ** exponent === 0;
  const fractionDigits =
    options.hideFractionWhenWhole !== false && isWhole ? 0 : exponent;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function parseMinor(input: string, exponent: number): number | null {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;

  return Math.round(value * 10 ** exponent);
}
