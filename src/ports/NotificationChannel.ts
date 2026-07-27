/**
 * Канал доставки уведомлений — FR-06.
 *
 * ИНВАРИАНТ: отказ одного канала не влияет на остальные. Ошибка
 * логируется, доставка по другим каналам продолжается (NFR-05).
 *
 * ИНВАРИАНТ: dedupeKey обеспечивает идемпотентность. Повторный вызов
 * с тем же ключом не отправляет второе сообщение — планировщик можно
 * безопасно перезапускать.
 */

export type NotificationChannelId = 'inapp' | 'telegram' | 'webpush' | 'email';

export type NotificationType =
  | 'upcoming_charge'
  | 'trial_ending'
  | 'guide_outdated'
  | 'weekly_digest';

/** Действие-кнопка внутри уведомления — docs/05-ux-flows.md */
export type NotificationAction = {
  readonly id: 'confirm' | 'cancel' | 'snooze';
  readonly label: string;
  readonly url: string;
};

export type NotificationMessage = {
  readonly userId: string;
  readonly type: NotificationType;
  /** Первая строка: сумма и сервис. «Завтра спишут 399 ₽ — Кинопоиск» */
  readonly title: string;
  readonly body: string;
  readonly actions: readonly NotificationAction[];
  /** Ссылка на отключение этого типа уведомлений. Обязательна для внешних каналов */
  readonly unsubscribeUrl: string;
};

export type DeliveryResult =
  | { readonly status: 'sent'; readonly sentAt: Date }
  | { readonly status: 'skipped'; readonly reason: 'duplicate' | 'unavailable' }
  | { readonly status: 'failed'; readonly error: string };

export interface NotificationChannel {
  readonly id: NotificationChannelId;

  /** Подключён ли канал у пользователя (есть ли telegram id, push-подписка, email) */
  isAvailableFor(userId: string): Promise<boolean>;

  /** dedupeKey = hash(eventId, ruleId, channelId) */
  send(message: NotificationMessage, dedupeKey: string): Promise<DeliveryResult>;
}
