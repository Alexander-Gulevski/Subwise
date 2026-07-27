import { expect, test } from '@playwright/test';
import {
  cleanupUser,
  disconnect,
  forceOtpCode,
  resetRateLimits,
  uniqueEmail,
} from './helpers';

/**
 * Вход в приложение — сценарии E1 и E7 из docs/07-testing-strategy.md.
 *
 * Эти тесты существуют из-за конкретного случая: CSP блокировала eval,
 * React не гидрировался, форма отправлялась браузером нативно.
 * При этом 94 юнит-теста проходили, curl получал HTTP 200, консоль
 * браузера была пустой, а войти было нельзя.
 *
 * Класс «сервер отвечает правильно, интерфейс мёртв» ловится только
 * настоящим кликом в браузере.
 */

const TEST_CODE = '424242';

// Все тесты приходят с одного адреса, поэтому лимит запросов кода
// (3 за 15 минут на IP) исчерпался бы к четвёртому тесту
test.beforeEach(async () => {
  await resetRateLimits();
});

test.afterAll(async () => {
  await disconnect();
});

test.describe('лендинг', () => {
  test('открывается и ведёт на вход', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Все подписки в одном месте' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Начать' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  });
});

test.describe('вход по коду на почту', () => {
  test('РЕГРЕССИЯ: форма переходит ко второму шагу, а не перезагружает страницу', async ({
    page,
  }) => {
    // Ровно тот сценарий, который был сломан. Если React не гидрируется,
    // браузер отправит форму нативно и уйдёт на /login?, а поле для кода
    // не появится.
    const email = uniqueEmail('hydration');

    try {
      await page.goto('/login');
      await page.getByLabel('Почта').fill(email);
      await page.getByRole('button', { name: 'Получить код' }).click();

      await expect(page.getByLabel('Код из письма')).toBeVisible();

      // URL не изменился — значит формой управлял JS, а не браузер
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await cleanupUser(email);
    }
  });

  test('полный путь: почта → код → дашборд', async ({ page }) => {
    const email = uniqueEmail('login');

    try {
      await page.goto('/login');
      await page.getByLabel('Почта').fill(email);
      await page.getByRole('button', { name: 'Получить код' }).click();

      await expect(page.getByLabel('Код из письма')).toBeVisible();

      await forceOtpCode(email, TEST_CODE);
      await page.getByLabel('Код из письма').fill(TEST_CODE);
      await page.getByRole('button', { name: 'Войти' }).click();

      await expect(page).toHaveURL(/\/app$/);
      await expect(page.getByRole('heading', { name: 'Обзор' })).toBeVisible();

      // Новый пользователь видит пустое состояние с призывом к действию,
      // а не «нет данных» (docs/05-ux-flows.md)
      await expect(page.getByText('Пока пусто')).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('неверный код показывает ошибку и не пускает дальше', async ({ page }) => {
    const email = uniqueEmail('badcode');

    try {
      await page.goto('/login');
      await page.getByLabel('Почта').fill(email);
      await page.getByRole('button', { name: 'Получить код' }).click();

      await expect(page.getByLabel('Код из письма')).toBeVisible();

      await page.getByLabel('Код из письма').fill('000000');
      await page.getByRole('button', { name: 'Войти' }).click();

      // Фильтр по тексту нужен потому, что Next.js держит на странице
      // собственный служебный элемент с role="alert" для объявления
      // смены маршрута. Роль всё равно проверяется — это часть NFR-02.
      await expect(
        page.getByRole('alert').filter({ hasText: 'Неверный код' }),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await cleanupUser(email);
    }
  });

  test('можно вернуться к вводу почты', async ({ page }) => {
    const email = uniqueEmail('back');

    try {
      await page.goto('/login');
      await page.getByLabel('Почта').fill(email);
      await page.getByRole('button', { name: 'Получить код' }).click();

      await expect(page.getByLabel('Код из письма')).toBeVisible();
      await page.getByRole('button', { name: 'Назад' }).click();

      await expect(page.getByLabel('Почта')).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });
});

test.describe('защита приватных страниц', () => {
  test('без сессии дашборд уводит на вход', async ({ page }) => {
    await page.goto('/app');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  });

  test('уведомления и настройки тоже закрыты', async ({ page }) => {
    for (const path of ['/app/notifications', '/app/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });
});

test.describe('доступность формы входа', () => {
  test('форма проходится с клавиатуры', async ({ page }) => {
    const email = uniqueEmail('a11y');

    try {
      await page.goto('/login');

      // Табом до поля, вводим, Enter отправляет форму —
      // без мыши вообще (NFR-02)
      await page.keyboard.press('Tab');
      await page.keyboard.type(email);
      await page.keyboard.press('Enter');

      await expect(page.getByLabel('Код из письма')).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('у полей есть связанные подписи', async ({ page }) => {
    await page.goto('/login');

    // getByLabel находит поле только если label связан с input через
    // htmlFor — то есть это заодно проверка разметки
    await expect(page.getByLabel('Почта')).toBeVisible();
  });
});
