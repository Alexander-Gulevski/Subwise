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

/**
 * Метёлка — сброс формы.
 *
 * Читается лучше кисточки: кисть ассоциируется с рисованием,
 * метла — со «смахнуть всё разом», а это ровно то, что делает кнопка.
 *
 * Геометрия построена вокруг диагонали 45°: ручка идёт по ней,
 * ворс раскрывается трапецией перпендикулярно, поперечная перевязь
 * не даёт ворсу читаться сплошным пятном на мелком размере.
 */
export function BroomIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M19.8 4.2 13.4 10.6" />
      <path d="M11.8 9.8 5 13l6 6 3.2-6.8z" />
      <path d="M7.9 11.6 12.4 16.1" />
    </svg>
  );
}

