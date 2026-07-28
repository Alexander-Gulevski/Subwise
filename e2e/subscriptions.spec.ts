import { expect, test, type Page } from '@playwright/test';
import { cleanupUser, disconnect, loginViaUi, uniqueEmail } from './helpers';

/**
 * Добавление подписки — сценарий E2 из docs/07-testing-strategy.md.
 *
 * Проверяет не только «запись создалась», но и что дашборд после этого
 * показывает верные цифры: расхождение итогов обесценивает продукт
 * целиком (контр-метрика из docs/00-vision.md).
 */

test.afterAll(async () => {
  await disconnect();
});

test.describe('добавление подписки', () => {
  test('кнопка на пустом дашборде ведёт к форме', async ({ page }) => {
    const email = uniqueEmail('empty');

    try {
      await loginViaUi(page, email);

      await expect(page.getByText('Пока пусто')).toBeVisible();
      await page.getByRole('link', { name: 'Добавить подписку' }).click();

      await expect(page).toHaveURL(/\/app\/subscriptions\/new$/);
      await expect(
        page.getByRole('heading', { name: 'Добавить подписку' }),
      ).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('месячная подписка попадает в итоги как есть', async ({ page }) => {
    const email = uniqueEmail('add-monthly');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('Кинопоиск');
      await page.getByLabel('Сумма').fill('399');
      await page.getByLabel('Следующее списание').fill('2026-08-31');
      await page.getByLabel('Категория').selectOption({ label: 'Видео и кино' });
      await page.getByRole('button', { name: 'Сохранить' }).click();

      await page.waitForURL(/\/app$/);

      await expect(page.getByText('Кинопоиск')).toBeVisible();

      // 399 ₽ в месяц → 4788 ₽ в год.
      // Пробел в регулярке — неразрывный разделитель тысяч из Intl:
      // сравнивать с «4788» бесполезно, на экране «4 788»
      await expect(page.getByText(/399\s*₽/).first()).toBeVisible();
      await expect(page.getByText(/4\s*788\s*₽/).first()).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('годовая подписка приводится к месяцу', async ({ page }) => {
    const email = uniqueEmail('add-yearly');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('Яндекс Плюс');
      await page.getByLabel('Сумма').fill('3990');
      await page.getByLabel('Как часто списывают').selectOption('yearly');
      await page.getByLabel('Следующее списание').fill('2026-12-01');
      await page.getByRole('button', { name: 'Сохранить' }).click();

      await page.waitForURL(/\/app$/);

      // Итог: 3990 ₽ в год → 332,50 ₽ в месяц. Без приведения дашборд
      // показывал бы ноль одиннадцать месяцев из двенадцати
      await expect(page.getByText('332,50 ₽').first()).toBeVisible();

      // А в самой строке — сумма, которую реально спишут с карты,
      // с явным указанием периода
      const row = page.locator('section').filter({ hasText: 'Яндекс Плюс' });
      await expect(row.getByText(/3\s*990\s*₽/)).toBeVisible();
      await expect(row.getByText('в год')).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('триал показывается отдельным блоком выше остальных', async ({ page }) => {
    const email = uniqueEmail('add-trial');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('Okko');
      await page.getByLabel('Сумма').fill('299');
      await page.getByLabel('Сейчас идёт триал').check();
      await page.getByLabel('Когда заканчивается триал').fill('2026-08-05');
      await page.getByLabel('Первое платное списание').fill('2026-08-05');
      await page.getByRole('button', { name: 'Сохранить' }).click();

      await page.waitForURL(/\/app$/);

      await expect(page.getByText('Триалы')).toBeVisible();
      await expect(page.getByText('Okko')).toBeVisible();
      await expect(page.getByText('Триал').first()).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('пустая сумма не проходит и объясняет, что не так', async ({ page }) => {
    const email = uniqueEmail('bad-amount');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('Без суммы');
      await page.getByLabel('Сумма').fill('ноль');
      await page.getByLabel('Следующее списание').fill('2026-09-01');
      await page.getByRole('button', { name: 'Сохранить' }).click();

      await expect(
        page.getByRole('alert').filter({ hasText: 'Введи сумму' }),
      ).toBeVisible();
      // Со страницы не ушли — данные не потеряны
      await expect(page).toHaveURL(/\/app\/subscriptions\/new$/);
    } finally {
      await cleanupUser(email);
    }
  });

  test('подписка в валюте не ломает итог и честно помечена', async ({ page }) => {
    const email = uniqueEmail('foreign');

    try {
      await loginViaUi(page, email);
      await page.goto('/app/subscriptions/new');

      await page.getByLabel('Сервис').fill('Spotify');
      await page.getByLabel('Сумма').fill('10,99');
      await page.getByLabel('Валюта').selectOption('USD');
      await page.getByLabel('Следующее списание').fill('2026-09-15');
      await page.getByRole('button', { name: 'Сохранить' }).click();

      await page.waitForURL(/\/app$/);

      await expect(page.getByText('Spotify')).toBeVisible();
      // Курсов ещё нет: сумму не выдумываем, а честно говорим об этом
      await expect(page.getByText(/не хватает курса/)).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });
});

test.describe('редактирование карточки', () => {
  /** Заводит одну подписку и оставляет страницу на дашборде */
  async function seedOne(
    page: Page,
    email: string,
    name = 'Кинопоиск',
    amount = '399',
  ) {
    await loginViaUi(page, email);
    await page.goto('/app/subscriptions/new');
    await page.getByLabel('Сервис').fill(name);
    await page.getByLabel('Сумма').fill(amount);
    await page.getByLabel('Следующее списание').fill('2026-08-31');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.waitForURL(/\/app$/);
  }

  test('кнопка правки открывает карточку с заполненными полями', async ({
    page,
  }) => {
    const email = uniqueEmail('open-card');

    try {
      await seedOne(page, email);

      await page.getByRole('link', { name: /Изменить: Кинопоиск/ }).click();
      await expect(page).toHaveURL(/\/app\/subscriptions\/[^/]+$/);

      // Значения подставлены, а не пустые — иначе сохранение затрёт данные
      await expect(page.getByLabel('Сервис')).toHaveValue('Кинопоиск');
      await expect(page.getByLabel('Сумма')).toHaveValue('399');
      await expect(page.getByLabel('Следующее списание')).toHaveValue('2026-08-31');
    } finally {
      await cleanupUser(email);
    }
  });

  test('изменение суммы пересчитывает итоги', async ({ page }) => {
    const email = uniqueEmail('edit-amount');

    try {
      await seedOne(page, email);
      await page.getByRole('link', { name: /Изменить: Кинопоиск/ }).click();

      await page.getByLabel('Сумма').fill('599');
      await page.getByRole('button', { name: 'Сохранить' }).click();

      await page.waitForURL(/\/app$/);
      await expect(page.getByText(/599\s*₽/).first()).toBeVisible();
      // 599 × 12 = 7188
      await expect(page.getByText(/7\s*188\s*₽/).first()).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('переименование видно на дашборде', async ({ page }) => {
    const email = uniqueEmail('edit-name');

    try {
      await seedOne(page, email);
      await page.getByRole('link', { name: /Изменить: Кинопоиск/ }).click();

      await page.getByLabel('Сервис').fill('Кинопоиск HD');
      await page.getByRole('button', { name: 'Сохранить' }).click();

      await page.waitForURL(/\/app$/);
      await expect(page.getByText('Кинопоиск HD')).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('пауза убирает подписку из итогов, но не из списка', async ({ page }) => {
    const email = uniqueEmail('pause');

    try {
      await seedOne(page, email);
      await page.getByRole('link', { name: /Изменить: Кинопоиск/ }).click();

      await page.getByRole('button', { name: 'Поставить на паузу' }).click();
      await page.waitForURL(/\/app$/);

      // «На паузе» есть и как заголовок раздела, и как статус в строке —
      // берём первое совпадение
      await expect(page.getByText('На паузе').first()).toBeVisible();
      await expect(page.getByText('Кинопоиск')).toBeVisible();
      // Итог обнулился: подписка на паузе не считается расходом
      await expect(page.getByText(/^0\s*₽$/).first()).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('возобновление возвращает подписку в расходы', async ({ page }) => {
    const email = uniqueEmail('resume');

    try {
      await seedOne(page, email);
      await page.getByRole('link', { name: /Изменить: Кинопоиск/ }).click();
      await page.getByRole('button', { name: 'Поставить на паузу' }).click();
      await page.waitForURL(/\/app$/);

      await page.getByRole('link', { name: /Изменить: Кинопоиск/ }).click();
      await page.getByRole('button', { name: 'Возобновить' }).click();
      await page.waitForURL(/\/app$/);

      await expect(page.getByText(/399\s*₽/).first()).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('удаление требует подтверждения и честно предупреждает', async ({
    page,
  }) => {
    const email = uniqueEmail('delete');

    try {
      await seedOne(page, email);
      await page.getByRole('link', { name: /Изменить: Кинопоиск/ }).click();

      await page.getByRole('button', { name: 'Удалить подписку' }).click();

      // Пользователь должен понимать, что удаление из приложения
      // не отменяет подписку у сервиса
      await expect(page.getByText(/Деньги продолжат списываться/)).toBeVisible();

      await page.getByRole('button', { name: 'Удалить', exact: true }).click();
      await page.waitForURL(/\/app$/);

      await expect(page.getByText('Пока пусто')).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test('ИЗОЛЯЦИЯ: карточка чужой подписки отдаёт 404', async ({ page }) => {
    const ownerEmail = uniqueEmail('owner');
    const strangerEmail = uniqueEmail('stranger');

    try {
      await seedOne(page, ownerEmail);
      const href = await page
        .getByRole('link', { name: /Изменить: Кинопоиск/ })
        .getAttribute('href');

      // Выходим так же, как пользователь — кнопкой в настройках
      await page.goto('/app/settings');
      await page.getByRole('button', { name: 'Выйти' }).click();
      await page.waitForURL(/localhost:\d+\/$/);

      await loginViaUi(page, strangerEmail);

      const response = await page.goto(href ?? '/app');
      expect(response?.status()).toBe(404);
    } finally {
      await cleanupUser(ownerEmail);
      await cleanupUser(strangerEmail);
    }
  });

});
