/**
 * Иконки интерфейса.
 *
 * Рисуются вручную, а не тянутся библиотекой: их пока единицы,
 * а лишняя зависимость ради трёх контуров не окупается. Размер
 * наследуется от родителя через `1em`, цвет — через currentColor,
 * поэтому иконка всегда согласована с текстом рядом.
 *
 * Все декоративные: подпись даёт кнопка через aria-label.
 */

type IconProps = {
  className?: string;
};

export function PencilIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Кисточка — сброс формы к исходному состоянию */
export function BrushIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M9.5 14.5 3 21" />
      <path d="M4 17h4v4" />
      <path d="M20.5 3.5a2.1 2.1 0 0 0-3 0l-8 8 3 3 8-8a2.1 2.1 0 0 0 0-3Z" />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M7 4.5v15l12-7.5Z" />
    </svg>
  );
}
