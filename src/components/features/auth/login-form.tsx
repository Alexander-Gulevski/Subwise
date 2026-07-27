'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getDictionary } from '@/locales';

const t = getDictionary('ru');

type Step = 'email' | 'code';

/**
 * Вход по коду на почту.
 *
 * Сообщение после запроса кода намеренно не раскрывает, существует ли
 * аккаунт: «Если такая почта у нас есть, код уже отправлен» (T10).
 */
export function LoginForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await fetch('/api/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setNotice(t.auth.codeSent);
      setStep('code');
    } catch {
      setError(t.common.somethingWentWrong);
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;

        setError(
          payload?.error?.code === 'RATE_LIMITED'
            ? t.auth.tooManyAttempts
            : t.auth.invalidCode,
        );
        return;
      }

      router.push('/app');
      router.refresh();
    } catch {
      setError(t.common.somethingWentWrong);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {step === 'email' ? (
        <form onSubmit={requestCode} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">
            {t.auth.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.auth.emailPlaceholder}
            className="min-h-tap rounded-xl border border-border bg-surface px-4 text-base"
          />
          <Button type="submit" disabled={pending}>
            {pending ? t.common.loading : t.auth.sendCode}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <label htmlFor="code" className="text-sm font-medium">
            {t.auth.codeLabel}
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder={t.auth.codePlaceholder}
            aria-describedby="code-hint"
            className="tabular min-h-tap rounded-xl border border-border bg-surface px-4 text-center text-2xl tracking-[0.4em]"
          />
          <p id="code-hint" className="text-sm text-muted">
            {t.auth.codeHint}
          </p>
          <Button type="submit" disabled={pending || code.length !== 6}>
            {pending ? t.common.loading : t.auth.verify}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
              setNotice(null);
            }}
          >
            {t.common.back}
          </Button>
        </form>
      )}

      {/* role="status" — сообщение читается скринридером (NFR-02) */}
      {notice ? (
        <p role="status" className="text-sm text-muted">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
