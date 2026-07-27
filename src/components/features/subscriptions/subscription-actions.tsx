'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getDictionary } from '@/locales';
import {
  deleteSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
} from '@/server/actions/subscriptions';

const t = getDictionary('ru');

/**
 * Действия над подпиской.
 *
 * Отмены здесь нет: она проходит через гид с подтверждением
 * пользователя (ADR-0002) и появится на M2. Пауза — не замена отмене:
 * она останавливает наш учёт, но деньги списываться продолжат.
 */
export function SubscriptionActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function run(
    key: string,
    action: (input: { id: string }) => Promise<
      { ok: true; data: unknown } | { ok: false; error: { message: string } }
    >,
  ) {
    setPending(key);
    setError(null);

    const result = await action({ id });

    if (!result.ok) {
      setError(result.error.message);
      setPending(null);
      return;
    }

    router.push('/app');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {status === 'paused' ? (
          <Button
            variant="secondary"
            disabled={pending !== null}
            onClick={() => run('resume', resumeSubscriptionAction)}
          >
            {pending === 'resume' ? t.common.loading : t.subscription.resume}
          </Button>
        ) : null}

        {status === 'active' || status === 'trial' ? (
          <Button
            variant="secondary"
            disabled={pending !== null}
            onClick={() => run('pause', pauseSubscriptionAction)}
          >
            {pending === 'pause' ? t.common.loading : t.subscription.pause}
          </Button>
        ) : null}
      </div>

      {confirmingDelete ? (
        <div className="flex flex-col gap-2 rounded-card border border-danger/40 bg-danger-soft p-4">
          <p className="text-sm">
            Удалить подписку из списка? Восстановить можно в течение 30 дней.
          </p>
          {/* Удаление из приложения ≠ отмена у сервиса — это разные вещи,
              и молчать об этом нельзя */}
          <p className="text-sm text-muted">
            Деньги продолжат списываться: это удаление только из твоего списка.
          </p>
          <div className="flex gap-3">
            <Button
              variant="danger"
              disabled={pending !== null}
              onClick={() => run('delete', deleteSubscriptionAction)}
            >
              {pending === 'delete' ? t.common.loading : 'Удалить'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-danger"
          onClick={() => setConfirmingDelete(true)}
        >
          Удалить подписку
        </Button>
      )}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
