import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { getEnv } from '@/lib/env';

/**
 * Криптографические примитивы — docs/06-security-privacy.md.
 *
 * Правила, которые здесь закреплены:
 *   • токены сессий хранятся ХЕШЕМ — утечка дампа не даёт войти (T7)
 *   • OTP-коды генерируются crypto.randomInt, не Math.random (T3)
 *   • токены внешних источников шифруются AES-256-GCM (T4)
 *   • сравнение секретов — только timing-safe
 */

// ── Токены сессий ────────────────────────────────────────

/** Криптостойкий токен сессии. Отдаётся клиенту, в БД не хранится. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** В БД кладётся результат этой функции, а не сам токен. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ── Одноразовые коды ─────────────────────────────────────

export const OTP_LENGTH = 6;

/**
 * Шестизначный код.
 * randomInt — криптостойкий; Math.random предсказуем и здесь недопустим.
 */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

export function hashOtp(code: string, email: string): string {
  // Email в качестве соли: одинаковые коды у разных адресов
  // дают разные хеши, поэтому по базе нельзя найти совпадения.
  return createHash('sha256').update(`${email}:${code}`).digest('hex');
}

// ── Сравнение секретов ───────────────────────────────────

/**
 * Сравнение за постоянное время.
 * Обычное === утекает информацию через время выполнения.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ── Шифрование токенов внешних источников ────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Шифрует значение перед записью в БД (поле credentialsEnc).
 *
 * Ключ живёт в ENCRYPTION_KEY и НИКОГДА не хранится в базе —
 * поэтому утечка дампа без ключа не раскрывает токены.
 *
 * Формат: iv:authTag:ciphertext (всё в hex)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(
    ':',
  );
}

export function decrypt(payload: string): string {
  const key = getEncryptionKey();
  const parts = payload.split(':');

  if (parts.length !== 3) {
    throw new Error('Некорректный формат зашифрованного значения');
  }
  const [ivHex, authTagHex, dataHex] = parts as [string, string, string];

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

function getEncryptionKey(): Buffer {
  const key = Buffer.from(getEnv().ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY должен быть 32 байта (64 hex-символа)');
  }
  return key;
}
