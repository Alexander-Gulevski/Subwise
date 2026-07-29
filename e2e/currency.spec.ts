import { expect, test } from '@playwright/test';
import { cleanupUser, loginViaUi, uniqueEmail } from './helpers';

/**
 * Базовая валюта — FR-08.
 *
 * Определение по региону НЕ способно отличить Беларусь от России:
 * обе в UTC+3, и Windows в Минске нередко стоит на московском времени.
 * Поэтому валюта — это настройка, а угадывание только предлагает
 * начальное значение при первом входе.
 */

test.describe('выбор валюты при первом входе', () => {
  test('в онбординге можно сразу поправить предложенную валюту', async ({
    page,
  }) => {
    const email = uniqueEmail('cur-onb');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });

      // Определение предложило рубли по московскому поясу
      await expect(page.getByLabel('Считать итоги в')).toHaveValue('RUB');

      // Пользователь из Беларуси поправляет — одно поле, не отдельный экран
      await page.getByLabel('Считать итоги в').selectOption('BYN');
      await page.getByRole('button', { name: 'Пропустить' }).click();
      await page.waitForURL(/\/app$/);

      // Выбор сохранился в настройках
      await page.goto('/app/settings');
      await expect(page.getByLabel('Валюта итогов')).toHaveValue('BYN');
    } finally {
      await cleanupUser(email);
    }
  });
});

test.describe('валюта в настройках', () => {
  test('меняется и применяется к новым подпискам', async ({ page }) => {
    const email = uniqueEmail('cur-settings');

    try {
      await loginViaUi(page, email);

      await page.goto('/app/settings');
      await page.getByLabel('Валюта итогов').selectOption('BYN');
      await expect(page.getByText('Сохранено')).toBeVisible();

      // Ради этого всё и делалось: форма берёт валюту из настроек,
      // а не угадывает заново
      await page.goto('/app/subscriptions/new');
      await expect(page.getByLabel('Валюта')).toHaveValue('BYN');
    } finally {
      await cleanupUser(email);
    }
  });

  test('выбор переживает перезагрузку страницы', async ({ page }) => {
    const email = uniqueEmail('cur-persist');

    try {
      await loginViaUi(page, email);

      await page.goto('/app/settings');
      await page.getByLabel('Валюта итогов').selectOption('KZT');
      await expect(page.getByText('Сохранено')).toBeVisible();

      await page.reload();
      await expect(page.getByLabel('Валюта итогов')).toHaveValue('KZT');
    } finally {
      await cleanupUser(email);
    }
  });

  test('итоги на дашборде считаются в выбранной валюте', async ({ page }) => {
    const email = uniqueEmail('cur-totals');

    try {
      await loginViaUi(page, email);

      await page.goto('/app/settings');
      await page.getByLabel('Валюта итогов').selectOption('BYN');
      await expect(page.getByText('Сохранено')).toBeVisible();

      await page.goto('/app/subscriptions/new');
      await page.getByLabel('Сервис').fill('Белорусский сервис');
      await page.getByLabel('Сумма').fill('50');
      await page.getByLabel('Следующее списание').fill('2026-09-10');
      await page.getByRole('button', { name: 'Сохранить' }).click();
      await page.waitForURL(/\/app$/);

      // В русской локали у белорусского рубля нет короткого знака,
      // Intl выводит код валюты как есть
      await expect(page.getByText(/50\s*BYN/).first()).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('метёлка возвращает валюту из настроек, а не жёстко зашитую', async ({
    page,
  }) => {
    const email = uniqueEmail('cur-broom');

    try {
      await loginViaUi(page, email);

      await page.goto('/app/settings');
      await page.getByLabel('Валюта итогов').selectOption('BYN');
      await expect(page.getByText('Сохранено')).toBeVisible();

      await page.goto('/app/subscriptions/new');
      await page.getByLabel('Валюта').selectOption('USD');
      await page.getByLabel('Сервис').fill('Что-то своё');

      await page.getByRole('button', { name: 'Очистить все поля' }).click();

      await expect(page.getByLabel('Валюта')).toHaveValue('BYN');
    } finally {
      await cleanupUser(email);
    }
  });
});
