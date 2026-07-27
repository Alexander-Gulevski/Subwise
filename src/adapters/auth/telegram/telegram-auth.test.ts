import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildCheckString,
  verifyTelegramSignature,
  type TelegramPayload,
} from './telegram-auth';

/**
 * Проверка подписи Telegram — угроза T2 из docs/06-security-privacy.md.
 *
 * Без этой проверки вход подделывается отправкой произвольного
 * telegram id. Тест самый важный во всём модуле авторизации.
 */

const BOT_TOKEN = '123456:TEST-TOKEN-NOT-REAL';

/** Подписывает данные так же, как это делает Telegram */
function sign(fields: Record<string, string | number>): string {
  const secretKey = createHash('sha256').update(BOT_TOKEN).digest();
  return createHmac('sha256', secretKey)
    .update(buildCheckString(fields))
    .digest('hex');
}

function validPayload(
  overrides: Partial<Record<string, string | number>> = {},
): TelegramPayload {
  const fields = {
    id: '42',
    first_name: 'Саша',
    username: 'sasha',
    auth_date: 1_785_000_000,
    ...overrides,
  };
  return { ...fields, hash: sign(fields) } as TelegramPayload;
}

describe('подпись Telegram', () => {
  it('корректная подпись принимается', () => {
    expect(verifyTelegramSignature(validPayload(), BOT_TOKEN)).toBe(true);
  });

  it('выдуманная подпись отклоняется', () => {
    const payload = { ...validPayload(), hash: 'deadbeef' } as TelegramPayload;
    expect(verifyTelegramSignature(payload, BOT_TOKEN)).toBe(false);
  });

  it('подменённый telegram id ломает подпись', () => {
    // Главный сценарий атаки: злоумышленник хочет войти под чужим id
    const payload = validPayload();
    const forged = { ...payload, id: '999' } as TelegramPayload;
    expect(verifyTelegramSignature(forged, BOT_TOKEN)).toBe(false);
  });

  it('подменённое имя тоже ломает подпись', () => {
    const payload = validPayload();
    const forged = { ...payload, first_name: 'Кто-то другой' } as TelegramPayload;
    expect(verifyTelegramSignature(forged, BOT_TOKEN)).toBe(false);
  });

  it('чужой токен бота не подходит', () => {
    expect(verifyTelegramSignature(validPayload(), 'другой-токен')).toBe(false);
  });

  it('подпись той же длины, но неверная, отклоняется', () => {
    // Проверяем именно сравнение, а не ранний выход по длине
    const payload = validPayload();
    const wrong = sign({ id: '43', first_name: 'Саша', username: 'sasha', auth_date: 1_785_000_000 });
    expect(wrong).toHaveLength(payload.hash.length);
    expect(
      verifyTelegramSignature({ ...payload, hash: wrong } as TelegramPayload, BOT_TOKEN),
    ).toBe(false);
  });
});

describe('формат строки проверки', () => {
  it('поля сортируются и склеиваются через перевод строки', () => {
    expect(buildCheckString({ b: '2', a: '1', c: '3' })).toBe('a=1\nb=2\nc=3');
  });

  it('незаданные поля не участвуют', () => {
    expect(buildCheckString({ a: '1', b: undefined })).toBe('a=1');
  });
});
