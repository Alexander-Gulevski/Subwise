import type { Metadata } from 'next';
import { Card, CardTitle } from '@/components/ui/card';
import { CurrencySetting } from '@/components/features/settings/currency-setting';
import { LogoutButton } from '@/components/features/auth/logout-button';
import type { CurrencyCode } from '@/domain/money';
import { getDictionary } from '@/locales';
import { requireUser } from '@/server/auth/guards';
import { db } from '@/server/db';

const t = getDictionary('ru');

export const metadata: Metadata = { title: t.settings.title };

/**
 * Настройки.
 *
 * Пока показывают текущие значения и дают выйти из аккаунта.
 * Редактирование валюты, часового пояса и тихих часов приходит на M2
 * вместе с настройками уведомлений — там же появится и экспорт данных.
 */
export default async function SettingsPage() {
  const user = await requireUser();

  const [settings, identities] = await Promise.all([
    db.userSettings.findUnique({
      where: { userId: user.id },
      select: {
        baseCurrency: true,
        timezone: true,
        quietHoursStart: true,
        quietHoursEnd: true,
      },
    }),
    db.authIdentity.findMany({
      where: { userId: user.id },
      select: { provider: true, externalId: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>

      <Card className="flex flex-col gap-3">
        <CardTitle>Аккаунт</CardTitle>
        <ul className="flex flex-col gap-1 text-sm">
          {identities.map((identity) => (
            <li key={identity.provider} className="flex justify-between gap-4">
              <span className="text-muted">
                {identity.provider === 'telegram' ? 'Telegram' : 'Почта'}
              </span>
              <span>{identity.externalId}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4">
            <span className="text-muted">Тариф</span>
            <span>{user.plan === 'pro' ? 'Расширенный' : 'Бесплатный'}</span>
          </li>
        </ul>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Предпочтения</CardTitle>

        <CurrencySetting
          value={(settings?.baseCurrency ?? 'RUB') as CurrencyCode}
        />

        <ul className="flex flex-col gap-1 text-sm">
          <li className="flex justify-between gap-4">
            <span className="text-muted">{t.settings.timezone}</span>
            <span>{settings?.timezone ?? 'Europe/Moscow'}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted">{t.settings.quietHours}</span>
            <span className="tabular">
              {settings?.quietHoursStart ?? 22}:00 — {settings?.quietHoursEnd ?? 9}:00
            </span>
          </li>
        </ul>
        <p className="text-sm text-muted">{t.settings.quietHoursHint}</p>
      </Card>

      <LogoutButton />
    </div>
  );
}
