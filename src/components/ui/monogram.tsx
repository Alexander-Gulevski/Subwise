import { cn } from '@/lib/cn';

/**
 * Монограмма сервиса — замена логотипу.
 *
 * Выбрана вместо реальных логотипов сознательно: ноль вопросов
 * по лицензиям, единый вид у всех сервисов, мгновенная отрисовка
 * и работа офлайн. Пользовательский сервис без записи в каталоге
 * выглядит так же, как известный, — без «дырки» на месте картинки.
 *
 * Фон задаётся категорией, а не случайным хешем: две подписки одной
 * категории читаются как связанные.
 */

export type CategorySlug =
  | 'video'
  | 'music'
  | 'cloud'
  | 'education'
  | 'games'
  | 'software'
  | 'delivery'
  | 'communication'
  | 'health'
  | 'finance'
  | 'news'
  | 'other';

/**
 * Шесть тонов на двенадцать категорий: больше оттенков превращают
 * список в радугу и перестают что-либо различать.
 */
const CATEGORY_TONE: Record<CategorySlug, string> = {
  video: 'bg-[#FAECE7] text-[#712B13] dark:bg-[#4A1B0C] dark:text-[#F5C4B3]',
  music: 'bg-[#E1F5EE] text-[#085041] dark:bg-[#04342C] dark:text-[#9FE1CB]',
  cloud: 'bg-[#E6F1FB] text-[#0C447C] dark:bg-[#042C53] dark:text-[#B5D4F4]',
  education: 'bg-[#EEEDFE] text-[#3C3489] dark:bg-[#26215C] dark:text-[#CECBF6]',
  games: 'bg-[#FBEAF0] text-[#72243E] dark:bg-[#4B1528] dark:text-[#F4C0D1]',
  software: 'bg-[#F1EFE8] text-[#444441] dark:bg-[#2C2C2A] dark:text-[#D3D1C7]',
  delivery: 'bg-[#FAEEDA] text-[#633806] dark:bg-[#412402] dark:text-[#FAC775]',
  communication: 'bg-[#E6F1FB] text-[#0C447C] dark:bg-[#042C53] dark:text-[#B5D4F4]',
  health: 'bg-[#E1F5EE] text-[#085041] dark:bg-[#04342C] dark:text-[#9FE1CB]',
  finance: 'bg-[#EAF3DE] text-[#27500A] dark:bg-[#173404] dark:text-[#C0DD97]',
  news: 'bg-[#FAEEDA] text-[#633806] dark:bg-[#412402] dark:text-[#FAC775]',
  other: 'bg-[#F1EFE8] text-[#444441] dark:bg-[#2C2C2A] dark:text-[#D3D1C7]',
};

const SIZES = {
  sm: 'h-8 w-8 text-xs rounded-chip',
  md: 'h-10 w-10 text-sm rounded-control',
  lg: 'h-12 w-12 text-base rounded-control',
} as const;

export function Monogram({
  name,
  category = 'other',
  size = 'md',
  className,
}: {
  name: string;
  category?: CategorySlug;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      // Название сервиса всегда стоит рядом в разметке, поэтому
      // монограмма — декорация и не должна читаться скринридером дважды
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium',
        CATEGORY_TONE[category],
        SIZES[size],
        className,
      )}
    >
      {initial(name)}
    </span>
  );
}

/** Первая буква названия. Пропускает кавычки и прочий мусор в начале. */
export function initial(name: string): string {
  const match = name.match(/\p{L}|\p{N}/u);
  return (match?.[0] ?? '?').toUpperCase();
}
