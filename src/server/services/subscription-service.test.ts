import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { subscriptionService } from './subscription-service';
import { createTestUser, resetUserData, utcDate } from '@/server/__tests__/helpers';

/**
 * Интеграционные тесты сервиса подписок.
 *
 * Работают на НАСТОЯЩЕЙ PostgreSQL (docs/07-testing-strategy.md, раздел 5):
 * SQLite отличается типами и часовыми поясами и пропустил бы ровно те
 * баги, которые мы ловим.
 *
 * Главный блок здесь — изоляция данных. Тест на каждое действие
 * обязателен: пропуск проверки владения открывает доступ к чужим
 * подпискам (угроза T1).
 */

const baseInput = {
  customName: 'Кинопоиск',
  amountMinor: 39_900,
  currency: 'RUB' as const,
  period: 'monthly' as const,
  firstBillingAt: utcDate('2026-08-31'),
};

beforeEach(async () => {
  await resetUserData();
});

afterAll(async () => {
  await resetUserData();
  await db.$disconnect();
});

describe('создание', () => {
  it('создаёт подписку и первое расписание', async () => {
    const user = await createTestUser();

    const created = await subscriptionService.create(user.id, baseInput);

    expect(created.status).toBe('active');
    expect(created.amountMinor).toBe(39_900);
    expect(created.billingAnchorAt.toISOString()).toBe('2026-08-31T00:00:00.000Z');

    const events = await db.billingEvent.findMany({
      where: { subscriptionId: created.id },
      orderBy: { dueAt: 'asc' },
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.amountMinor).toBe(39_900);
  });

  it('расписание сохраняет якорный день месяца', async () => {
    const user = await createTestUser();

    const created = await subscriptionService.create(user.id, baseInput);

    const events = await db.billingEvent.findMany({
      where: { subscriptionId: created.id },
      orderBy: { dueAt: 'asc' },
      take: 4,
    });

    const dates = events.map((e) => e.dueAt.toISOString().slice(0, 10));

    // 31 августа → 30 сентября → 31 октября, а НЕ 30 октября:
    // якорь остаётся 31 числом
    expect(dates).toEqual(['2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30']);
  });

  it('триал становится активным с даты окончания триала', async () => {
    const user = await createTestUser();

    const created = await subscriptionService.create(user.id, {
      ...baseInput,
      isTrial: true,
      trialEndsAt: utcDate('2026-08-10'),
    });

    expect(created.status).toBe('trial');
    expect(created.trialEndsAt?.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    // Первое платное списание — день окончания триала
    expect(created.nextBillingAt?.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });

  it('без сервиса и без названия создать нельзя', async () => {
    const user = await createTestUser();

    await expect(
      subscriptionService.create(user.id, { ...baseInput, customName: null }),
    ).rejects.toThrow();
  });
});

describe('ИЗОЛЯЦИЯ ДАННЫХ', () => {
  it('чужая подписка не читается и отвечает «не найдено»', async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const subscription = await subscriptionService.create(owner.id, baseInput);

    await expect(
      subscriptionService.get(stranger.id, subscription.id),
    ).rejects.toThrow(/не найден/i);
  });

  it('чужую подписку нельзя поставить на паузу, и она не меняется', async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const subscription = await subscriptionService.create(owner.id, baseInput);

    await expect(
      subscriptionService.pause(stranger.id, subscription.id),
    ).rejects.toThrow(/не найден/i);

    const unchanged = await subscriptionService.get(owner.id, subscription.id);
    expect(unchanged.status).toBe('active');
  });

  it('чужую подписку нельзя удалить, и она остаётся на месте', async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const subscription = await subscriptionService.create(owner.id, baseInput);

    await expect(
      subscriptionService.softDelete(stranger.id, subscription.id),
    ).rejects.toThrow(/не найден/i);

    const survived = await subscriptionService.get(owner.id, subscription.id);
    expect(survived.id).toBe(subscription.id);
  });

  it('чужую подписку нельзя восстановить', async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const subscription = await subscriptionService.create(owner.id, baseInput);
    await subscriptionService.softDelete(owner.id, subscription.id);

    await expect(
      subscriptionService.restore(stranger.id, subscription.id),
    ).rejects.toThrow(/не найден/i);
  });

  it('в списке видны только свои подписки', async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    await subscriptionService.create(owner.id, baseInput);
    await subscriptionService.create(stranger.id, {
      ...baseInput,
      customName: 'Чужая подписка',
    });

    const ownerList = await subscriptionService.list(owner.id);

    expect(ownerList).toHaveLength(1);
    expect(ownerList[0]?.customName).toBe('Кинопоиск');
  });
});

