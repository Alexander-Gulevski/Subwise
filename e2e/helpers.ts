import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

/**
 * Помощники сквозных тестов.
 *
 * Тесты ходят в ту же базу и тот же Redis, что и приложение: подменять
 * их нельзя, иначе проверка перестанет быть сквозной. Поэтому создаём
 * только свои записи с уникальным email и убираем их за собой.
 */

export const db = new PrismaClient();

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
    });
  }
  return redis;
}

/** Уникальный адрес на каждый прогон, чтобы тесты не мешали друг другу */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/**
 * Сбрасывает счётчики частоты запросов.
 *
 * Запрос кода ограничен тремя попытками за 15 минут на IP — верное
 * поведение для продакшена (угроза T3), но все тесты приходят
 * с localhost, поэтому четвёртый тест не получил бы код вовсе.
 *
 * Сбрасываем именно счётчики, а не ослабляем лимит: сам механизм
 * остаётся тем же, что и в бою.
 */
export async function resetRateLimits(): Promise<void> {
  const client = getRedis();
  const keys = await client.keys('rl:*');
  if (keys.length > 0) await client.del(...keys);
}

/**
 * Подменяет код у последнего выданного OTP на известный тесту.
 *
 * Настоящий код печатается только в консоль сервера, и читать её
 * из теста ненадёжно. Подмена хеша в базе даёт детерминированный
 * сценарий, не ослабляя продуктовый код: приложение по-прежнему
 * сравнивает хеши и ничего не знает про тесты.
 */
export async function forceOtpCode(email: string, code: string): Promise<void> {
  const latest = await db.emailOtp.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (!latest) {
    throw new Error(
      `Для ${email} не найден активный код. ` +
        'Либо форма его не запросила, либо сработал лимит частоты — ' +
        'проверь, что вызван resetRateLimits()',
    );
  }

  await db.emailOtp.update({
    where: { id: latest.id },
    // Тот же алгоритм, что в src/lib/crypto.ts. Если он изменится,
    // тест сломается громко — это правильное поведение.
    data: { codeHash: createHash('sha256').update(`${email}:${code}`).digest('hex') },
  });
}

/**
 * Проходит вход через интерфейс и оставляет страницу на дашборде.
 *
 * Именно через интерфейс, а не подстановкой cookie: тест должен
 * пользоваться приложением так же, как пользователь.
 *
 * По умолчанию онбординг помечается пройденным: новый пользователь
 * попадает в него автоматически, и без этого каждый тест начинался бы
 * с прохождения сетки сервисов. Тесты самого онбординга передают
 * `onboarding: 'keep'`.
 */
export async function loginViaUi(
  page: Page,
  email: string,
  options: { code?: string; onboarding?: 'skip' | 'keep' } = {},
): Promise<void> {
  const code = options.code ?? '424242';
  const onboarding = options.onboarding ?? 'skip';

  await resetRateLimits();

  await page.goto('/login');
  await page.getByLabel('Почта').fill(email);
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').waitFor();

  await forceOtpCode(email, code);
  await page.getByLabel('Код из письма').fill(code);
  await page.getByRole('button', { name: 'Войти' }).click();

  await page.waitForURL(/\/app(\/onboarding)?$/);

  if (onboarding === 'skip') {
    await markOnboarded(email);
    await page.goto('/app');
  }
}

/** Помечает онбординг пройденным, минуя интерфейс */
export async function markOnboarded(email: string): Promise<void> {
  const identity = await db.authIdentity.findFirst({
    where: { externalId: email },
    select: { userId: true },
  });

  if (!identity) return;

  await db.userSettings.updateMany({
    where: { userId: identity.userId },
    data: { onboardedAt: new Date() },
  });
}

/**
 * Курс валюты для теста.
 *
 * Тесты не полагаются на то, что курсы кто-то загрузил: они сами
 * задают нужное состояние. Иначе набор зависел бы от того, дёргали ли
 * сегодня cron-эндпоинт.
 */
export async function seedExchangeRate(
  currency: string,
  rateMinor: number,
  date = todayUtc(),
): Promise<void> {
  await db.exchangeRate.upsert({
    where: { currency_date: { currency, date } },
    update: { rateMinor },
    create: { currency, date, rateMinor, source: 'cbr' },
  });
}

export async function clearExchangeRates(currency?: string): Promise<void> {
  if (currency) {
    await db.exchangeRate.deleteMany({ where: { currency } });
    return;
  }

  await db.exchangeRate.deleteMany();
}

export function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function cleanupUser(email: string): Promise<void> {
  await db.emailOtp.deleteMany({ where: { email } });

  const identity = await db.authIdentity.findFirst({
    where: { externalId: email },
    select: { userId: true },
  });

  if (identity) {
    // Каскад удалит сессии, настройки и правила напоминаний
    await db.user.deleteMany({ where: { id: identity.userId } });
  }
}

export async function disconnect(): Promise<void> {
  await db.$disconnect();
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}
