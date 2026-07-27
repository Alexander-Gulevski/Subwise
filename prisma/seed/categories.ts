/**
 * Системные категории подписок.
 * Зона ответственности агента catalog-curator.
 */

export type CategorySeed = {
  slug: string;
  name: string;
  icon: string;
};

export const categories: CategorySeed[] = [
  { slug: 'video', name: 'Видео и кино', icon: '🎬' },
  { slug: 'music', name: 'Музыка', icon: '🎧' },
  { slug: 'cloud', name: 'Облако и хранилища', icon: '☁️' },
  { slug: 'education', name: 'Обучение', icon: '📚' },
  { slug: 'games', name: 'Игры', icon: '🎮' },
  { slug: 'software', name: 'Софт и сервисы', icon: '🛠' },
  { slug: 'delivery', name: 'Доставка и маркетплейсы', icon: '📦' },
  { slug: 'communication', name: 'Связь и VPN', icon: '📡' },
  { slug: 'health', name: 'Здоровье и спорт', icon: '💪' },
  { slug: 'finance', name: 'Финансы', icon: '💳' },
  { slug: 'news', name: 'Новости и чтение', icon: '📰' },
  { slug: 'other', name: 'Другое', icon: '•' },
];
