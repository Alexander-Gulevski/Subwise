'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monogram, type CategorySlug } from '@/components/ui/monogram';
import {
  CURRENCY_EXPONENT,
  SUPPORTED_CURRENCIES,
  currencyForRegion,
  formatMoney,
  money,
  resolveRegion,
  type CurrencyCode,
} from '@/domain/money';
import {
  completeOnboardingAction,
  skipOnboardingAction,
} from '@/server/actions/onboarding';
import { seedBaseCurrencyAction } from '@/server/actions/settings';

/**
 * Онбординг — docs/05-ux-flows.md.
 *
 * Два шага вместо ввода по одной подписке:
 *   1. отметить свои сервисы в сетке — это узнавание, а не ввод
 *   2. проставить даты списаний, тарифы уже подставлены
 *
 * Цель — не больше 90 секунд до заполненного дашборда.
 */

export type OnboardingService = {
  id: string;
  name: string;
  categorySlug: string | null;
  defaultPlan: {
    amountMinor: number;
    currency: string;
    period: string;
    periodDays: number | null;
  } | null;
};

type Draft = {
  amount: string;
  currency: CurrencyCode;
  period: string;
  periodDays: number | null;
  firstBillingAt: string;
};

export function OnboardingFlow({ services }: { services: OnboardingService[] }) {
  const router = useRouter();

  const [step, setStep] = useState<'pick' | 'dates'>('pick');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Валюта итогов — единственное место, где мы её угадываем.
   *
   * Определение по региону не отличает Беларусь от России: обе
   * в UTC+3, и Windows в Минске нередко стоит на московском времени.
   * Поэтому здесь оно только ПРЕДЛАГАЕТ значение, а пользователь
   * может поправить прямо тут же и позже в настройках.
   *
   * После монтирования, а не при рендере: на сервере часового пояса
   * нет, и подстановка на этапе рендера сломала бы гидрацию.
   */
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('RUB');

  useEffect(() => {
    const detected = currencyForRegion(
      resolveRegion({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: typeof navigator === 'undefined' ? null : navigator.language,
      }),
    );

    setBaseCurrency(detected);
    void seedBaseCurrencyAction({ baseCurrency: detected });
  }, []);

  async function changeCurrency(next: CurrencyCode) {
    setBaseCurrency(next);
    await seedBaseCurrencyAction({ baseCurrency: next });
  }

  const chosen = services.filter((service) => selected.has(service.id));

  function toggle(service: OnboardingService) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(service.id)) {
        next.delete(service.id);
      } else {
        next.add(service.id);
        // Черновик заводим сразу при отметке: на втором шаге поля
        // уже заполнены, и остаётся только дата
        setDrafts((all) =>
          all[service.id] ? all : { ...all, [service.id]: draftFor(service) },
        );
      }

      return next;
    });
  }

  function patch(id: string, changes: Partial<Draft>) {
    setDrafts((all) => {
      const current = all[id];
      return current ? { ...all, [id]: { ...current, ...changes } } : all;
    });
  }

  async function finish() {
    setPending(true);
    setError(null);

    const items = chosen.flatMap((service) => {
      const draft = drafts[service.id];
      if (!draft) return [];

      const exponent = CURRENCY_EXPONENT[draft.currency] ?? 2;
      const parsed = Number(draft.amount.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed <= 0) return [];

      return [
        {
          serviceId: service.id,
          amountMinor: Math.round(parsed * 10 ** exponent),
          currency: draft.currency,
          period: draft.period,
          periodDays: draft.periodDays,
          firstBillingAt: draft.firstBillingAt,
        },
      ];
    });

    const result = await completeOnboardingAction({ items });

    if (!result.ok) {
      setError(result.error.message);
      setPending(false);
      return;
    }

    router.push('/app');
    router.refresh();
  }

  async function skip() {
    setPending(true);
    await skipOnboardingAction();
    router.push('/app');
    router.refresh();
  }

  if (step === 'dates') {
    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Когда списывают?</h1>
          <p className="text-sm text-muted">
            Суммы подставлены по типовым тарифам — поправь, если у тебя другой.
          </p>
        </header>

        <div className="flex flex-col gap-3">
          {chosen.map((service) => {
            const draft = drafts[service.id];
            if (!draft) return null;

            return (
              <Card key={service.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Monogram
                    name={service.name}
                    category={(service.categorySlug as CategorySlug) ?? 'other'}
                    size="sm"
                  />
                  <span className="flex-1 font-medium">{service.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`amount-${service.id}`}
                      className="text-sm text-muted"
                    >
                      Сумма
                    </label>
                    <input
                      id={`amount-${service.id}`}
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(event) =>
                        patch(service.id, { amount: event.target.value })
                      }
                      className="tabular min-h-tap rounded-control border border-border bg-surface px-3"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`date-${service.id}`}
                      className="text-sm text-muted"
                    >
                      Спишут
                    </label>
                    <input
                      id={`date-${service.id}`}
                      type="date"
                      value={draft.firstBillingAt}
                      onChange={(event) =>
                        patch(service.id, { firstBillingAt: event.target.value })
                      }
                      className="min-h-tap rounded-control border border-border bg-surface px-3"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button onClick={finish} disabled={pending}>
            {pending ? 'Сохраняем…' : 'Готово'}
          </Button>
          <Button variant="ghost" onClick={() => setStep('pick')} disabled={pending}>
            Назад
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Чем пользуешься?</h1>
        <p className="text-sm text-muted">
          Отметь свои подписки — остальное добавим потом. Ничего страшного,
          если сервиса нет в списке.
        </p>
      </header>

      {/*
        Валюта итогов прямо здесь, а не отдельным экраном: одно поле
        не стоит целого шага. Значение предложено по региону, но
        угадывание ошибается — например, не отличает Беларусь от России
      */}
      <div className="flex items-center gap-3">
        <label htmlFor="baseCurrency" className="text-sm text-muted">
          Считать итоги в
        </label>
        <select
          id="baseCurrency"
          value={baseCurrency}
          onChange={(event) => changeCurrency(event.target.value as CurrencyCode)}
          className="min-h-tap rounded-control border border-border bg-surface px-3"
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {services.map((service) => {
          const isSelected = selected.has(service.id);

          return (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => toggle(service)}
                aria-pressed={isSelected}
                className={`flex w-full flex-col items-center gap-2 rounded-card border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected
                    ? 'border-accent bg-accent-soft'
                    : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                <Monogram
                  name={service.name}
                  category={(service.categorySlug as CategorySlug) ?? 'other'}
                  size="md"
                />
                <span className="text-sm font-medium leading-tight">
                  {service.name}
                </span>
                {service.defaultPlan ? (
                  <span className="tabular text-xs text-muted">
                    {formatMoney(
                      money(
                        service.defaultPlan.amountMinor,
                        service.defaultPlan.currency as CurrencyCode,
                      ),
                    )}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <Button onClick={() => setStep('dates')} disabled={selected.size === 0}>
          {selected.size === 0
            ? 'Выбери хотя бы одну'
            : `Далее — ${selected.size}`}
        </Button>
        <Button variant="ghost" onClick={skip} disabled={pending}>
          Пропустить
        </Button>
      </div>
    </div>
  );
}

function draftFor(service: OnboardingService): Draft {
  const plan = service.defaultPlan;
  const currency = (plan?.currency as CurrencyCode) ?? 'RUB';
  const exponent = CURRENCY_EXPONENT[currency] ?? 2;
  const value = (plan?.amountMinor ?? 0) / 10 ** exponent;

  return {
    amount: value > 0 ? formatAmount(value, exponent) : '',
    currency,
    period: plan?.period ?? 'monthly',
    periodDays: plan?.periodDays ?? null,
    // Сегодня как отправная точка: чаще всего подписку заводят
    // в день, когда увидели списание
    firstBillingAt: new Date().toISOString().slice(0, 10),
  };
}

function formatAmount(value: number, exponent: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(exponent).replace('.', ',');
}
