/**
 * Хранилище одноразовых кодов входа.
 *
 * Порт существует потому, что адаптеру авторизации нужна персистентность,
 * а обращаться к БД напрямую он не вправе: доступ к данным принадлежит
 * слою server (docs/02-architecture.md). Реализация на Prisma живёт
 * в server/repositories/otp-store.ts.
 *
 * Хранится ХЕШ кода, не сам код (docs/06-security-privacy.md, T3).
 */

export type IssuedOtp = {
  readonly id: string;
  readonly codeHash: string;
  readonly expiresAt: Date;
  readonly attempts: number;
};

export interface OtpStore {
  /** Сохраняет выданный код */
  issue(email: string, codeHash: string, expiresAt: Date): Promise<void>;

  /** Последний непогашенный код для адреса */
  findLatestActive(email: string): Promise<IssuedOtp | null>;

  /** Неудачная попытка ввода */
  incrementAttempts(id: string): Promise<void>;

  /**
   * Гасит все активные коды адреса.
   * Вызывается после успешного входа: код одноразовый.
   */
  consumeAll(email: string): Promise<void>;
}

/** Отправка письма с кодом. Вынесена из адаптера, чтобы его можно было тестировать без SMTP. */
export interface OtpMailer {
  send(email: string, code: string): Promise<void>;
}
