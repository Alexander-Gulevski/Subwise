/**
 * Каталог сервисов РФ и СНГ — FR-04.
 *
 * ВАЖНО про цены. Значения ниже — типовые тарифы на момент
 * наполнения каталога, они подставляются в форму как отправная точка
 * и остаются редактируемыми. Цены подписок меняются часто, поэтому
 * каталог требует периодической сверки: устаревший тариф хуже
 * отсутствующего, если выдавать его за истину.
 *
 * Правила из .claude/agents/catalog-curator.md:
 *   • amountMinor — целые минорные единицы: 399 ₽ → 39900
 *   • ровно один тариф с isDefault на сервис
 *   • aliases включают латиницу и типичные опечатки
 *   • slug менять нельзя — он в SEO-URL
 *
 * Приоритет наполнения — по частоте использования в РФ и СНГ.
 */

export type ServicePlanSeed = {
  name: string;
  amountMinor: number;
  currency: string;
  period: 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
  isDefault?: boolean;
};

export type ServiceSeed = {
  slug: string;
  name: string;
  aliases: string[];
  categorySlug: string;
  websiteUrl?: string;
  plans: ServicePlanSeed[];
};

const rub = (
  name: string,
  rubles: number,
  period: ServicePlanSeed['period'],
  isDefault = false,
): ServicePlanSeed => ({
  name,
  amountMinor: rubles * 100,
  currency: 'RUB',
  period,
  ...(isDefault ? { isDefault: true } : {}),
});

const usd = (
  name: string,
  dollars: number,
  cents: number,
  period: ServicePlanSeed['period'],
  isDefault = false,
): ServicePlanSeed => ({
  name,
  amountMinor: dollars * 100 + cents,
  currency: 'USD',
  period,
  ...(isDefault ? { isDefault: true } : {}),
});

