import type { Metadata } from 'next';
import { Card, EmptyState } from '@/components/ui/card';
import { getDictionary } from '@/locales';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';

const t = getDictionary('ru');

export const metadata: Metadata = { title: t.notifications.title };

/**
 * Лента уведомлений — FR-06.
 *
 * In-app канал работает всегда, даже если внешние отключены, и хранит
 * историю за 90 дней. Наполняется планировщиком на M2 — до тех пор
 * лента честно пуста.
 */
export default async function NotificationsPage() {
  const user = await requireUser();

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const deliveries = await db.notificationDelivery.findMany({
    where: {
      userId: user.id,
      channel: 'inapp',
      createdAt: { gte: ninetyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, type: true, payload: true, createdAt: true, readAt: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.notifications.title}</h1>

      {deliveries.length === 0 ? (
        <EmptyState
          title={t.notifications.empty}
          text="Как только появится подписка, здесь будут напоминания о ближайших списаниях."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {deliveries.map((item) => {
            const payload = item.payload as { title?: string; body?: string };

            return (
              <li key={item.id}>
                <Card className={item.readAt ? 'opacity-60' : undefined}>
                  <p className="font-medium">{payload.title ?? item.type}</p>
                  {payload.body ? (
                    <p className="text-sm text-muted">{payload.body}</p>
                  ) : null}
                  <time
                    dateTime={item.createdAt.toISOString()}
                    className="mt-2 block text-xs text-muted"
                  >
                    {new Intl.DateTimeFormat('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(item.createdAt)}
                  </time>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
