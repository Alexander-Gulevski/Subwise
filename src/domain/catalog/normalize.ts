/**
 * Приведение названий сервисов к сравнимому виду.
 *
 * Задача: «Кинопоиск», «kinopoisk», «КиноПоиск HD» и «кинопойск»
 * должны опознаваться как один сервис. Пользователь набирает как
 * привык, а не как записано в справочнике.
 */

/**
 * Кириллица → латиница.
 *
 * Не ГОСТ и не научная транслитерация: цель не читаемость, а то,
 * чтобы одно и то же название с обеих раскладок сходилось в одну
 * строку. Поэтому «щ» → «sh», а не «shch» — так ближе к тому,
 * как люди реально печатают.
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

/**
 * Пары, которые люди пишут взаимозаменяемо. Схлопываем их,
 * чтобы «Yandex» и «Яндекс» («Iandeks» после транслитерации)
 * сошлись в одну форму.
 */
const EQUIVALENCE_RULES: Array<[RegExp, string]> = [
  [/ya/g, 'a'],
  [/yu/g, 'u'],
  [/ye/g, 'e'],
  [/yi/g, 'i'],
  [/ck/g, 'k'],
  [/kh/g, 'h'],
  [/ph/g, 'f'],
  [/x/g, 'ks'],
  [/w/g, 'v'],
  [/q/g, 'k'],
  // Удвоенные согласные: «Netfliix» и «Netflix» — одно и то же
  [/(.)\1+/g, '$1'],
];

/**
 * Слова, которые ничего не добавляют к опознанию сервиса.
 * «Кинопоиск HD» и «Кинопоиск» — один сервис.
 */
const NOISE_WORDS = new Set([
  'hd', 'plus', 'premium', 'pro', 'подписка', 'сервис', 'ru', 'рф',
]);

/** Пользовательский ввод → форма для сравнения */
export function normalizeName(input: string): string {
  const lowered = input.toLowerCase().trim();

  const withoutNoise = lowered
    .split(/[\s\-_.+]+/)
    .filter((word) => word.length > 0 && !NOISE_WORDS.has(word))
    .join(' ');

  const transliterated = [...(withoutNoise || lowered)]
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('');

  const lettersOnly = transliterated.replace(/[^a-z0-9]/g, '');

  return EQUIVALENCE_RULES.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    lettersOnly,
  );
}

/**
 * Расстояние Левенштейна — сколько правок отделяет строки.
 *
 * Нужно для опечаток: «кинопойск» отличается от «кинопоиск»
 * на одну перестановку. Каталог маленький (десятки сервисов),
 * поэтому наивной реализации достаточно — городить индекс
 * или расширение Postgres не за чем.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      const insertion = current[j - 1]! + 1;
      const deletion = previous[j]! + 1;
      current[j] = Math.min(substitution, insertion, deletion);
    }

    previous = current;
  }

  return previous[b.length]!;
}

/**
 * Допустимое число опечаток для строки такой длины.
 *
 * Фиксированный порог одинаково плох в обе стороны: для «Okko»
 * две правки — это уже другое слово, а для «Яндекс Маркет» —
 * мелочь. Поэтому порог растёт с длиной.
 */
export function typoTolerance(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  if (length <= 12) return 2;
  return 3;
}
