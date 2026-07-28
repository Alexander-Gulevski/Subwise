import { beforeAll, describe, expect, it } from 'vitest';
import {
  decrypt,
  encrypt,
  generateOtpCode,
  generateSessionToken,
  hashOtp,
  hashToken,
  safeEqual,
} from './crypto';

/**
 * Криптографические примитивы — docs/06-security-privacy.md.
 *
 * encrypt/decrypt пока никем не вызываются: они понадобятся импорту
 * на M3 для поля credentialsEnc. Тесты написаны сейчас, потому что
 * непроверенный код шифрования создаёт иллюзию готовности —
 * а когда он понадобится, его никто не станет разбирать заново.
 */

beforeAll(() => {
  // getEnv кэширует значения, поэтому задаём до первого обращения
  process.env['ENCRYPTION_KEY'] ??= 'a'.repeat(64);
  process.env['SESSION_SECRET'] ??= 'b'.repeat(64);
  process.env['APP_URL'] ??= 'http://localhost:3000';
  process.env['DATABASE_URL'] ??= 'postgresql://u:p@localhost:5432/db';
  process.env['REDIS_URL'] ??= 'redis://localhost:6379';
});

describe('токены сессий', () => {
  it('каждый токен уникален', () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateSessionToken()),
    );
    expect(tokens.size).toBe(100);
  });

  it('токен достаточно длинный, чтобы не перебирался', () => {
    // 32 байта в base64url
    expect(generateSessionToken().length).toBeGreaterThanOrEqual(43);
  });

  it('хеш детерминирован и не содержит исходного токена', () => {
    const token = generateSessionToken();
    const hash = hashToken(token);

    expect(hashToken(token)).toBe(hash);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
  });
});

describe('одноразовые коды', () => {
  it('всегда шесть цифр, включая ведущие нули', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it('коды различаются', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOtpCode()));
    expect(codes.size).toBeGreaterThan(40);
  });

  it('один и тот же код для разных адресов даёт разные хеши', () => {
    // Email как соль: иначе по базе можно было бы найти совпадения
    expect(hashOtp('123456', 'a@example.ru')).not.toBe(
      hashOtp('123456', 'b@example.ru'),
    );
  });

  it('хеш детерминирован', () => {
    expect(hashOtp('123456', 'a@example.ru')).toBe(
      hashOtp('123456', 'a@example.ru'),
    );
  });
});

describe('сравнение секретов', () => {
  it('одинаковые строки совпадают', () => {
    expect(safeEqual('secret-value', 'secret-value')).toBe(true);
  });

  it('разные строки не совпадают', () => {
    expect(safeEqual('secret-value', 'secret-valuf')).toBe(false);
  });

  it('строки разной длины не совпадают и не роняют сравнение', () => {
    expect(safeEqual('short', 'much-longer-value')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });
});

describe('шифрование токенов внешних источников', () => {
  it('расшифровывается обратно', () => {
    const secret = 'ya29.a0AfH6SMBexample-token';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('шифротекст не содержит исходного значения', () => {
    const secret = 'очень-секретный-токен';
    expect(encrypt(secret)).not.toContain(secret);
  });

  it('одно и то же значение шифруется по-разному', () => {
    // Случайный вектор инициализации: иначе одинаковые токены давали бы
    // одинаковый шифротекст, и по базе было бы видно, у кого он совпадает
    expect(encrypt('one-and-the-same')).not.toBe(encrypt('one-and-the-same'));
  });

  it('подмена шифротекста отклоняется, а не расшифровывается в мусор', () => {
    const payload = encrypt('важный токен');
    const [iv, tag, data] = payload.split(':');
    const tampered = [iv, tag, data?.replace(/.$/, '0')].join(':');

    // GCM проверяет целостность: испорченные данные не пройдут
    expect(() => decrypt(tampered)).toThrow();
  });

  it('подмена метки подлинности отклоняется', () => {
    const payload = encrypt('важный токен');
    const [iv, , data] = payload.split(':');
    const tampered = [iv, '0'.repeat(32), data].join(':');

    expect(() => decrypt(tampered)).toThrow();
  });

  it('некорректный формат отклоняется с понятной ошибкой', () => {
    expect(() => decrypt('не-шифротекст')).toThrow(/формат/);
  });

  it('пустая строка шифруется и расшифровывается', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });
});
