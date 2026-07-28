'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { BroomIcon } from '@/components/ui/icons';
import { ServicePicker } from './service-picker';
import {
  CURRENCY_EXPONENT,
  SUPPORTED_CURRENCIES,
  currencyForRegion,
  parseMinor,
  resolveRegion,
  type CurrencyCode,
} from '@/domain/money';
import { getDictionary } from '@/locales';
import type { ServiceSuggestion } from '@/server/actions/catalog';
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
  /** Заполнен, если подписка привязана к сервису из каталога */
  serviceId: string | null;
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

/** Пустая форма — состояние, к которому возвращает сброс при создании */
const BLANK: Omit<SubscriptionFormValues, 'id'> = {
  serviceId: null,
  customName: '',
  amount: '',
  currency: 'RUB',
  period: 'monthly',
  periodDays: '',
  firstBillingAt: '',
  categoryId: '',
  isTrial: false,
  trialEndsAt: '',
  paymentLabel: '',
  note: '',
};

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

  /** Заполнен, если сервис выбран из каталога, а не введён руками */
  const [serviceId, setServiceId] = useState<string | null>(
    initial?.serviceId ?? null,
  );

  /**
   * Валюта по региону устройства — FR-08.
   *
   * Определяется ПОСЛЕ монтирования, а не при рендере: на сервере
   * часового пояса пользователя нет, и подстановка на этапе рендера
   * дала бы расхождение разметки при гидрации.
   *
   * Регион берётся из часового пояса, а не из GPS: системный запрос
   * доступа к местоположению ради выбора валюты был бы несоразмерным
   * (NFR-04) и отпугнул бы половину пользователей.
   */
  const [detectedCurrency, setDetectedCurrency] = useState<CurrencyCode | null>(
    null,
  );
  const currencyTouched = useRef(false);

  useEffect(() => {
    // При правке валюта уже выбрана пользователем — не трогаем
    if (initial) return;

    const region = resolveRegion({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: typeof navigator === 'undefined' ? null : navigator.language,
    });

    const detected = currencyForRegion(region);
    setDetectedCurrency(detected);

    if (!currencyTouched.current) setCurrency(detected);
    // Определяем один раз при монтировании
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCategory = categories.find((item) => item.id === categoryId);

  /**
   * Состояние, к которому возвращает сброс: пустая форма при создании,
   * сохранённые значения при правке. Одна механика на оба режима —
   * «отменить то, что я тут наменял».
   */
  const baseline: Omit<SubscriptionFormValues, 'id'> = initial ?? {
    ...BLANK,
    // Сброс возвращает к валюте региона, а не к жёстко зашитой:
    // иначе метёлка молча превращала бы тенге в рубли
    currency: detectedCurrency ?? BLANK.currency,
    firstBillingAt: defaultBillingDate(),
  };

  const isDirty =
    name !== baseline.customName ||
    amount !== baseline.amount ||
    currency !== baseline.currency ||
    period !== baseline.period ||
    periodDays !== baseline.periodDays ||
    firstBillingAt !== baseline.firstBillingAt ||
    categoryId !== baseline.categoryId ||
    isTrial !== baseline.isTrial ||
    trialEndsAt !== baseline.trialEndsAt ||
    paymentLabel !== baseline.paymentLabel ||
    note !== baseline.note;

  function reset() {
    setName(baseline.customName);
    setAmount(baseline.amount);
    setCurrency(baseline.currency);
    setPeriod(baseline.period);
    setPeriodDays(baseline.periodDays);
    setFirstBillingAt(baseline.firstBillingAt);
    setCategoryId(baseline.categoryId);
    setIsTrial(baseline.isTrial);
    setTrialEndsAt(baseline.trialEndsAt);
    setPaymentLabel(baseline.paymentLabel);
    setNote(baseline.note);
    setServiceId(baseline.serviceId);
    setFieldErrors({});
    setFormError(null);
  }

  /**
   * Подстановка выбранного из каталога сервиса.
   *
   * Тариф подставляется ВСЕГДА, даже поверх введённого вручную.
   * Выбор сервиса из списка — явное действие: пользователь ждёт
   * цену именно этого сервиса, а не остатки от предыдущего выбора.
   * Значения остаются редактируемыми, если его тариф отличается.
   */
  function applySuggestion(service: ServiceSuggestion) {
    setName(service.name);
    setServiceId(service.id);

    if (service.categoryId) setCategoryId(service.categoryId);

    const plan = service.defaultPlan;
    if (!plan) return;

    const currencyCode = (plan.currency as CurrencyCode) ?? 'RUB';
    const exponent = CURRENCY_EXPONENT[currencyCode] ?? 2;
    const value = plan.amountMinor / 10 ** exponent;

    setAmount(
      Number.isInteger(value)
        ? String(value)
        : value.toFixed(exponent).replace('.', ','),
    );
    setCurrency(currencyCode);
    setPeriod(plan.period);
    setPeriodDays(plan.periodDays ? String(plan.periodDays) : '');
  }

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
      serviceId,
      // Название отправляем всегда: если сервис потом уберут
      // из каталога, подписка не превратится в безымянную
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
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Основное</CardTitle>

          {/*
            Кнопка неактивна, пока форма не тронута: случайное нажатие
            на нетронутой форме ничего не делает, а то, что она
            «загорается» после первой правки, само объясняет её смысл
          */}
          <button
            type="button"
            onClick={reset}
            disabled={!isDirty}
            aria-label={
              isEdit ? 'Вернуть сохранённые значения' : 'Очистить все поля'
            }
            title={isEdit ? 'Вернуть сохранённые значения' : 'Очистить все поля'}
            className="-mr-2 flex h-tap w-tap shrink-0 items-center justify-center rounded-control text-xl text-muted transition-colors hover:bg-surface-raised hover:text-fg disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <BroomIcon />
          </button>
        </div>

        <ServicePicker
          value={name}
          onValueChange={(next) => {
            setName(next);
            // Название изменили вручную — связь с каталогом больше
            // не действительна, иначе сохранили бы чужой serviceId
            setServiceId(null);
          }}
          onSelect={applySuggestion}
          onCategoryGuess={(guessedId) => {
            // Не перебиваем выбор пользователя: подставляем только
            // в пустое поле
            setCategoryId((current) => current || guessedId);
          }}
          categorySlug={selectedCategory?.slug ?? null}
          error={fieldErrors['customName']}
        />

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
              onChange={(event) => {
                // Явный выбор пользователя важнее определения по региону
                currencyTouched.current = true;
                setCurrency(event.target.value as CurrencyCode);
              }}
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
