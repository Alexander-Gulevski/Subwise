import { describe, expect, it } from 'vitest';
import { editDistance, normalizeName, typoTolerance } from './normalize';
import {
  findBestMatch,
  guessCategorySlug,
  searchCatalog,
  type CatalogEntry,
} from './match';

/**
 * Поиск по каталогу и определение категории — FR-04.
 *
 * Главное требование: пользователь набирает как привык, а не как
 * записано в справочнике. «kinopoisk», «кинопойск» и «Кинопоиск HD»
 * должны находить одну запись.
 */

const catalog: CatalogEntry[] = [
  {
    id: '1',
    slug: 'kinopoisk',
    name: 'Кинопоиск',
    aliases: ['kinopoisk', 'кинопоиск hd', 'яндекс кинопоиск'],
    categorySlug: 'video',
  },
  {
    id: '2',
    slug: 'spotify',
    name: 'Spotify',
    aliases: ['спотифай'],
    categorySlug: 'music',
  },
  {
    id: '3',
    slug: 'yandex-plus',
    name: 'Яндекс Плюс',
    aliases: ['yandex plus', 'я.плюс'],
    categorySlug: 'music',
  },
  {
    id: '4',
    slug: 'okko',
    name: 'Okko',
    aliases: ['окко'],
    categorySlug: 'video',
  },
  {
    id: '5',
    slug: 'vk-music',
    name: 'VK Музыка',
    aliases: ['вк музыка', 'boom'],
    categorySlug: 'music',
  },
];

describe('нормализация названий', () => {
  it('кириллица и латиница сходятся в одну форму', () => {
    expect(normalizeName('Кинопоиск')).toBe(normalizeName('kinopoisk'));
  });

  it('регистр и пробелы не влияют', () => {
    expect(normalizeName('  ЯНДЕКС   ПЛЮС  ')).toBe(normalizeName('яндекс плюс'));
  });

  it('шумовые слова отбрасываются', () => {
    expect(normalizeName('Кинопоиск HD')).toBe(normalizeName('Кинопоиск'));
    expect(normalizeName('Spotify Premium')).toBe(normalizeName('Spotify'));
  });

  it('удвоенные буквы схлопываются', () => {
    expect(normalizeName('Okko')).toBe(normalizeName('Око'));
  });

  it('знаки препинания игнорируются', () => {
    expect(normalizeName('Я.Плюс')).toBe(normalizeName('я плюс'));
  });
});

describe('расстояние правок', () => {
  it('одинаковые строки — ноль', () => {
    expect(editDistance('kinopoisk', 'kinopoisk')).toBe(0);
  });

  it('одна перестановка — две правки', () => {
    expect(editDistance('kinopoisk', 'kinopoisk')).toBe(0);
    expect(editDistance('abc', 'acb')).toBe(2);
  });

  it('порог опечаток растёт с длиной', () => {
    // Для «Okko» две правки — уже другое слово
    expect(typoTolerance(4)).toBe(0);
    expect(typoTolerance(7)).toBe(1);
    expect(typoTolerance(12)).toBe(2);
    expect(typoTolerance(20)).toBe(3);
  });
});

describe('поиск по каталогу', () => {
  it('находит по точному названию', () => {
    expect(findBestMatch('Кинопоиск', catalog)?.slug).toBe('kinopoisk');
  });

  it('находит по латинице', () => {
    expect(findBestMatch('kinopoisk', catalog)?.slug).toBe('kinopoisk');
  });

  it('находит с опечаткой', () => {
    expect(findBestMatch('кинопойск', catalog)?.slug).toBe('kinopoisk');
  });

  it('находит по началу названия', () => {
    expect(findBestMatch('кино', catalog)?.slug).toBe('kinopoisk');
  });

  it('находит по синониму', () => {
    expect(findBestMatch('спотифай', catalog)?.slug).toBe('spotify');
  });

  it('пустой запрос не возвращает ничего', () => {
    expect(searchCatalog('', catalog)).toEqual([]);
    expect(searchCatalog('   ', catalog)).toEqual([]);
  });

  it('незнакомое название не подставляется наугад', () => {
    // Подставить не тот сервис хуже, чем не подставить ничего:
    // пользователь не заметит подмену, но заметит неверную аналитику
    expect(findBestMatch('Мой личный сервис', catalog)).toBeNull();
  });

  it('результаты отсортированы по уверенности', () => {
    const results = searchCatalog('му', catalog);
    const scores = results.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('ограничивает число подсказок', () => {
    expect(searchCatalog('о', catalog, 2).length).toBeLessThanOrEqual(2);
  });
});

describe('определение категории', () => {
  it('берёт категорию из каталога, если сервис найден', () => {
    expect(guessCategorySlug('Кинопоиск', catalog)).toBe('video');
    expect(guessCategorySlug('spotify', catalog)).toBe('music');
  });

  it('работает и с опечаткой в названии', () => {
    expect(guessCategorySlug('кинопойск', catalog)).toBe('video');
  });

  it('угадывает по ключевым словам, если сервиса нет в каталоге', () => {
    expect(guessCategorySlug('Мой VPN', catalog)).toBe('communication');
    expect(guessCategorySlug('Курсы английского', catalog)).toBe('education');
    expect(guessCategorySlug('Облачный диск', catalog)).toBe('cloud');
    expect(guessCategorySlug('Фитнес-зал', catalog)).toBe('health');
    expect(guessCategorySlug('Подписка на журнал', catalog)).toBe('news');
  });

  it('работает без каталога вообще', () => {
    expect(guessCategorySlug('VPN сервис')).toBe('communication');
  });

  it('не навязывает категорию, если не уверена', () => {
    // Пустая категория честнее неверной
    expect(guessCategorySlug('Ежемесячный платёж', catalog)).toBeNull();
    expect(guessCategorySlug('Иванов', catalog)).toBeNull();
  });
});
