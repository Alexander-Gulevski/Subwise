import { expect, test } from '@playwright/test';
import { cleanupUser, disconnect, loginViaUi, uniqueEmail } from './helpers';

/**
 * Онбординг — FR-01, docs/05-ux-flows.md.
 *
 * Критерий из документа: от первого экрана до заполненного дашборда
 * не больше 90 секунд и не больше трёх экранов ввода. Просьба
 * добавить подписки по одной убивает первую сессию, поэтому сетка
 * превращает ввод в узнавание.
 */

test.afterAll(async () => {
  await disconnect();
});

test.describe('первый запуск', () => {
  test('новый пользователь попадает в онбординг, а не на пустой дашборд', async ({
    page,
  }) => {
    const email = uniqueEmail('onb-enter');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });

      await expect(page).toHaveURL(/\/app\/onboarding$/);
      await expect(
        page.getByRole('heading', { name: 'Чем пользуешься?' }),
      ).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('сетка показывает популярные сервисы с ценами', async ({ page }) => {
    const email = uniqueEmail('onb-grid');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });

      await expect(page.getByRole('button', { name: /Кинопоиск/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Яндекс Плюс/ })).toBeVisible();
      // Цена видна прямо в плитке — не нужно открывать, чтобы понять
      await expect(
        page.getByRole('button', { name: /Кинопоиск.*399/s }),
      ).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('без выбора дальше не пускает и объясняет почему', async ({ page }) => {
    const email = uniqueEmail('onb-empty');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });

      await expect(
        page.getByRole('button', { name: 'Выбери хотя бы одну' }),
      ).toBeDisabled();
    } finally {
      await cleanupUser(email);
    }
  });

  test('отметка плитки видна и считается', async ({ page }) => {
    const email = uniqueEmail('onb-count');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });

      const tile = page.getByRole('button', { name: /Кинопоиск/ });
      await tile.click();

      // Состояние передаётся через aria-pressed, а не только цветом
      await expect(tile).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: 'Далее — 1' })).toBeEnabled();

      await page.getByRole('button', { name: /Яндекс Плюс/ }).click();
      await expect(page.getByRole('button', { name: 'Далее — 2' })).toBeVisible();

      // Повторное нажатие снимает отметку
      await tile.click();
      await expect(tile).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByRole('button', { name: 'Далее — 1' })).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });
});

test.describe('прохождение целиком', () => {
  test('три подписки за два экрана попадают на дашборд', async ({ page }) => {
    const email = uniqueEmail('onb-full');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });

      await page.getByRole('button', { name: /Кинопоиск/ }).click();
      await page.getByRole('button', { name: /Яндекс Плюс/ }).click();
      await page.getByRole('button', { name: /Ozon Premium/ }).click();

      await page.getByRole('button', { name: 'Далее — 3' }).click();

      // Второй экран: суммы уже подставлены, нужны только даты
      await expect(
        page.getByRole('heading', { name: 'Когда списывают?' }),
      ).toBeVisible();

      await expect(page.getByLabel('Сумма').first()).not.toHaveValue('');

      await page.getByRole('button', { name: 'Готово' }).click();
      await page.waitForURL(/\/app$/);

      await expect(page.getByText('Кинопоиск')).toBeVisible();
      await expect(page.getByText('Яндекс Плюс')).toBeVisible();
      await expect(page.getByText('Ozon Premium')).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('суммы подставлены из каталога, править не обязательно', async ({
    page,
  }) => {
    const email = uniqueEmail('onb-amounts');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });

      await page.getByRole('button', { name: /Кинопоиск/ }).click();
      await page.getByRole('button', { name: 'Далее — 1' }).click();

      // Ради этого сетка и существует: пользователь не вводит сумму
      await expect(page.getByLabel('Сумма')).toHaveValue('399');
      await expect(page.getByLabel('Спишут')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
    } finally {
      await cleanupUser(email);
    }
  });

  test('можно вернуться к сетке и изменить выбор', async ({ page }) => {
    const email = uniqueEmail('onb-back');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });

      await page.getByRole('button', { name: /Кинопоиск/ }).click();
      await page.getByRole('button', { name: 'Далее — 1' }).click();
      await page.getByRole('button', { name: 'Назад' }).click();

      await expect(
        page.getByRole('heading', { name: 'Чем пользуешься?' }),
      ).toBeVisible();
      // Выбор сохранился
      await expect(page.getByRole('button', { name: 'Далее — 1' })).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });
});

test.describe('пропуск', () => {
  test('пропустивший попадает на дашборд и больше не возвращается', async ({
    page,
  }) => {
    const email = uniqueEmail('onb-skip');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });

      await page.getByRole('button', { name: 'Пропустить' }).click();
      await page.waitForURL(/\/app$/);
      await expect(page.getByText('Пока пусто')).toBeVisible();

      // Без отметки о пропуске пользователь возвращался бы в онбординг
      // при каждом заходе на пустой дашборд
      await page.goto('/app');
      await expect(page).toHaveURL(/\/app$/);
    } finally {
      await cleanupUser(email);
    }
  });

  test('пройденный онбординг не открывается повторно', async ({ page }) => {
    const email = uniqueEmail('onb-once');

    try {
      await loginViaUi(page, email, { onboarding: 'keep' });
      await page.getByRole('button', { name: 'Пропустить' }).click();
      await page.waitForURL(/\/app$/);

      await page.goto('/app/onboarding');
      await expect(page).toHaveURL(/\/app$/);
    } finally {
      await cleanupUser(email);
    }
  });
});
