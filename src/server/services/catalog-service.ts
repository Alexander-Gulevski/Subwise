import type { CatalogEntry } from '@/domain/catalog';
import { guessCategorySlug, searchCatalog } from '@/domain/catalog';
import { db } from '@/server/db';

/**
 * Каталог сервисов — FR-04.
 *
 * Весь каталог держится в памяти процесса. Это осознанный выбор:
 * записей десятки, меняются они только при выкатке сида, а поиск
 * с опечатками в базе потребовал бы расширения pg_trgm ради
 * набора данных, который целиком влезает в пару килобайт.
 *
 * Кэш живёт ограниченное время, чтобы обновление каталога
 * не требовало перезапуска приложения.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

export type CatalogService = CatalogEntry & {
  logoUrl: string | null;
  websiteUrl: string | null;
  /** Тариф по умолчанию — им заполняется форма */
  defaultPlan: {
    amountMinor: number;
    currency: string;
    period: string;
    periodDays: number | null;
  } | null;
  categoryId: string | null;
};

let cache: { items: CatalogService[]; loadedAt: number } | null = null;

export async function getCatalog(): Promise<CatalogService[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.items;

  const rows = await db.service.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      aliases: true,
      logoUrl: true,
      websiteUrl: true,
      categoryId: true,
      category: { select: { slug: true } },
      plans: {
        where: { isDefault: true },
        take: 1,
        select: {
          amountMinor: true,
          currency: true,
          period: true,
          periodDays: true,
        },
      },
    },
  });

  const items: CatalogService[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    aliases: row.aliases,
    categorySlug: row.category?.slug ?? null,
    categoryId: row.categoryId,
    logoUrl: row.logoUrl,
    websiteUrl: row.websiteUrl,
    defaultPlan: row.plans[0] ?? null,
  }));

  cache = { items, loadedAt: Date.now() };
  return items;
}

/**
 * Сервисы для сетки онбординга — FR-01.
 *
 * Сортировка по категории, а не по «популярности»: связанные сервисы
 * оказываются рядом, и глаз пробегает сетку блоками. Данных
 * о реальной популярности у нас всё равно нет, а выдуманный порядок
 * только притворялся бы осмысленным.
 */
export async function getPopularServices(): Promise<CatalogService[]> {
  const catalog = await getCatalog();
  const popular = await db.service.findMany({
    where: { isActive: true, isPopular: true },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    select: { id: true },
  });

  const order = new Map(popular.map((item, index) => [item.id, index]));

  return catalog
    .filter((service) => order.has(service.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function searchServices(
  query: string,
  limit = 8,
): Promise<CatalogService[]> {
  const catalog = await getCatalog();
  return searchCatalog(query, catalog, limit).map(
    (result) => result.entry as CatalogService,
  );
}

/**
 * Категория по названию сервиса.
 *
 * Сначала ищет сервис в каталоге, потом пробует ключевые слова.
 * Возвращает id категории, потому что именно он нужен форме.
 * null означает «не уверены» — навязывать «Другое» не станем.
 */
export async function guessCategoryId(name: string): Promise<string | null> {
  const catalog = await getCatalog();
  const slug = guessCategorySlug(name, catalog);
  if (!slug) return null;

  const category = await db.category.findUnique({
    where: { slug },
    select: { id: true },
  });

  return category?.id ?? null;
}
