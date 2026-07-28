import Link from 'next/link';
import { Monogram, type CategorySlug } from '@/components/ui/monogram';
import { PencilIcon } from '@/components/ui/icons';
import { formatMoney, type Money } from '@/domain/money';
import { cn } from '@/lib/cn';

/**
 * Строка подписки в списке.
 *
 * Статус передаётся текстом, а не только цветом — требование NFR-02.
 *
 * Переход в карточку — по отдельной кнопке, а не по всей строке:
 * так строка остаётся свободной под будущие быстрые действия
 * (пауза, «всё верно» из напоминания), и пользователю заранее видно,
 * что именно произойдёт по нажатию.
 */

const STATUS_LABEL: Record<string, string> = {
  active: 'Активна',
  trial: 'Триал',
  paused: 'На паузе',
  cancelled: 'Отменена',
  expired: 'Истекла',
};

const PERIOD_SHORT: Record<string, string> = {
  weekly: 'в неделю',
  monthly: 'в месяц',
  quarterly: 'в квартал',
  semiannual: 'в полгода',
  yearly: 'в год',
  custom: '',
};

export function SubscriptionRow({
  name,
  amount,
  amountInBase,
  period,
  status,
  category,
  daysUntilCharge,
  editHref,
  compact = false,
}: {
  name: string;
  /** Сумма одного списания — то, что реально спишут с карты */
  amount: Money;
  /** Пересчёт в базовую валюту. null — курса нет */
  amountInBase: Money | null;
  period: string;
  status: string;
  category: CategorySlug;
  daysUntilCharge: number | null;
  /** Задан — показывается кнопка перехода в карточку */
  editHref?: string;
  compact?: boolean;
}) {
  const needsConversion =
    amountInBase !== null && amountInBase.currency !== amount.currency;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-card border border-border bg-surface',
        compact ? 'px-3 py-2' : 'p-3',
      )}
    >
      <Monogram name={name} category={category} size={compact ? 'sm' : 'md'} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="text-sm text-muted">
          {/*
            Статус дублируется текстом, а не только цветом монограммы —
            требование NFR-02. Для триала он вшит в саму формулировку.
          */}
          {status !== 'active' && status !== 'trial' ? (
            <span className="mr-1">{STATUS_LABEL[status] ?? status}</span>
          ) : null}
          {formatChargeTiming(daysUntilCharge, status)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="tabular font-medium">{formatMoney(amount)}</p>
        {/* Период рядом с суммой: без него «3990 ₽» выглядит как месячный платёж */}
        {PERIOD_SHORT[period] ? (
          <p className="text-xs text-muted">{PERIOD_SHORT[period]}</p>
        ) : null}
        {needsConversion ? (
          <p className="tabular text-sm text-muted">
            ≈ {formatMoney(amountInBase)}
          </p>
        ) : null}
        {amountInBase === null ? (
          <p className="text-xs text-warn">нужен курс</p>
        ) : null}
      </div>

      {editHref ? (
        <Link
          href={editHref}
          // Иконка декоративная, поэтому подпись даёт сама ссылка.
          // Область нажатия 44×44 при видимой иконке 20px (NFR-02)
          aria-label={`Изменить: ${name}`}
          className="flex h-tap w-tap shrink-0 items-center justify-center rounded-control text-lg text-muted transition-colors hover:bg-surface-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PencilIcon />
        </Link>
      ) : null}
    </div>
  );
}

function formatChargeTiming(days: number | null, status: string): string {
  if (status === 'paused') return 'списания приостановлены';
  if (days === null) return '';

  // У триала дедлайн — окончание бесплатного периода. Говорить
  // «спишут через 3 дня» технически верно, но не отвечает на вопрос,
  // который у пользователя в голове: сколько осталось решать
  if (status === 'trial') {
    if (days < 0) return 'триал закончился';
    if (days === 0) return 'триал заканчивается сегодня';
    if (days === 1) return 'триал заканчивается завтра';
    return `триал заканчивается через ${days} ${pluralDays(days)}`;
  }

  if (days < 0) return 'дата прошла';
  if (days === 0) return 'спишут сегодня';
  if (days === 1) return 'спишут завтра';
  return `спишут через ${days} ${pluralDays(days)}`;
}

function pluralDays(days: number): string {
  const lastTwo = days % 100;
  const last = days % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}
