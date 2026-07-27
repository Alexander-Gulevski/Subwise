import { ru, type Dictionary } from './ru';

export type Locale = 'ru';

const dictionaries: Record<Locale, Dictionary> = { ru };

export const DEFAULT_LOCALE: Locale = 'ru';

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale];
}

/**
 * Подстановка в шаблон: t('Спишут через {days} дн.', { days: 3 }).
 * Числа и даты форматируются вызывающим кодом через Intl (NFR-07).
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type { Dictionary };
