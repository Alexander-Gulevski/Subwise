import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, EmptyState } from '@/components/ui/card';
import { SubscriptionRow } from '@/components/features/subscriptions/subscription-row';
import type { CategorySlug } from '@/components/ui/monogram';
import { formatMoney } from '@/domain/money';
import { getDictionary } from '@/locales';
import { requireUser } from '@/server/auth/guards';
import {
  getDashboard,
  type SubscriptionView,
} from '@/server/services/dashboard-service';

const t = getDictionary('ru');

export const metadata: Metadata = { title: t.dashboard.title };

/**
 * Дашборд — FR-02.
 *
 * Отвечает на три вопроса сверху вниз, в порядке важности:
 * сколько я плачу → что спишут ближайшим → где утечка.
 *
 * Триалы всегда выше активных подписок: у них есть дедлайн,
 * у остальных нет (docs/05-ux-flows.md).
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const dashboard = await getDashboard(user.id);

  const hasAny =
    dashboard.active.length > 0 ||
    dashboard.trials.length > 0 ||
    dashboard.paused.length > 0;

  // Триалы показываются своим блоком выше — здесь только платные
  const upcoming = dashboard.upcoming.filter((item) => item.status !== 'trial');
  const upcomingIds = new Set(upcoming.map((item) => item.id));
  const later = dashboard.active.filter((item) => !upcomingIds.has(item.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t.dashboard.title}</h1>
        {hasAny ? (
          <Button asChild size="sm">
            <Link href="/app/subscriptions/new">{t.subscription.add}</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>{t.dashboard.perMonth}</CardTitle>
          <p className="tabular mt-1 text-2xl font-semibold">
            {formatMoney(dashboard.monthlyTotal)}
          </p>
        </Card>
        <Card>
          <CardTitle>{t.dashboard.perYear}</CardTitle>
          <p className="tabular mt-1 text-2xl font-semibold">
            {formatMoney(dashboard.yearlyTotal)}
          </p>
        </Card>
      </div>

      {/* Молча занижать итог нельзя: пользователь решит, что подписка потерялась */}
      {dashboard.unconvertedCount > 0 ? (
        <p className="text-sm text-warn">
          Ещё {dashboard.unconvertedCount} в другой валюте — не хватает курса,
          чтобы включить в итог
        </p>
      ) : null}

      {dashboard.hasStaleRate ? (
        <p className="text-sm text-muted">Курс валют не сегодняшний</p>
      ) : null}

      {dashboard.trials.length > 0 ? (
        <section className="flex flex-col gap-2">
          <CardTitle>{t.dashboard.trials}</CardTitle>
          {dashboard.trials.map((item) => (
            <Row key={item.id} view={item} />
          ))}
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="flex flex-col gap-2">
          <CardTitle>{t.dashboard.upcoming}</CardTitle>
          {upcoming.map((item) => (
            <Row key={item.id} view={item} />
          ))}
        </section>
      ) : null}

      {/*
        Остальные активные подписки. Без этого блока подписка со списанием
        дальше 30 дней не показывалась бы нигде — пользователь решил бы,
        что она потерялась.
      */}
      {later.length > 0 ? (
        <section className="flex flex-col gap-2">
          <CardTitle>{upcoming.length > 0 ? 'Позже' : 'Подписки'}</CardTitle>
          {later.map((item) => (
            <Row key={item.id} view={item} />
          ))}
        </section>
      ) : null}

      {dashboard.paused.length > 0 ? (
        <section className="flex flex-col gap-2">
          <CardTitle>На паузе</CardTitle>
          {dashboard.paused.map((item) => (
            <Row key={item.id} view={item} />
          ))}
        </section>
      ) : null}

      {!hasAny ? (
        <EmptyState
          title={t.dashboard.empty.title}
          text={t.dashboard.empty.text}
          action={
            <Button asChild>
              <Link href="/app/subscriptions/new">{t.dashboard.empty.cta}</Link>
            </Button>
          }
        />
      ) : null}
    </div>
  );
}

function Row({ view }: { view: SubscriptionView }) {
  return (
    <Link
      href={`/app/subscriptions/${view.id}`}
      // Ссылка на всю строку: попасть в неё пальцем проще, чем
      // в отдельную иконку (NFR-08)
      className="rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`${view.displayName}, открыть карточку`}
    >
      <SubscriptionRow
        name={view.displayName}
        amount={view.amount}
        amountInBase={view.amountInBase}
        period={view.period}
        status={view.status}
        category={(view.categorySlug as CategorySlug) ?? 'other'}
        daysUntilCharge={view.daysUntilCharge}
      />
    </Link>
  );
}
