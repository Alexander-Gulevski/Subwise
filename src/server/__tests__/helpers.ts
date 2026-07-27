import { db } from '@/server/db';

/**
 * Помощники интеграционных тестов.
 *
 * Работают на отдельной базе subwise_test (см. .env.test), поэтому
 * очистка таблиц безопасна и не задевает данные разработчика.
 */

/**
 * Очищает пользовательские данные между тестами.
 * Справочники (Category, Service, FeatureFlag) не трогаются —
 * их наполняет сид, и пересоздавать их на каждый тест дорого.
 */
export async function resetUserData(): Promise<void> {
  // Порядок важен: сначала зависимые таблицы.
  // CASCADE отработал бы и сам, но явный порядок делает
  // ошибку схемы заметной сразу.
  await db.auditLog.deleteMany();
  await db.billingEvent.deleteMany();
  await db.cancellationFlow.deleteMany();
  await db.subscription.deleteMany();
  await db.notificationDelivery.deleteMany();
  await db.reminderRule.deleteMany();
  await db.importCandidate.deleteMany();
  await db.importConnection.deleteMany();
  await db.webPushSubscription.deleteMany();
  await db.session.deleteMany();
  await db.emailOtp.deleteMany();
  await db.authIdentity.deleteMany();
  await db.userSettings.deleteMany();
  await db.user.deleteMany();
}

export async function createTestUser(
  options: { plan?: 'free' | 'pro' } = {},
): Promise<{ id: string; plan: 'free' | 'pro' }> {
  const user = await db.user.create({
    data: {
      plan: options.plan ?? 'free',
      settings: { create: {} },
    },
    select: { id: true, plan: true },
  });

  return user;
}

/** Дата в UTC без времени — чтобы тесты не зависели от часа запуска */
export function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
