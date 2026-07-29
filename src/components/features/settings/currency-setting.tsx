'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/domain/money';
import { updateBaseCurrencyAction } from '@/server/actions/settings';

/**
 * Базовая валюта — валюта, в которой пользователь видит итоги.
 *
 * Меняется здесь, а не угадывается заново: определение по региону
 * не отличает Беларусь от России (обе в UTC+3, и Windows в Минске
 * нередко стоит на московском времени). Выбор пользователя —
 * последнее слово.
 */
export function CurrencySetting({ value }: { value: CurrencyCode }) {
  const router = useRouter();
  const [current, setCurrent] = useState<CurrencyCode>(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function change(next: CurrencyCode) {
    const previous = current;

    setCurrent(next);
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await updateBaseCurrencyAction({ baseCurrency: next });

    if (!result.ok) {
      // Возвращаем прежнее значение: показывать выбранное, когда оно
      // не сохранилось, значит врать о состоянии
      setCurrent(previous);
      setError(result.error.message);
      setPending(false);
      return;
    }

    setPending(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="baseCurrency" className="text-sm text-muted">
        Валюта итогов
      </label>

      <select
        id="baseCurrency"
        value={current}
        disabled={pending}
        onChange={(event) => change(event.target.value as CurrencyCode)}
        className="min-h-tap rounded-control border border-border bg-surface px-3 disabled:opacity-50"
      >
        {SUPPORTED_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>

      <p className="text-xs text-muted">
        В ней считаются суммы за месяц и год. Подписки остаются в своей валюте.
      </p>

      {saved ? (
        <p role="status" className="text-xs text-accent-text">
          Сохранено
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