describe('изменение', () => {
  it('меняет сумму, не трогая расписание', async () => {
    const user = await createTestUser();
    const created = await subscriptionService.create(user.id, baseInput);

    const updated = await subscriptionService.update(user.id, created.id, {
      amountMinor: 49_900,
    });

    expect(updated.amountMinor).toBe(49_900);
    expect(updated.billingAnchorAt.toISOString()).toBe(
      created.billingAnchorAt.toISOString(),
    );

    // Прогнозы фиксируют цену на момент события — она должна обновиться
    const events = await db.billingEvent.findMany({
      where: { subscriptionId: created.id, status: 'scheduled' },
    });
    expect(events.every((event) => event.amountMinor === 49_900)).toBe(true);
  });

  it('правка даты сдвигает якорь — это единственный такой случай', async () => {
    const user = await createTestUser();
    const created = await subscriptionService.create(user.id, baseInput);

    const updated = await subscriptionService.update(user.id, created.id, {
      firstBillingAt: utcDate('2026-09-15'),
    });

    expect(updated.billingAnchorAt.toISOString()).toBe('2026-09-15T00:00:00.000Z');

    const events = await db.billingEvent.findMany({
      where: { subscriptionId: created.id, status: 'scheduled' },
      orderBy: { dueAt: 'asc' },
      take: 3,
    });

    expect(events.map((e) => e.dueAt.toISOString().slice(0, 10))).toEqual([
      '2026-09-15',
      '2026-10-15',
      '2026-11-15',
    ]);
  });

  it('смена периода пересчитывает расписание от того же якоря', async () => {
    const user = await createTestUser();
    const created = await subscriptionService.create(user.id, baseInput);

    await subscriptionService.update(user.id, created.id, { period: 'yearly' });

    const events = await db.billingEvent.findMany({
      where: { subscriptionId: created.id, status: 'scheduled' },
      orderBy: { dueAt: 'asc' },
    });

    // Годовой период в горизонте 12 месяцев даёт одно событие
    expect(events).toHaveLength(1);
    expect(events[0]?.dueAt.toISOString().slice(0, 10)).toBe('2026-08-31');
  });

  it('поля, которых нет во входных данных, не затираются', async () => {
    const user = await createTestUser();
    const created = await subscriptionService.create(user.id, {
      ...baseInput,
      note: 'важная заметка',
      paymentLabel: 'Тинькофф •4321',
    });

    await subscriptionService.update(user.id, created.id, { amountMinor: 50_000 });

    const after = await subscriptionService.get(user.id, created.id);
    expect(after.note).toBe('важная заметка');
    expect(after.paymentLabel).toBe('Тинькофф •4321');
  });

  it('явный null очищает поле', async () => {
    const user = await createTestUser();
    const created = await subscriptionService.create(user.id, {
      ...baseInput,
      note: 'больше не нужна',
    });

    await subscriptionService.update(user.id, created.id, { note: null });

    const after = await subscriptionService.get(user.id, created.id);
    expect(after.note).toBeNull();
  });

  it('некорректный период отклоняется до записи', async () => {
    const user = await createTestUser();
    const created = await subscriptionService.create(user.id, baseInput);

    await expect(
      subscriptionService.update(user.id, created.id, {
        period: 'custom',
        periodDays: null,
      }),
    ).rejects.toThrow(/periodDays/);

    // Подписка не пострадала
    const after = await subscriptionService.get(user.id, created.id);
    expect(after.period).toBe('monthly');
  });

  it('ИЗОЛЯЦИЯ: чужую подписку нельзя изменить', async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const subscription = await subscriptionService.create(owner.id, baseInput);

    await expect(
      subscriptionService.update(stranger.id, subscription.id, {
        amountMinor: 1,
      }),
    ).rejects.toThrow(/не найден/i);

    const unchanged = await subscriptionService.get(owner.id, subscription.id);
    expect(unchanged.amountMinor).toBe(39_900);
  });
});

