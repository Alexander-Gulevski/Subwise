import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  countsTowardSpending,
  generatesBillingEvents,
  isTerminal,
} from './status';

/**
 * Переходы состояний — docs/07-testing-strategy.md, раздел 3.5.
 *
 * Главное, что здесь проверяется: в cancelled нельзя попасть
 * мимо CancellationProvider (ADR-0002).
 */

describe('запрет отмены в обход провайдера', () => {
  it('пользователь не может напрямую отменить подписку', () => {
    expect(canTransition('active', 'cancelled', 'user')).toBe(false);
  });

  it('фоновая задача не может отменить подписку', () => {
    expect(canTransition('active', 'cancelled', 'system')).toBe(false);
  });

  it('только CancellationProvider.confirm() переводит в cancelled', () => {
    expect(canTransition('active', 'cancelled', 'cancellation-provider')).toBe(true);
  });

  it('ошибка объясняет, кто вправе выполнить переход', () => {
    expect(() => assertTransition('active', 'cancelled', 'user')).toThrow(
      /cancellation-provider/,
    );
  });
});

describe('автоматические переходы по дате', () => {
  it('триал переходит в active фоновой задачей, не пользователем', () => {
    expect(canTransition('trial', 'active', 'system')).toBe(true);
    expect(canTransition('trial', 'active', 'user')).toBe(false);
  });

  it('отменённая подписка истекает по окончании оплаченного периода', () => {
    expect(canTransition('cancelled', 'expired', 'system')).toBe(true);
  });
});

describe('пауза', () => {
  it('пользователь ставит и снимает паузу сам', () => {
    expect(canTransition('active', 'paused', 'user')).toBe(true);
    expect(canTransition('paused', 'active', 'user')).toBe(true);
  });

  it('подписка на паузе не учитывается в расходах', () => {
    expect(countsTowardSpending('paused')).toBe(false);
    expect(countsTowardSpending('active')).toBe(true);
    expect(countsTowardSpending('trial')).toBe(true);
  });

  it('для подписки на паузе не создаются события списаний', () => {
    expect(generatesBillingEvents('paused')).toBe(false);
  });
});

describe('финальные состояния', () => {
  it('expired — выхода нет', () => {
    expect(isTerminal('expired')).toBe(true);
    expect(canTransition('expired', 'active', 'user')).toBe(false);
    expect(canTransition('expired', 'active', 'system')).toBe(false);
  });

  it('невозможный переход даёт понятную ошибку', () => {
    expect(() => assertTransition('expired', 'active', 'user')).toThrow(
      /невозможен/,
    );
  });
});
