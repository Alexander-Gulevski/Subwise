'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monogram, type CategorySlug } from '@/components/ui/monogram';
import {
  CURRENCY_EXPONENT,
  SUPPORTED_CURRENCIES,
  parseMinor,
  type CurrencyCode,
} from '@/domain/money';
import { getDictionary } from '@/locales';
import {
  createSubscriptionAction,
  updateSubscriptionAction,
} from '@/server/actions/subscriptions';

const t = getDictionary('ru');

export type CategoryOption = {
  id: string;
  slug: string;
  name: string;
};

/** Значения для режима правки. Даты — в формате поля input[type=date] */
export type SubscriptionFormValues = {
  id: string;
  customName: string;
  amount: string;
  currency: CurrencyCode;
  period: string;
  periodDays: string;
  firstBillingAt: string;
  categoryId: string;
  isTrial: boolean;
  trialEndsAt: string;
  paymentLabel: string;
  note: string;
};

const PERIODS = [
  { value: 'monthly', label: 'Раз в месяц' },
  { value: 'yearly', label: 'Раз в год' },
  { value: 'quarterly', label: 'Раз в квартал' },
  { value: 'semiannual', label: 'Раз в полгода' },
  { value: 'weekly', label: 'Раз в неделю' },
  { value: 'custom', label: 'Другой период' },
] as const;

const inputClass =
  'min-h-tap w-full rounded-control border border-border bg-surface px-3 text-base';

export function SubscriptionForm({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  /** Задан — форма правит существующую подписку, иначе создаёт новую */
  initial?: SubscriptionFormValues;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.customName ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [currency, setCurrency] = useState<CurrencyCode>(initial?.currency ?? 'RUB');
  const [period, setPeriod] = useState<string>(initial?.period ?? 'monthly');
  const [periodDays, setPeriodDays] = useState(initial?.periodDays ?? '');
  const [firstBillingAt, setFirstBillingAt] = useState(
    initial?.firstBillingAt ?? defaultBillingDate(),
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [isTrial, setIsTrial] = useState(initial?.isTrial ?? false);
  const [trialEndsAt, setTrialEndsAt] = useState(initial?.trialEndsAt ?? '');
  const [paymentLabel, setPaymentLabel] = useState(initial?.paymentLabel ?? '');
  const [note, setNote] = useState(initial?.note ?? '');

  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCategory = categories.find((item) => item.id === categoryId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    setFormError(null);

    const amountMinor = parseMinor(amount, CURRENCY_EXPONENT[currency]);

    if (amountMinor === null) {
      setFieldErrors({ amountMinor: 'Введи сумму, например 399' });
      setPending(false);
      return;
    }

    const payload = {
      customName: name,
      categoryId: categoryId || null,
      amountMinor,
      currency,
      period,
      periodDays: period === 'custom' ? Number(periodDays) || null : null,
      firstBillingAt,
      trialEndsAt: isTrial ? trialEndsAt || null : null,
      paymentLabel: paymentLabel || null,
      note: note || null,
    };

    const result = initial
      ? await updateSubscriptionAction({ ...payload, id: initial.id })
      : await createSubscriptionAction({ ...payload, isTrial });

    if (result.ok) {
      router.push('/app');
      router.refresh();
      return;
    }

    setFieldErrors(result.error.fields ?? {});
    setFormError(result.error.fields ? null : result.error.message);
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <Field label="Сервис" htmlFor="name" error={fieldErrors['customName']}>
          <div className="flex items-center gap-3">
            <Monogram
              name={name || '?'}
              category={(selectedCategory?.slug as CategorySlug) ?? 'other'}
              size="md"
            />
            <input
              id="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Кинопоиск"
              className={inputClass}
            />
          </div>
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Сумма" htmlFor="amount" error={fieldErrors['amountMinor']}>
            <input
              id="amount"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="399"
              className={`${inputClass} tabular`}
            />
          </Field>

          <Field label="Валюта" htmlFor="currency">
            <select
              id="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
              className={inputClass}
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Как часто списывают" htmlFor="period">
          <select
            id="period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className={inputClass}
          >
            {PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        {period === 'custom' ? (
          <Field
            label="Через сколько дней"
            htmlFor="periodDays"
            error={fieldErrors['periodDays']}
          >
            <input
              id="periodDays"
              inputMode="numeric"
              value={periodDays}
              onChange={(event) => setPeriodDays(event.target.value.replace(/\D/g, ''))}
              placeholder="45"
              className={`${inputClass} tabular`}
            />
          </Field>
        ) : null}

        <Field
          label={isTrial ? 'Первое платное списание' : 'Следующее списание'}
          htmlFor="firstBillingAt"
          error={fieldErrors['firstBillingAt']}
          hint={
            isEdit
              ? 'Изменение даты сдвинет всё расписание списаний'
              : undefined
          }
        >
          <input
            id="firstBillingAt"
            type="date"
            required
            value={firstBillingAt}
            onChange={(event) => setFirstBillingAt(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Категория" htmlFor="categoryId">
          <select
            id="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={inputClass}
          >
            <option value="">Без категории</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      {/*
        Переключатель триала показывается только при создании: перевод
        подписки из триала в платную выполняет фоновая задача по дате,
        а не пользователь (docs/03, диаграмма состояний)
      */}
      {!isEdit ? (
        <Card className="flex flex-col gap-4">
          <label className="flex min-h-tap cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isTrial}
              onChange={(event) => setIsTrial(event.target.checked)}
              className="h-5 w-5 accent-accent"
            />
            <span>
              <span className="font-medium">Сейчас идёт триал</span>
              <span className="block text-sm text-muted">
                Напомним заранее, чтобы списание не стало сюрпризом
              </span>
            </span>
          </label>

          {isTrial ? (
            <Field
              label="Когда заканчивается триал"
              htmlFor="trialEndsAt"
              error={fieldErrors['trialEndsAt']}
            >
              <input
                id="trialEndsAt"
                type="date"
                value={trialEndsAt}
                onChange={(event) => setTrialEndsAt(event.target.value)}
                className={inputClass}
              />
            </Field>
          ) : null}
        </Card>
      ) : null}

      {isEdit && isTrial ? (
        <Card>
          <Field
            label="Когда заканчивается триал"
            htmlFor="trialEndsAt"
            error={fieldErrors['trialEndsAt']}
          >
            <input
              id="trialEndsAt"
              type="date"
              value={trialEndsAt}
              onChange={(event) => setTrialEndsAt(event.target.value)}
              className={inputClass}
            />
          </Field>
        </Card>
      ) : null}

      <details className="rounded-card border border-border bg-surface">
        <summary className="flex min-h-tap cursor-pointer items-center px-4 text-sm text-muted">
          Необязательное
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <Field
            label="Чем платишь"
            htmlFor="paymentLabel"
            hint="Просто пометка для себя. Номер карты вводить не нужно"
          >
            <input
              id="paymentLabel"
              value={paymentLabel}
              onChange={(event) => setPaymentLabel(event.target.value)}
              placeholder="Тинькофф •4321"
              maxLength={60}
              className={inputClass}
            />
          </Field>

          <Field label="Заметка" htmlFor="note" error={fieldErrors['note']}>
            <textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-control border border-border bg-surface p-3 text-base"
            />
          </Field>
        </div>
      </details>

      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.loading : t.common.save}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** По умолчанию — сегодня: чаще всего подписку добавляют в день списания */
function defaultBillingDate(): string {
  return new Date().toISOString().slice(0, 10);
}