export const services: ServiceSeed[] = [
  // ── Видео и кино ───────────────────────────────────────
  {
    slug: 'kinopoisk',
    name: 'Кинопоиск',
    aliases: ['kinopoisk', 'кинопойск', 'кинопоиск hd', 'яндекс кинопоиск', 'кп'],
    categorySlug: 'video',
    websiteUrl: 'https://www.kinopoisk.ru',
    plans: [rub('Подписка', 399, 'monthly', true), rub('На год', 3990, 'yearly')],
  },
  {
    slug: 'okko',
    name: 'Okko',
    aliases: ['окко', 'okko sport'],
    categorySlug: 'video',
    websiteUrl: 'https://okko.tv',
    plans: [rub('Оптимум', 399, 'monthly', true), rub('Премиум', 699, 'monthly')],
  },
  {
    slug: 'ivi',
    name: 'Иви',
    aliases: ['ivi', 'иви ру'],
    categorySlug: 'video',
    websiteUrl: 'https://www.ivi.ru',
    plans: [rub('Подписка', 399, 'monthly', true), rub('На год', 2990, 'yearly')],
  },
  {
    slug: 'wink',
    name: 'Wink',
    aliases: ['винк', 'ростелеком wink'],
    categorySlug: 'video',
    websiteUrl: 'https://wink.ru',
    plans: [rub('Подписка', 299, 'monthly', true)],
  },
  {
    slug: 'premier',
    name: 'Premier',
    aliases: ['премьер', 'premier one'],
    categorySlug: 'video',
    websiteUrl: 'https://premier.one',
    plans: [rub('Подписка', 299, 'monthly', true), rub('На год', 2390, 'yearly')],
  },
  {
    slug: 'start',
    name: 'Start',
    aliases: ['старт', 'start ru'],
    categorySlug: 'video',
    websiteUrl: 'https://start.ru',
    plans: [rub('Подписка', 399, 'monthly', true)],
  },
  {
    slug: 'kion',
    name: 'KION',
    aliases: ['кион', 'мтс кион'],
    categorySlug: 'video',
    websiteUrl: 'https://kion.ru',
    plans: [rub('Подписка', 349, 'monthly', true)],
  },
  {
    slug: 'amediateka',
    name: 'Амедиатека',
    aliases: ['amediateka', 'амедиа'],
    categorySlug: 'video',
    websiteUrl: 'https://www.amediateka.ru',
    plans: [rub('Подписка', 599, 'monthly', true)],
  },
  {
    slug: 'netflix',
    name: 'Netflix',
    aliases: ['нетфликс', 'netflicks'],
    categorySlug: 'video',
    websiteUrl: 'https://www.netflix.com',
    plans: [usd('Standard', 15, 49, 'monthly', true), usd('Premium', 22, 99, 'monthly')],
  },

  // ── Музыка и аудио ─────────────────────────────────────
  {
    slug: 'yandex-plus',
    name: 'Яндекс Плюс',
    aliases: ['yandex plus', 'я.плюс', 'яплюс', 'плюс мульти'],
    categorySlug: 'music',
    websiteUrl: 'https://plus.yandex.ru',
    plans: [rub('Плюс', 399, 'monthly', true), rub('Плюс на год', 3990, 'yearly')],
  },
  {
    slug: 'vk-music',
    name: 'VK Музыка',
    aliases: ['вк музыка', 'boom', 'бум', 'vk music'],
    categorySlug: 'music',
    websiteUrl: 'https://vk.com/music',
    plans: [rub('Подписка', 269, 'monthly', true)],
  },
  {
    slug: 'zvuk',
    name: 'Звук',
    aliases: ['zvuk', 'сбер звук', 'sberzvuk'],
    categorySlug: 'music',
    websiteUrl: 'https://zvuk.com',
    plans: [rub('Подписка', 299, 'monthly', true)],
  },
  {
    slug: 'spotify',
    name: 'Spotify',
    aliases: ['спотифай', 'спотифи'],
    categorySlug: 'music',
    websiteUrl: 'https://www.spotify.com',
    plans: [usd('Premium', 11, 99, 'monthly', true), usd('Duo', 16, 99, 'monthly')],
  },
  {
    slug: 'apple-music',
    name: 'Apple Music',
    aliases: ['эпл мьюзик', 'эппл музыка'],
    categorySlug: 'music',
    websiteUrl: 'https://music.apple.com',
    plans: [usd('Individual', 10, 99, 'monthly', true)],
  },
  {
    slug: 'youtube-premium',
    name: 'YouTube Premium',
    aliases: ['ютуб премиум', 'youtube music'],
    categorySlug: 'music',
    websiteUrl: 'https://www.youtube.com/premium',
    plans: [usd('Individual', 13, 99, 'monthly', true)],
  },

  // ── Облако и хранилища ─────────────────────────────────
  {
    slug: 'yandex-disk',
    name: 'Яндекс Диск',
    aliases: ['yandex disk', 'яндекс диск 1тб', 'ядиск'],
    categorySlug: 'cloud',
    websiteUrl: 'https://disk.yandex.ru',
    plans: [rub('1 ТБ', 300, 'monthly', true), rub('100 ГБ', 99, 'monthly')],
  },
  {
    slug: 'google-one',
    name: 'Google One',
    aliases: ['гугл ван', 'google drive', 'гугл диск'],
    categorySlug: 'cloud',
    websiteUrl: 'https://one.google.com',
    plans: [usd('100 ГБ', 1, 99, 'monthly', true), usd('2 ТБ', 9, 99, 'monthly')],
  },
  {
    slug: 'icloud',
    name: 'iCloud+',
    aliases: ['айклауд', 'icloud plus', 'apple icloud'],
    categorySlug: 'cloud',
    websiteUrl: 'https://www.icloud.com',
    plans: [usd('50 ГБ', 0, 99, 'monthly', true), usd('200 ГБ', 2, 99, 'monthly')],
  },
  {
    slug: 'dropbox',
    name: 'Dropbox',
    aliases: ['дропбокс'],
    categorySlug: 'cloud',
    websiteUrl: 'https://www.dropbox.com',
    plans: [usd('Plus', 11, 99, 'monthly', true)],
  },
  {
    slug: 'mail-cloud',
    name: 'Облако Mail',
    aliases: ['облако мейл', 'mail cloud', 'облако маил ру'],
    categorySlug: 'cloud',
    websiteUrl: 'https://cloud.mail.ru',
    plans: [rub('1 ТБ', 349, 'monthly', true)],
  },

  // ── Доставка и маркетплейсы ────────────────────────────
  {
    slug: 'ozon-premium',
    name: 'Ozon Premium',
    aliases: ['озон премиум', 'озон подписка'],
    categorySlug: 'delivery',
    websiteUrl: 'https://www.ozon.ru',
    plans: [rub('Premium', 399, 'monthly', true), rub('Premium на год', 2999, 'yearly')],
  },
  {
    slug: 'yandex-market-plus',
    name: 'Яндекс Маркет',
    aliases: ['яндекс маркет плюс', 'market plus', 'маркет подписка'],
    categorySlug: 'delivery',
    websiteUrl: 'https://market.yandex.ru',
    plans: [rub('Подписка', 249, 'monthly', true)],
  },
  {
    slug: 'sberprime',
    name: 'СберПрайм',
    aliases: ['sberprime', 'сбер прайм', 'сберпрайм плюс'],
    categorySlug: 'delivery',
    websiteUrl: 'https://sberprime.sber.ru',
    plans: [rub('Прайм', 299, 'monthly', true), rub('Прайм+', 499, 'monthly')],
  },
  {
    slug: 'samokat',
    name: 'Самокат',
    aliases: ['samokat', 'самакат'],
    categorySlug: 'delivery',
    websiteUrl: 'https://samokat.ru',
    plans: [rub('Подписка', 199, 'monthly', true)],
  },
  {
    slug: 'vk-combo',
    name: 'VK Combo',
    aliases: ['вк комбо', 'combo'],
    categorySlug: 'delivery',
    websiteUrl: 'https://combo.vk.com',
    plans: [rub('Combo', 199, 'monthly', true)],
  },

  // ── Обучение ───────────────────────────────────────────
  {
    slug: 'skillbox',
    name: 'Skillbox',
    aliases: ['скилбокс', 'скиллбокс'],
    categorySlug: 'education',
    websiteUrl: 'https://skillbox.ru',
    plans: [rub('Подписка', 1990, 'monthly', true)],
  },
  {
    slug: 'netology',
    name: 'Нетология',
    aliases: ['netology', 'нетологиа'],
    categorySlug: 'education',
    websiteUrl: 'https://netology.ru',
    plans: [rub('Подписка', 2900, 'monthly', true)],
  },
  {
    slug: 'skyeng',
    name: 'Skyeng',
    aliases: ['скайэнг', 'скай инглиш'],
    categorySlug: 'education',
    websiteUrl: 'https://skyeng.ru',
    plans: [rub('Подписка', 3990, 'monthly', true)],
  },
  {
    slug: 'duolingo',
    name: 'Duolingo',
    aliases: ['дуолинго', 'дуо'],
    categorySlug: 'education',
    websiteUrl: 'https://www.duolingo.com',
    plans: [usd('Super', 12, 99, 'monthly', true)],
  },
  {
    slug: 'coursera',
    name: 'Coursera',
    aliases: ['курсера'],
    categorySlug: 'education',
    websiteUrl: 'https://www.coursera.org',
    plans: [usd('Plus', 59, 0, 'monthly', true)],
  },
  {
    slug: 'litres',
    name: 'Литрес',
    aliases: ['litres', 'литрес подписка'],
    categorySlug: 'news',
    websiteUrl: 'https://www.litres.ru',
    plans: [rub('Подписка', 499, 'monthly', true)],
  },
  {
    slug: 'bookmate',
    name: 'Bookmate',
    aliases: ['букмейт', 'букмэйт'],
    categorySlug: 'news',
    websiteUrl: 'https://bookmate.ru',
    plans: [rub('Подписка', 399, 'monthly', true)],
  },

  // ── Игры ───────────────────────────────────────────────
  {
    slug: 'ps-plus',
    name: 'PlayStation Plus',
    aliases: ['ps plus', 'пс плюс', 'плейстейшн плюс'],
    categorySlug: 'games',
    websiteUrl: 'https://www.playstation.com',
    plans: [usd('Essential', 9, 99, 'monthly', true), usd('Extra', 14, 99, 'monthly')],
  },
  {
    slug: 'xbox-game-pass',
    name: 'Xbox Game Pass',
    aliases: ['гейм пасс', 'game pass', 'иксбокс'],
    categorySlug: 'games',
    websiteUrl: 'https://www.xbox.com',
    plans: [usd('Ultimate', 19, 99, 'monthly', true)],
  },
  {
    slug: 'vk-play',
    name: 'VK Play',
    aliases: ['вк плей', 'vk play cloud'],
    categorySlug: 'games',
    websiteUrl: 'https://vkplay.ru',
    plans: [rub('Подписка', 399, 'monthly', true)],
  },

  // ── Софт и сервисы ─────────────────────────────────────
  {
    slug: 'adobe-creative-cloud',
    name: 'Adobe Creative Cloud',
    aliases: ['адоб', 'adobe cc', 'фотошоп подписка'],
    categorySlug: 'software',
    websiteUrl: 'https://www.adobe.com',
    plans: [usd('All Apps', 59, 99, 'monthly', true), usd('Photography', 19, 99, 'monthly')],
  },
  {
    slug: 'microsoft-365',
    name: 'Microsoft 365',
    aliases: ['офис 365', 'office 365', 'майкрософт офис'],
    categorySlug: 'software',
    websiteUrl: 'https://www.microsoft.com/microsoft-365',
    plans: [usd('Personal', 6, 99, 'monthly', true), usd('Family', 9, 99, 'monthly')],
  },
  {
    slug: 'jetbrains',
    name: 'JetBrains',
    aliases: ['джетбрейнс', 'intellij', 'webstorm', 'pycharm'],
    categorySlug: 'software',
    websiteUrl: 'https://www.jetbrains.com',
    plans: [usd('All Products', 28, 90, 'monthly', true)],
  },
  {
    slug: 'notion',
    name: 'Notion',
    aliases: ['ноушен', 'ношн'],
    categorySlug: 'software',
    websiteUrl: 'https://www.notion.so',
    plans: [usd('Plus', 10, 0, 'monthly', true)],
  },
  {
    slug: 'figma',
    name: 'Figma',
    aliases: ['фигма'],
    categorySlug: 'software',
    websiteUrl: 'https://www.figma.com',
    plans: [usd('Professional', 15, 0, 'monthly', true)],
  },
  {
    slug: 'chatgpt-plus',
    name: 'ChatGPT Plus',
    aliases: ['чат гпт', 'openai подписка', 'гпт плюс'],
    categorySlug: 'software',
    websiteUrl: 'https://chat.openai.com',
    plans: [usd('Plus', 20, 0, 'monthly', true)],
  },

  // ── Здоровье и спорт ───────────────────────────────────
  {
    slug: 'fitstars',
    name: 'FitStars',
    aliases: ['фитстарс', 'фит старс'],
    categorySlug: 'health',
    websiteUrl: 'https://fitstars.ru',
    plans: [rub('Подписка', 999, 'monthly', true)],
  },
  {
    slug: 'gymteam',
    name: 'GymTeam',
    aliases: ['джимтим', 'джим тим'],
    categorySlug: 'health',
    websiteUrl: 'https://gymteam.ru',
    plans: [rub('Подписка', 1490, 'monthly', true)],
  },
];
