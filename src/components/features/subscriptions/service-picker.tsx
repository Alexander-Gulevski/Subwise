'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Monogram, type CategorySlug } from '@/components/ui/monogram';
import {
  guessCategoryAction,
  searchServicesAction,
  type ServiceSuggestion,
} from '@/server/actions/catalog';

/**
 * Поле названия сервиса с подсказками из каталога — FR-04.
 *
 * Комбобокс с полной клавиатурной навигацией: стрелки, Enter, Escape
 * (NFR-02). Свободный ввод разрешён — сервиса может не быть
 * в каталоге, и это нормальный путь, а не ошибка.
 *
 * Категория определяется сама: выбранный из каталога сервис приносит
 * свою, а произвольное название проходит через угадывание
 * по ключевым словам.
 */

/** Пауза после набора: запрос на каждую букву перегружал бы сервер зря */
const DEBOUNCE_MS = 250;

export function ServicePicker({
  value,
  onValueChange,
  onSelect,
  onCategoryGuess,
  categorySlug,
  error,
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** Пользователь выбрал сервис из каталога */
  onSelect: (service: ServiceSuggestion) => void;
  /** Категория угадана по свободному вводу */
  onCategoryGuess: (categoryId: string) => void;
  categorySlug: string | null;
  error?: string;
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Показывать подсказки к уже выбранному значению не нужно:
  // иначе список открывается сразу после выбора
  const justSelected = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      const result = await searchServicesAction({ query });
      if (!result.ok) return;

      setSuggestions(result.data);
      setActiveIndex(-1);
      setIsOpen(result.data.length > 0);

      // Сервиса в каталоге нет — пробуем угадать категорию
      // по ключевым словам, чтобы поле не осталось пустым
      if (result.data.length === 0) {
        const guess = await guessCategoryAction({ query });
        if (guess.ok && guess.data.categoryId) {
          onCategoryGuess(guess.data.categoryId);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // onCategoryGuess стабилен у вызывающего кода
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function choose(service: ServiceSuggestion) {
    justSelected.current = true;
    onSelect(service);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      // Enter выбирает подсказку, а не отправляет форму
      event.preventDefault();
      const picked = suggestions[activeIndex];
      if (picked) choose(picked);
      return;
    }
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      <label htmlFor="name" className="text-sm font-medium">
        Сервис
      </label>

      {/*
        Список позиционируется относительно ЭТОГО контейнера, а не всего
        поля: иначе он открывается ниже поясняющего текста и выглядит
        оторванным от ввода
      */}
      <div className="relative flex items-center gap-3">
        <Monogram
          name={value || '?'}
          category={(categorySlug as CategorySlug) ?? 'other'}
          size="md"
        />
        <input
          id="name"
          required
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setIsOpen(suggestions.length > 0)}
          placeholder="Кинопоиск"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          className="min-h-tap w-full rounded-control border border-border bg-surface px-3 text-base"
        />

        {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          // Метка не должна содержать слово «Сервис»: иначе она
          // конфликтует с подписью самого поля при поиске по тексту
          aria-label="Совпадения в каталоге"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-card border border-border bg-surface py-1 shadow-md"
        >
          {suggestions.map((service, index) => (
            <li key={service.id} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onClick={() => choose(service)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex min-h-tap w-full items-center gap-3 px-3 text-left ${
                  index === activeIndex ? 'bg-surface-raised' : ''
                }`}
              >
                <Monogram
                  name={service.name}
                  category={(service.categorySlug as CategorySlug) ?? 'other'}
                  size="sm"
                />
                <span className="flex-1 truncate">{service.name}</span>
                {service.defaultPlan ? (
                  <span className="tabular shrink-0 text-sm text-muted">
                    {formatHint(service.defaultPlan)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        ) : null}
      </div>

      <p className="text-xs text-muted">
        Выбери из списка — сумма и категория подставятся сами. Или введи своё
        название.
      </p>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const PERIOD_HINT: Record<string, string> = {
  weekly: 'нед.',
  monthly: 'мес.',
  quarterly: 'кв.',
  semiannual: 'полгода',
  yearly: 'год',
  custom: '',
};

function formatHint(plan: {
  amountMinor: number;
  currency: string;
  period: string;
}): string {
  const value = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: plan.currency,
    maximumFractionDigits: plan.amountMinor % 100 === 0 ? 0 : 2,
    minimumFractionDigits: plan.amountMinor % 100 === 0 ? 0 : 2,
  }).format(plan.amountMinor / 100);

  const period = PERIOD_HINT[plan.period];
  return period ? `${value} / ${period}` : value;
}
