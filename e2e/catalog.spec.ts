import { expect, test } from '@playwright/test';
import { cleanupUser, loginViaUi, uniqueEmail } from './helpers';

/**
 * Каталог сервисов — FR-04.
 *
 * Главное требование: добавление подписки из каталога занимает
 * не больше трёх действий, а категория определяется сама.
 */


test.describe('подсказки каталога', () => {
  test('выбор из каталога подставляет сумму и категорию', async ({ page }) => {
    const email = uniqueEmail('catalog-pick');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('кинопоиск');

      const option = page.getByRole('option', { name: /Кинопоиск/ });
      await expect(option).toBeVisible();
      await option.click();

      // Три действия: набрал, выбрал, сохранил. Сумма и категория
      // подставились сами
      await expect(page.getByLabel('Сервис')).toHaveValue('Кинопоиск');
      await expect(page.getByLabel('Сумма')).toHaveValue('399');
      await expect(page.getByLabel('Категория')).toHaveValue(/.+/);

      await page.getByRole('button', { name: 'Сохранить' }).click();
      await page.waitForURL(/\/app$/);

      await expect(page.getByText('Кинопоиск')).toBeVisible();
      await expect(page.getByText(/399\s*₽/).first()).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('РЕГРЕССИЯ: смена сервиса подставляет цену нового', async ({ page }) => {
    const email = uniqueEmail('catalog-reprice');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('кинопоиск');
      await page.getByRole('option', { name: /Кинопоиск/ }).click();
      await expect(page.getByLabel('Сумма')).toHaveValue('399');

      // Передумали и выбрали другой сервис. Раньше цена оставалась
      // от первого выбора: логика берегла введённое вручную и заодно
      // берегла то, что подставила сама
      await page.getByLabel('Сервис').fill('амедиатека');
      await page.getByRole('option', { name: /Амедиатека/ }).click();

      await expect(page.getByLabel('Сумма')).toHaveValue('599');
    } finally {
      await cleanupUser(email);
    }
  });

  test('смена сервиса меняет и валюту с периодом', async ({ page }) => {
    const email = uniqueEmail('catalog-currency');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('кинопоиск');
      await page.getByRole('option', { name: /Кинопоиск/ }).click();
      await expect(page.getByLabel('Валюта')).toHaveValue('RUB');

      await page.getByLabel('Сервис').fill('spotify');
      await page.getByRole('option', { name: /Spotify/ }).click();

      await expect(page.getByLabel('Валюта')).toHaveValue('USD');
      await expect(page.getByLabel('Сумма')).toHaveValue('11,99');
    } finally {
      await cleanupUser(email);
    }
  });

  test('находит по латинице', async ({ page }) => {
    const email = uniqueEmail('catalog-latin');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('kinopoisk');
      await expect(page.getByRole('option', { name: /Кинопоиск/ })).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('находит с опечаткой', async ({ page }) => {
    const email = uniqueEmail('catalog-typo');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('кинопойск');
      await expect(page.getByRole('option', { name: /Кинопоиск/ })).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('подсказки выбираются с клавиатуры', async ({ page }) => {
    const email = uniqueEmail('catalog-kbd');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('spotify');
      await expect(page.getByRole('option', { name: /Spotify/ })).toBeVisible();

      // Стрелка вниз и Enter — без мыши (NFR-02)
      await page.getByRole('combobox', { name: 'Сервис' }).press('ArrowDown');
      await page.getByRole('combobox', { name: 'Сервис' }).press('Enter');

      await expect(page.getByLabel('Сервис')).toHaveValue('Spotify');
      await expect(page.getByLabel('Валюта')).toHaveValue('USD');
    } finally {
      await cleanupUser(email);
    }
  });

  test('Escape закрывает список, не отправляя форму', async ({ page }) => {
    const email = uniqueEmail('catalog-esc');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('окко');
      await expect(page.getByRole('option', { name: /Okko/ })).toBeVisible();

      await page.getByRole('combobox', { name: 'Сервис' }).press('Escape');
      await expect(page.getByRole('option', { name: /Okko/ })).toBeHidden();
      await expect(page).toHaveURL(/\/app\/subscriptions\/new$/);
    } finally {
      await cleanupUser(email);
    }
  });
});

test.describe('автоопределение категории', () => {
  test('категория угадывается по названию вне каталога', async ({ page }) => {
    const email = uniqueEmail('guess-category');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      // Такого сервиса в каталоге нет, но по слову «VPN» понятно,
      // что это связь
      await page.getByLabel('Сервис').fill('Мой личный VPN');

      await expect(page.getByLabel('Категория')).toHaveValue(/.+/, {
        timeout: 10_000,
      });

      const selected = await page
        .getByLabel('Категория')
        .locator('option:checked')
        .textContent();
      expect(selected).toContain('Связь');
    } finally {
      await cleanupUser(email);
    }
  });

  test('не навязывает категорию, когда не уверена', async ({ page }) => {
    const email = uniqueEmail('no-guess');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('Ежемесячный платёж');
      await page.waitForTimeout(1000);

      // Пустая категория честнее неверной
      await expect(page.getByLabel('Категория')).toHaveValue('');
    } finally {
      await cleanupUser(email);
    }
  });

  test('выбор пользователя не перебивается угадыванием', async ({ page }) => {
    const email = uniqueEmail('keep-choice');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Категория').selectOption({ label: 'Игры' });
      await page.getByLabel('Сервис').fill('Мой личный VPN');
      await page.waitForTimeout(1000);

      const selected = await page
        .getByLabel('Категория')
        .locator('option:checked')
        .textContent();
      expect(selected).toContain('Игры');
    } finally {
      await cleanupUser(email);
    }
  });
});
