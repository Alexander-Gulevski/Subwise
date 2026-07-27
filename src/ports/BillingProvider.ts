import type { Money } from '@/domain/money';

/**
 * Приём платежей — ADR-0005.
 *
 * В MVP оплата не подключается: реализация NoopBillingProvider выдаёт
 * тариф free всем. Разделение тарифов при этом существует с первого дня,
 * чтобы не добавлять проверки доступа задним числом по всему коду.
 *
 * Подключение YooKassa = новая реализация этого порта + вебхук.
 * Код вне модуля billing не меняется.
 */

export type Plan = 'free' | 'pro';

export type CheckoutSession = {
  readonly id: string;
  /** Куда отправить пользователя. null у заглушки */
  readonly redirectUrl: string | null;
};

export type SubscriptionStatusInBilling = {
  readonly plan: Plan;
  readonly activeUntil: Date | null;
  readonly willRenew: boolean;
};

export interface BillingProvider {
  readonly id: 'noop' | 'yookassa';

  /** Создаёт платёж за расширенный тариф */
  createCheckout(userId: string, plan: Plan, price: Money): Promise<CheckoutSession>;

  /** Текущий тариф по данным провайдера */
  getStatus(userId: string): Promise<SubscriptionStatusInBilling>;

  /** Обработка вебхука. Обязана быть идемпотентной */
  handleWebhook(payload: unknown, signature: string): Promise<void>;

  cancelRenewal(userId: string): Promise<void>;
}
