import * as React from 'react';
import { cn } from '@/lib/cn';

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface p-4',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-sm font-medium uppercase tracking-wide text-muted', className)}
      {...props}
    />
  );
}

/**
 * Скелетон загрузки — по форме будущего контента, не спиннер по центру
 * (docs/05-ux-flows.md, четыре состояния экрана).
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-chip bg-border', className)}
      {...props}
    />
  );
}

/**
 * Пустое состояние. Никогда не «Нет данных» — всегда объяснение
 * и следующее действие.
 */
export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-10 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action}
    </div>
  );
}
