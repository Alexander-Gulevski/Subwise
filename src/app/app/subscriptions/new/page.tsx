import type { Metadata } from 'next';
import { SubscriptionForm } from '@/components/features/subscriptions/subscription-form';
import { getDictionary } from '@/locales';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';

const t = getDictionary('ru');

export const metadata: Metadata = { title: t.subscription.add };

/**
 * Добавление подписки — FR-01.
 *
 * Пока только ручной ввод. Выбор из каталога с автозаполнением тарифа
 * появится вместе с наполнением Service и ServicePlan.
 */
export default async function NewSubscriptionPage() {
  await requireUser();

  const categories = await db.category.findMany({
    where: { isSystem: true },
    orderBy: { name: 'asc' },
    select: { id: true, slug: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.subscription.add}</h1>
      <SubscriptionForm categories={categories} />
    </div>
  );
}
