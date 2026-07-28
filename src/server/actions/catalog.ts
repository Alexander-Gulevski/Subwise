'use server';

import { z } from 'zod';
import { requireUser } from '@/server/auth/guards';
import {
  guessCategoryId,
  searchServices,
} from '@/server/services/catalog-service';
import { runAction, type ActionResult } from './result';

/**
 * Подсказки каталога для формы добавления — FR-04.
 *
 * Каталог общий для всех и персональных данных не содержит, но
 * авторизацию всё равно требуем: эндпоинт вызывается на каждое
 * нажатие клавиши, и открывать его анониму значит открывать
 * бесплатный способ нагружать приложение. Публичные страницы
 * каталога появятся отдельно, с кэшем на CDN (задача M1-09).
 */

const searchSchema = z.object({
  query: z.string().trim().max(120),
});

export type ServiceSuggestion = {
  id: string;
  slug: string;
  name: string;
  categoryId: string | null;
  categorySlug: string | null;
  defaultPlan: {
    amountMinor: number;
    currency: string;
    period: string;
    periodDays: number | null;
  } | null;
};

export async function searchServicesAction(
  input: unknown,
): Promise<ActionResult<ServiceSuggestion[]>> {
  return runAction(async () => {
    const { query } = searchSchema.parse(input);
    await requireUser();

    if (query.length === 0) return [];

    const found = await searchServices(query);

    return found.map((service) => ({
      id: service.id,
      slug: service.slug,
      name: service.name,
      categoryId: service.categoryId,
      categorySlug: service.categorySlug,
      defaultPlan: service.defaultPlan,
    }));
  });
}

/** Категория по произвольному названию — для сервисов вне каталога */
export async function guessCategoryAction(
  input: unknown,
): Promise<ActionResult<{ categoryId: string | null }>> {
  return runAction(async () => {
    const { query } = searchSchema.parse(input);
    await requireUser();

    if (query.length < 2) return { categoryId: null };

    return { categoryId: await guessCategoryId(query) };
  });
}
