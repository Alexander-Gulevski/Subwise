/**
 * Способ входа — ADR-0003.
 *
 * ИНВАРИАНТ: паролей в системе нет. Провайдер не принимает и не
 * возвращает пароли ни в каком виде.
 *
 * В MVP активны telegram и email_otp. Яндекс ID и VK ID подключаются
 * добавлением реализации, без изменений в модели данных.
 */

export type AuthProviderId = 'telegram' | 'email_otp' | 'yandex' | 'vk';

/**
 * Подтверждённая личность. Возвращается только после того, как
 * провайдер убедился во владении идентификатором.
 */
export type VerifiedIdentity = {
  readonly provider: AuthProviderId;
  /** telegram id либо нормализованный email */
  readonly externalId: string;
  /** Email, если провайдер его сообщает — для объединения аккаунтов */
  readonly email: string | null;
  readonly verifiedAt: Date;
};

export type AuthChallengeResult =
  | { readonly status: 'sent' }
  /** Ответ одинаков и для существующего, и для несуществующего аккаунта (T10) */
  | { readonly status: 'rate_limited'; readonly retryAfterSeconds: number };

export type AuthVerifyResult =
  | { readonly status: 'verified'; readonly identity: VerifiedIdentity }
  | { readonly status: 'invalid' }
  | { readonly status: 'expired' }
  | { readonly status: 'too_many_attempts' };

export interface AuthProvider {
  readonly id: AuthProviderId;

  /**
   * Инициирует вход: отправляет код, готовит редирект.
   * Провайдеры без этапа запроса (Telegram Login) возвращают { status: 'sent' }.
   */
  challenge(identifier: string, meta: { ip: string }): Promise<AuthChallengeResult>;

  /** Проверяет предъявленное доказательство: код, подпись, токен */
  verify(payload: unknown, meta: { ip: string }): Promise<AuthVerifyResult>;
}
