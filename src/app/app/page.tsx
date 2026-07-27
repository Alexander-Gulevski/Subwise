import type { Metadata } from 'next';
import { Card, CardTitle, EmptyState } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney, money } from '@/domain/money';
import { getDictionary } from '@/locales';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';

const t = getDictionary('ru');

export const metadata: Metadata = { title: t.dashboard.title };

/**
 * Дашборд — каркас M0.
 *
 * Пока показывает только пустое состояние: расчёт итогов, ближайших
 * списаний и блока триалов приходит на M1 вместе с CRUD подписок
 * (docs/08-roadmap.md).
 */
export default async function DashboardPage() {
  const user = await requireUser();

  const subscriptionCount = await db.subscription.count({
    where: { userId: user.id, deletedAt: null },
  });

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: { baseCurrency: true },
  });

  const baseCurrency = (settings?.baseCurrency ?? 'RUB') as 'RUB';

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.dashboard.title}</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>{t.dashboard.perMonth}</CardTitle>
          <p className="tabular mt-1 text-2xl font-semibold">
            {formatMoney(money(0, baseCurrency))}
          </p>
        </Card>
        <Card>
          <CardTitle>{t.dashboard.perYear}</CardTitle>
          <p className="tabular mt-1 text-2xl font-semibold">
            {formatMoney(money(0, baseCurrency))}
          </p>
        </Card>
      </div>

      {subscriptionCount === 0 ? (
        <EmptyState
          title={t.dashboard.empty.title}
          text={t.dashboard.empty.text}
          action={<Button disabled>{t.dashboard.empty.cta}</Button>}
        />
      ) : null}
    </div>
  );
}
