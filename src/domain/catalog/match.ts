import { editDistance, normalizeName, typoTolerance } from './normalize';

/**
 * Поиск сервиса по названию и определение категории.
 *
 * Каталог маленький (десятки сервисов) и меняется редко, поэтому
 * сопоставление идёт в памяти. Расширение Postgres или поисковый
 * индекс здесь были бы сложностью без выигрыша.
 */

export type CatalogEntry = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /** Синонимы, латиница, частые опечатки */
  readonly aliases: readonly string[];
  readonly categorySlug: string | null;
};

export type MatchResult = {
  readonly entry: CatalogEntry;
  /** 0..1. Единица — точное совпадение */
  readonly score: number;
};

/**
 * Все совпадения по убыванию уверенности.
 * Пустой запрос возвращает пустой список, а не весь каталог:
 * подсказки на пустом поле только мешают.
 */
export function searchCatalog(
  query: string,
  catalog: readonly CatalogEntry[],
  limit = 8,
): MatchResult[] {
  const normalized = normalizeName(query);
  if (normalized.length === 0) return [];

  const results: MatchResult[] = [];

  for (const entry of catalog) {
    const score = scoreEntry(normalized, entry);
    if (score > 0) results.push({ entry, score });
  }

  return results
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit);
}

/**
 * Лучшее совпадение, если оно достаточно уверенное.
 *
 * Порог намеренно высокий: подставить не тот сервис хуже, чем
 * не подставить ничего. Пользователь не заметит подмену категории,
 * но заметит неверную аналитику.
 */
export function findBestMatch(
  query: string,
  catalog: readonly CatalogEntry[],
  minScore = 0.75,
): CatalogEntry | null {
  const [best] = searchCatalog(query, catalog, 1);
  return best && best.score >= minScore ? best.entry : null;
}

function scoreEntry(normalizedQuery: string, entry: CatalogEntry): number {
  const candidates = [entry.name, entry.slug, ...entry.aliases];

  let best = 0;

  for (const candidate of candidates) {
    const normalized = normalizeName(candidate);
    if (normalized.length === 0) continue;

    if (normalized === normalizedQuery) return 1;

    // Пользователь набрал часть названия: «кино» → «Кинопоиск».
    // Начало строки весомее середины: так набирают чаще
    if (normalized.startsWith(normalizedQuery)) {
      best = Math.max(best, 0.9);
      continue;
    }
    if (normalized.includes(normalizedQuery)) {
      best = Math.max(best, 0.75);
      continue;
    }

    const distance = editDistance(normalizedQuery, normalized);
    const tolerance = typoTolerance(Math.max(normalizedQuery.length, normalized.length));

    if (distance <= tolerance) {
      // Чем больше правок, тем ниже уверенность
      best = Math.max(best, 0.85 - distance * 0.08);
    }
  }

  return best;
}

/**
 * Ключевые слова для категорий — запасной путь.
 *
 * Работает, когда сервиса нет в каталоге: пользователь ввёл своё
 * название, а мы всё равно можем угадать, о чём речь. «Мой VPN» —
 * это связь, «Курсы английского» — обучение.
 *
 * Порядок важен: первое совпадение выигрывает, поэтому
 * специфичные слова идут раньше общих.
 */
const CATEGORY_KEYWORDS: Array<[string, readonly string[]]> = [
  ['communication', ['vpn', 'впн', 'proxy', 'прокси', 'мобильн', 'связь', 'sim', 'сим', 'телефон']],
  ['video', ['кино', 'фильм', 'сериал', 'tv', 'тв', 'video', 'видео', 'movie', 'ivi', 'okko', 'netflix', 'кинотеатр']],
  ['music', ['музык', 'music', 'audio', 'аудио', 'подкаст', 'podcast', 'spotify', 'звук', 'радио']],
  ['cloud', ['облак', 'cloud', 'диск', 'disk', 'drive', 'хранилищ', 'backup', 'бэкап', 'storage']],
  ['education', ['курс', 'course', 'обучен', 'школ', 'учеб', 'english', 'английск', 'edu', 'skill', 'универ', 'лекц']],
  ['games', ['игр', 'game', 'gaming', 'xbox', 'playstation', 'steam', 'ps plus', 'геймп']],
  ['delivery', ['доставк', 'delivery', 'маркет', 'market', 'достав', 'prime', 'прайм', '食', 'еда', 'food']],
  ['health', ['фитнес', 'fitness', 'спорт', 'sport', 'здоров', 'health', 'зал', 'йог', 'gym', 'медит']],
  ['finance', ['банк', 'bank', 'инвест', 'invest', 'финанс', 'finance', 'страхов', 'брокер']],
  ['news', ['новост', 'news', 'газет', 'журнал', 'magazine', 'чтен', 'книг', 'book', 'read']],
  ['software', ['adobe', 'office', 'софт', 'soft', 'редактор', 'editor', 'design', 'дизайн', 'ide', 'хостинг', 'домен', 'ai', 'gpt', 'нейросет']],
];

/**
 * Категория по названию.
 *
 * Сначала ищем сервис в каталоге — его категория точнее любой
 * эвристики. Если не нашли, пробуем ключевые слова.
 * Не угадали — возвращаем null и не навязываем «Другое»:
 * пустая категория честнее неверной.
 */
export function guessCategorySlug(
  name: string,
  catalog: readonly CatalogEntry[] = [],
): string | null {
  const matched = findBestMatch(name, catalog);
  if (matched?.categorySlug) return matched.categorySlug;

  const lowered = name.toLowerCase();

  for (const [slug, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => lowered.includes(keyword))) return slug;
  }

  return null;
}
