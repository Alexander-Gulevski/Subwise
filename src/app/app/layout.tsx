import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { getDictionary } from '@/locales';

const t = getDictionary('ru');

const NAV = [
  { href: '/app', label: t.dashboard.title },
  { href: '/app/notifications', label: t.notifications.title },
  { href: '/app/settings', label: t.settings.title },
] as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/app" className="font-semibold">
            {t.brand.name}
          </Link>

          <nav aria-label={t.a11y.mainNavigation}>
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-tap items-center rounded-control px-3 text-sm text-muted hover:bg-surface-raised hover:text-fg"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">{children}</main>
    </div>
  );
}
