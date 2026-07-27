import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/cn';

/**
 * Кнопка — docs/10-design-system.md.
 *
 * Минимальная высота 44px — требование области нажатия (NFR-02).
 * Для действий используется <button>, для переходов — <a> через asChild.
 * <div onClick> — дефект, а не альтернатива.
 *
 * Вариант `pro` — только для функций расширенного тарифа. Использовать
 * его для обычного действия значит обесценить сигнал.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'pro' | 'danger';
type Size = 'md' | 'sm';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'bg-surface text-fg border border-border hover:border-border-strong',
  ghost: 'text-fg hover:bg-surface-raised',
  pro: 'bg-pro text-pro-fg hover:opacity-90',
  danger: 'bg-danger text-white hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-tap px-4 text-base',
  sm: 'min-h-[36px] px-3 text-sm',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-control font-medium',
          'transition-opacity disabled:pointer-events-none disabled:opacity-50',
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