describe('пауза и возобновление', () => {
  it('пауза убирает дату следующего списания и гасит прогнозы', async () => {
    const user = await createTestUser();
    const subscription = await subscriptionService.create(user.id, baseInput);

    const paused = await subscriptionService.pause(user.id, subscription.id);

    expect(paused.status).toBe('paused');
    expect(paused.nextBillingAt).toBeNull();

    const scheduled = await db.billingEvent.count({
      where: { subscriptionId: subscription.id, status: 'scheduled' },
    });
    expect(scheduled).toBe(0);
  });

  it('возобновление сохраняет якорный день, а не сдвигает его на сегодня', async () => {
    const user = await createTestUser();
    const subscription = await subscriptionService.create(user.id, baseInput);
    await subscriptionService.pause(user.id, subscription.id);

    // Возобновляем 15 сентября — следующее списание должно быть
    // 30 сентября по якорю 31, а не 15 октября
    const resumed = await subscriptionService.resume(
      user.id,
      subscription.id,
      utcDate('2026-09-15'),
    );

    expect(resumed.status).toBe('active');
    expect(resumed.nextBillingAt?.toISOString().slice(0, 10)).toBe('2026-09-30');
  });

  it('повторная пауза уже приостановленной подписки отклоняется', async () => {
    const user = await createTestUser();
    const subscription = await subscriptionService.create(user.id, baseInput);
    await subscriptionService.pause(user.id, subscription.id);

    await expect(
      subscriptionService.pause(user.id, subscription.id),
    ).rejects.toThrow(/невозможен|допустим/i);
  });
});

describe('удаление и восстановление', () => {
  it('удаление мягкое: запись исчезает из списка, но восстановима', async () => {
    const user = await createTestUser();
    const subscription = await subscriptionService.create(user.id, baseInput);

    await subscriptionService.softDelete(user.id, subscription.id);
    expect(await subscriptionService.list(user.id)).toHaveLength(0);

    const restored = await subscriptionService.restore(user.id, subscription.id);
    expect(restored.id).toBe(subscription.id);
    expect(await subscriptionService.list(user.id)).toHaveLength(1);
  });

  it('восстановление позже 30 дней невозможно', async () => {
    const user = await createTestUser();
    const subscription = await subscriptionService.create(user.id, baseInput);
    await subscriptionService.softDelete(user.id, subscription.id);

    // Отодвигаем дату удаления на 31 день назад
    await db.subscription.update({
      where: { id: subscription.id },
      data: { deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
    });

    await expect(
      subscriptionService.restore(user.id, subscription.id),
    ).rejects.toThrow(/не найден/i);
  });
});

describe('аудит', () => {
  it('создание и пауза попадают в журнал', async () => {
    const user = await createTestUser();
    const subscription = await subscriptionService.create(user.id, baseInput);
    await subscriptionService.pause(user.id, subscription.id);

    const actions = await db.auditLog.findMany({
      where: { entityId: subscription.id },
      orderBy: { createdAt: 'asc' },
      select: { action: true },
    });

    expect(actions.map((a) => a.action)).toEqual([
      'subscription.created',
      'subscription.paused',
    ]);
  });

  it('в журнал не попадают суммы и заметки', async () => {
    const user = await createTestUser();
    const subscription = await subscriptionService.create(user.id, {
      ...baseInput,
      note: 'секретная заметка пользователя',
    });

    const entries = await db.auditLog.findMany({
      where: { entityId: subscription.id },
    });

    const dump = JSON.stringify(entries);
    expect(dump).not.toContain('секретная заметка');
    expect(dump).not.toContain('39900');
  });
});
