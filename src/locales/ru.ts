/**
 * Русский словарь — NFR-07.
 *
 * Пользовательских строк в коде нет. Всё здесь.
 *
 * Тон (docs/05-ux-flows.md): на «ты», коротко, без канцелярита.
 * «Завтра спишут 399 ₽», а не «Уведомляем о предстоящем списании».
 * Мы не пугаем суммами — мы возвращаем контроль.
 *
 * Публичный бренд «Отписка» живёт ЗДЕСЬ, а не в компонентах:
 * техническое имя проекта — Subwise, и код нейтрален к рынку.
 */

export const ru = {
  brand: {
    name: 'Отписка',
    tagline: 'Все подписки в одном месте',
  },

  common: {
    loading: 'Загружаем…',
    save: 'Сохранить',
    cancel: 'Отмена',
    back: 'Назад',
    next: 'Далее',
    retry: 'Попробовать ещё раз',
    somethingWentWrong: 'Что-то пошло не так',
  },

  landing: {
    title: 'Все подписки в одном месте',
    subtitle:
      'Собери подписки, получай напоминание до списания и отменяй ненужное без поиска кнопки.',
    cta: 'Начать',
    howItWorks: 'Как это работает',
    steps: [
      {
        title: 'Видеть',
        text: 'Все подписки, суммы и даты списаний на одном экране, в одной валюте.',
      },
      {
        title: 'Успеть',
        text: 'Напоминание приходит за несколько дней до списания, а не после.',
      },
      {
        title: 'Решить',
        text: 'Пошаговая инструкция отмены именно для этого сервиса.',
      },
    ],
  },

  auth: {
    title: 'Вход',
    subtitle: 'Без пароля — коротким кодом на почту или через Telegram',
    emailLabel: 'Почта',
    emailPlaceholder: 'you@example.ru',
    sendCode: 'Получить код',
    codeLabel: 'Код из письма',
    codePlaceholder: '000000',
    verify: 'Войти',
    telegram: 'Войти через Telegram',
    codeSent: 'Если такая почта у нас есть, код уже отправлен',
    codeHint: 'Код действует 10 минут',
    invalidCode: 'Неверный код',
    expiredCode: 'Код истёк, запроси новый',
    tooManyAttempts: 'Слишком много попыток. Попробуй через 15 минут',
    logout: 'Выйти',
  },

  dashboard: {
    title: 'Обзор',
    perMonth: 'В месяц',
    perYear: 'В год',
    trials: 'Триалы',
    upcoming: 'Ближайшие списания',
    byCategory: 'По категориям',
    empty: {
      title: 'Пока пусто',
      text: 'Добавь первую подписку — начни с тех, которыми пользуешься каждый день.',
      cta: 'Добавить подписку',
    },
    rateStale: 'курс от {date}',
  },

  subscription: {
    status: {
      active: 'Активна',
      trial: 'Триал',
      paused: 'На паузе',
      cancelled: 'Отменена',
      expired: 'Истекла',
    },
    period: {
      weekly: 'раз в неделю',
      monthly: 'раз в месяц',
      quarterly: 'раз в квартал',
      semiannual: 'раз в полгода',
      yearly: 'раз в год',
      custom: 'каждые {days} дн.',
    },
    add: 'Добавить подписку',
    pause: 'Поставить на паузу',
    resume: 'Возобновить',
    cancel: 'Отменить подписку',
    trialEndsIn: 'Триал закончится через {days} дн.',
    chargeTomorrow: 'Завтра спишут',
    chargeIn: 'Спишут через {days} дн.',
  },

  cancellation: {
    title: 'Отмена: {service}',
    guideCheckedAt: 'Инструкция проверена {date}',
    openService: 'Перейти на сайт',
    reportOutdated: 'Инструкция не сработала',
    // Вопрос задаётся ПОСЛЕ возвращения пользователя.
    // Интерфейс не пишет «отменено» до ответа «Да» (ADR-0002).
    didItWork: 'Получилось отменить?',
    yes: 'Да',
    no: 'Нет',
    later: 'Вернусь позже',
    succeeded: 'Отменено. Доступ до {date}',
    failedTitle: 'Не получилось?',
    failedText: 'Можно поставить учёт на паузу или напомнить позже.',
    noGuide:
      'Точной инструкции для этого сервиса пока нет. Обычно отмена находится в разделе «Подписки» или «Аккаунт».',
  },

  notifications: {
    title: 'Уведомления',
    empty: 'Пока ничего не было',
    upcomingCharge: '{when} спишут {amount} — {service}',
    trialEnding: 'Триал {service} закончится через {days} дн.',
    actionConfirm: 'Всё верно',
    actionCancel: 'Отменить подписку',
    actionSnooze: 'Напомнить позже',
    unsubscribe: 'Отключить такие уведомления',
  },

  settings: {
    title: 'Настройки',
    baseCurrency: 'Валюта итогов',
    timezone: 'Часовой пояс',
    quietHours: 'Тихие часы',
    quietHoursHint: 'В это время уведомления откладываются, а не теряются',
    exportData: 'Скачать мои данные',
    deleteAccount: 'Удалить аккаунт',
    deleteAccountHint: 'Данные будут стёрты в течение 30 дней',
  },

  errors: {
    UNAUTHENTICATED: 'Нужно войти в аккаунт',
    NOT_FOUND: 'Не найдено',
    PLAN_REQUIRED: 'Функция доступна на расширенном тарифе',
    LIMIT_EXCEEDED: 'На бесплатном тарифе можно вести до {limit} подписок',
    VALIDATION_FAILED: 'Проверь введённые данные',
    RATE_LIMITED: 'Слишком много попыток, попробуй позже',
    INTERNAL: 'Что-то пошло не так',
  },

  a11y: {
    mainNavigation: 'Основная навигация',
    closeDialog: 'Закрыть',
    subscriptionStatus: 'Статус подписки: {status}',
  },
} as const;

export type Dictionary = typeof ru;
