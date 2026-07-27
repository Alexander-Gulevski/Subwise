import { db } from '@/server/db';
import { errors } from './errors';
import { getSessionUser, type SessionUser } from './session';

/**
 * Guard-функции — обязательный порядок в каждой точке входа
 * (docs/04-api-contract.md, раздел 2):
 *
 *   1. Schema.parse(input)        валидация
 *   2. requireUser()              аутентификация
 *   3. requireOwnership(...)      владение ресурсом   ← пропуск = дыра
 *   4. requireFeature(...)        тариф
 *   5. вызов сервиса
 *   6. аудит
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw errors.unauthenticated();
  return user;
}

/**
 * Проверка владения подпиской.
 *
 * ПРОПУСК ЭТОЙ ПРОВЕРКИ — САМАЯ ОПАСНАЯ ОШИБКА В ПРОЕКТЕ:
 * она открывает доступ к чужим данным.
 *
 * Чужой ресурс даёт NOT_FOUND, а не FORBIDDEN — иначе по коду ответа
 * перебором выясняется, какие идентификаторы существуют (T1).
 */
export async function requireSubscriptionOwnership(
  userId: string,
  subscriptionId: string,
): Promise<void> {
  const found = await db.subscription.findFirst({
    where: { id: subscriptionId, userId, deletedAt: null },
    select: { id: true },
  });

  if (!found) throw errors.notFound('Подписка');
}

/**
 * Проверка доступа к функции по тарифу — ADR-0005.
 *
 * Вызывается НА СЕРВЕРЕ. Скрытие кнопки в интерфейсе — вежливость
 * к пользователю, а не защита: прямой вызов API её обходит.
 */
export async function requireFeature(
  user: SessionUser,
  featureKey: string,
): Promise<void> {
  const flag = await db.featureFlag.findUnique({
    where: { key: featureKey },
    select: { requiredPlan: true, isEnabled: true },
  });

  // Неизвестный флаг трактуем как запрет: безопаснее ошибиться в эту сторону
  if (!flag || !flag.isEnabled) throw errors.planRequired(featureKey);

  if (flag.requiredPlan === 'pro' && user.plan !== 'pro') {
    throw errors.planRequired(featureKey);
  }
}

/** Лимит бесплатного тарифа на число подписок (FR-11) */
export async function requireSubscriptionQuota(
  user: SessionUser,
  limit: number,
): Promise<void> {
  if (user.plan === 'pro') return;

  const count = await db.subscription.count({
    where: { userId: user.id, deletedAt: null },
  });

  if (count >= limit) throw errors.limitExceeded(limit);
}
