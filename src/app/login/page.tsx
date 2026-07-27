import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { getDictionary } from '@/locales';
import { LoginForm } from '@/components/features/auth/login-form';

const t = getDictionary('ru');

export const metadata: Metadata = { title: t.auth.title };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/app');

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-5 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.auth.title}</h1>
        <p className="text-sm text-muted">{t.auth.subtitle}</p>
      </header>

      <LoginForm />
    </main>
  );
}
