import { db } from '@/server/db';
import { errors } from './errors';
import { getSessionUser, type SessionUser } from './session';

/**
 * Guard-функции — обязательный порядок в каждой точке входа
 * (docs/04-api-contract.md, раздел 2):
 *
 *   1. Schema.parse(input)        валидация
 *   2. requireUser()              аутентификация
 *   3. владение ресурсом          ← см. ниже
 *   4. requireFeature(...)        тариф
 *   5. вызов сервиса
 *   6. аудит
 *
 * Отдельной проверки владения здесь нет намеренно. Она обеспечена
 * конструктивно: репозиторий принимает userId и фильтрует по нему,
 * а метода «получить по id» без userId в проекте не существует.
 * Забыть проверку физически негде, и это надёжнее, чем помнить
 * про вызов guard-функции.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw errors.unauthenticated();
  return user;
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
