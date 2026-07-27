/**
 * Тарифные ограничения (ADR-0005).
 *
 * Пороги вынесены в БД намеренно: их придётся подбирать
 * на реальных данных (открытый вопрос Q5), а не менять релизом.
 */

export type FeatureFlagSeed = {
  key: string;
  requiredPlan: 'free' | 'pro';
  description: string;
};

export const featureFlags: FeatureFlagSeed[] = [
  {
    key: 'import.csv',
    requiredPlan: 'pro',
    description: 'Импорт подписок из CSV-выписки',
  },
  {
    key: 'import.email',
    requiredPlan: 'pro',
    description: 'Импорт подписок из писем-чеков',
  },
  {
    key: 'import.bank',
    requiredPlan: 'pro',
    description: 'Синхронизация с банковскими выписками',
  },
  {
    key: 'analytics.full',
    requiredPlan: 'pro',
    description: 'Аналитика глубже 3 месяцев и прогноз на год',
  },
  {
    key: 'export.data',
    requiredPlan: 'pro',
    description: 'Экспорт всех данных в JSON и CSV',
  },
  {
    key: 'subscriptions.unlimited',
    requiredPlan: 'pro',
    description: 'Снятие лимита в 10 подписок',
  },
];

/** Лимит бесплатного тарифа (FR-11). Проверяется на сервере. */
export const FREE_PLAN_SUBSCRIPTION_LIMIT = 10;
