# 03. Модель данных

> Статус: черновик на согласовании · Обновлён: 2026-07-27

## 1. Правила, обязательные для всех таблиц

| Правило | Причина |
| --- | --- |
| Деньги — только `Int` в минорных единицах (`amountMinor`) | `float` даёт ошибки округления. 599.99 ₽ хранится как `59999` |
| Все даты — `DateTime` в UTC | Часовой пояс применяется только при отображении и расчёте тихих часов |
| Первичные ключи — `cuid()` | Не раскрывают количество записей, безопасны в URL |
| Удаление пользовательских данных — мягкое (`deletedAt`) | Требование `FR-01`: восстановление в течение 30 дней |
| Каждая пользовательская таблица имеет `userId` с индексом | Изоляция данных проверяется на уровне запроса всегда |
| `createdAt` / `updatedAt` — на всех таблицах | Отладка и аналитика |

## 2. Карта сущностей

```
User ──1:N── AuthIdentity          (способы входа)
 │
 ├──1:N── Subscription ──N:1── Service ──1:N── ServicePlan
 │             │                  │
 │             │                  └──1:1── CancellationGuide
 │             │
 │             ├──1:N── BillingEvent      (списания: прошлые и будущие)
 │             └──1:N── CancellationFlow  (попытки отмены)
 │
 ├──1:N── ReminderRule      (когда и куда напоминать)
 ├──1:N── NotificationDelivery  (что уже отправлено — дедупликация)
 ├──1:N── ImportConnection ──1:N── ImportCandidate
 ├──1:1── UserSettings      (базовая валюта, тихие часы, локаль)
 └──1:N── Session

ExchangeRate     (справочник курсов, общий)
Category         (справочник категорий, общий + пользовательские)
FeatureFlag      (тарифные ограничения)
AuditLog         (изменения состояний подписок)
```

## 3. Состояния подписки

```
                  ┌──────────┐
      создана ───→│  trial   │
                  └────┬─────┘
                       │ дата окончания триала наступила (авто)
                       ↓
   создана ───────→┌──────────┐←──── возобновление ────┐
                   │  active  │                        │
                   └────┬─────┘                        │
            пауза       │        отмена подтверждена   │
                 ┌──────┴──────┐                  ┌────┴─────┐
                 ↓             ↓                  │  paused  │
           ┌──────────┐  ┌───────────┐            └──────────┘
           │  paused  │  │ cancelled │
           └──────────┘  └─────┬─────┘
                               │ оплаченный период закончился (авто)
                               ↓
                        ┌───────────┐
                        │  expired  │
                        └───────────┘
```

**Инварианты переходов:**
- В `cancelled` можно попасть **только** через `CancellationProvider.confirm()`. Прямая запись состояния запрещена.
- `trial → active` и `cancelled → expired` выполняет фоновая задача по дате, не пользователь.
- `expired` — финальное состояние. Возврат возможен только созданием новой подписки.
- `paused` не влияет на расчёт расходов и не генерирует `BillingEvent`.
- Каждый переход пишется в `AuditLog`.

## 4. Схема Prisma

```prisma
// ─────────────────────────────────────────────────────────
//  Пользователь и доступ
// ─────────────────────────────────────────────────────────

model User {
  id        String    @id @default(cuid())
  plan      Plan      @default(free)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?          // запрос на удаление; стирание через 30 дней (FR-12)

  identities    AuthIdentity[]
  subscriptions Subscription[]
  settings      UserSettings?
  reminderRules ReminderRule[]
  deliveries    NotificationDelivery[]
  importConns   ImportConnection[]
  sessions      Session[]

  @@index([deletedAt])
}

enum Plan {
  free
  pro
}

/// Способ входа. Один User может иметь несколько — это позволяет
/// войти через Telegram и через email в один и тот же аккаунт (FR-09).
model AuthIdentity {
  id         String       @id @default(cuid())
  userId     String
  provider   AuthProvider
  externalId String       // telegram id либо нормализованный email
  verifiedAt DateTime?
  createdAt  DateTime     @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, externalId])
  @@index([userId])
}

enum AuthProvider {
  telegram
  email_otp
  yandex     // зарезервировано, в MVP не активен
  vk         // зарезервировано, в MVP не активен
}

model Session {
  id         String   @id @default(cuid())
  userId     String
  tokenHash  String   @unique   // хранится ХЕШ, не сам токен
  expiresAt  DateTime
  lastSeenAt DateTime @default(now())
  userAgent  String?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model UserSettings {
  id           String @id @default(cuid())
  userId       String @unique
  baseCurrency String @default("RUB")   // ISO 4217
  locale       String @default("ru")
  timezone     String @default("Europe/Moscow")

  quietHoursStart Int @default(22)      // час 0–23 в локальном времени
  quietHoursEnd   Int @default(9)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ─────────────────────────────────────────────────────────
//  Каталог сервисов (общий справочник, не привязан к пользователю)
// ─────────────────────────────────────────────────────────

model Service {
  id         String  @id @default(cuid())
  slug       String  @unique       // "kinopoisk" — используется в SEO-URL
  name       String                // "Кинопоиск"
  aliases    String[]              // ["кинопоиск","kinopoisk","яндекс кинопоиск"] — поиск с опечатками (FR-04)
  logoUrl    String?
  websiteUrl String?
  categoryId String?
  isActive   Boolean @default(true)

  category      Category?          @relation(fields: [categoryId], references: [id])
  plans         ServicePlan[]
  guide         CancellationGuide?
  subscriptions Subscription[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slug])
  @@index([categoryId])
}

/// Известные тарифы сервиса — для автозаполнения при добавлении подписки (FR-01).
model ServicePlan {
  id          String       @id @default(cuid())
  serviceId   String
  name        String       // "Плюс Мульти"
  amountMinor Int          // 39900 = 399,00 ₽
  currency    String
  period      BillingPeriod
  periodDays  Int?         // только для period = custom
  isDefault   Boolean      @default(false)

  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@index([serviceId])
}

/// Гид отмены. checkedAt — критичное поле: гиды устаревают,
/// старше 180 дней помечаются как требующие проверки (FR-04).
model CancellationGuide {
  id         String   @id @default(cuid())
  serviceId  String   @unique
  steps      Json     // [{ order, title, description, imageUrl? }]
  deepLink   String?  // прямая ссылка в раздел управления подпиской
  warnings   String[] // "Доступ сохранится до конца оплаченного периода"
  checkedAt  DateTime               // когда инструкцию последний раз проверяли
  reportCount Int     @default(0)   // сколько раз пожаловались, что не сработала

  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([checkedAt])
}

model Category {
  id       String  @id @default(cuid())
  slug     String  @unique          // "video", "music", "cloud"
  name     String
  icon     String?
  isSystem Boolean @default(true)   // false = создана пользователем
  userId   String?                  // заполнен только для пользовательских

  services      Service[]
  subscriptions Subscription[]

  @@index([userId])
}

// ─────────────────────────────────────────────────────────
//  Подписки
// ─────────────────────────────────────────────────────────

model Subscription {
  id     String @id @default(cuid())
  userId String

  serviceId   String?        // null, если пользователь ввёл сервис вручную
  customName  String?        // обязателен, когда serviceId = null
  categoryId  String?

  amountMinor Int            // ВСЕГДА минорные единицы. float запрещён
  currency    String         // исходная валюта, не меняется при пересчётах
  period      BillingPeriod
  periodDays  Int?           // только для period = custom

  status      SubscriptionStatus @default(active)
  nextBillingAt DateTime?    // null для cancelled и expired

  trialEndsAt  DateTime?     // заполнен только при status = trial (FR-05)
  accessUntil  DateTime?     // до какой даты сохраняется доступ после отмены
  cancelledAt  DateTime?

  paymentLabel String?       // метка "Тинькофф •4321". НОМЕРА КАРТ НЕ ХРАНИМ
  note         String?       @db.VarChar(500)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?        // мягкое удаление, 30 дней на восстановление

  user            User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  service         Service?           @relation(fields: [serviceId], references: [id])
  category        Category?          @relation(fields: [categoryId], references: [id])
  billingEvents   BillingEvent[]
  cancellationFlows CancellationFlow[]

  @@index([userId, status])
  @@index([userId, deletedAt])
  @@index([nextBillingAt])      // главный индекс для планировщика
  @@index([trialEndsAt])
}

enum SubscriptionStatus {
  active
  trial
  paused
  cancelled
  expired
}

enum BillingPeriod {
  weekly
  monthly
  quarterly
  semiannual
  yearly
  custom
}

/// Событие списания: прошлое (подтверждённое) или будущее (прогноз).
/// Основа и для напоминаний, и для аналитики.
model BillingEvent {
  id             String   @id @default(cuid())
  subscriptionId String
  dueAt          DateTime
  amountMinor    Int      // фиксируется на момент события: цена могла измениться
  currency       String

  status      BillingEventStatus @default(scheduled)
  confirmedAt DateTime?          // когда пользователь подтвердил факт списания

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([subscriptionId, dueAt])   // защита от дублей при пересчёте расписания
  @@index([dueAt, status])            // выборка планировщиком
}

enum BillingEventStatus {
  scheduled   // прогноз
  confirmed   // пользователь подтвердил списание
  skipped     // не произошло: пауза или отмена
}

/// Попытка отмены. Создаётся CancellationProvider.start(),
/// закрывается confirm(). Единственный путь в статус cancelled.
model CancellationFlow {
  id             String @id @default(cuid())
  subscriptionId String
  providerKind   String  // 'guide' | 'virtual-card' | 'automated'

  startedAt   DateTime            @default(now())
  outcome     CancellationOutcome?
  confirmedAt DateTime?
  note        String?

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId])
}

enum CancellationOutcome {
  succeeded       // пользователь подтвердил: отменил
  failed          // не получилось
  postponed       // решил вернуться позже
  guide_outdated  // инструкция не соответствует реальности
}

// ─────────────────────────────────────────────────────────
//  Уведомления
// ─────────────────────────────────────────────────────────

model ReminderRule {
  id     String @id @default(cuid())
  userId String

  type       NotificationType
  offsetDays Int                // за сколько дней до события
  channels   NotificationChannelId[]
  isEnabled  Boolean @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type, offsetDays])
  @@index([userId])
}

enum NotificationType {
  upcoming_charge   // скоро списание
  trial_ending      // скоро конец триала
  guide_outdated    // гид требует проверки
  weekly_digest     // недельная сводка
}

enum NotificationChannelId {
  inapp
  telegram
  webpush
  email
}

/// Журнал доставок. dedupeKey обеспечивает идемпотентность
/// планировщика (NFR-05): повторный запуск не создаст второе сообщение.
model NotificationDelivery {
  id     String @id @default(cuid())
  userId String

  dedupeKey String @unique     // hash(eventId, ruleId, channelId)
  type      NotificationType
  channel   NotificationChannelId

  status      DeliveryStatus @default(pending)
  sentAt      DateTime?
  readAt      DateTime?        // используется только для inapp
  error       String?
  payload     Json             // тело сообщения, для истории in-app ленты

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([status])
}

enum DeliveryStatus {
  pending
  sent
  failed
  deferred     // попало в тихие часы, отложено
}

// ─────────────────────────────────────────────────────────
//  Импорт (расширенный тариф)
// ─────────────────────────────────────────────────────────

model ImportConnection {
  id       String           @id @default(cuid())
  userId   String
  source   ImportSourceId
  status   ConnectionStatus @default(active)

  /// Токены доступа. ШИФРУЮТСЯ на уровне приложения перед записью (NFR-03).
  credentialsEnc String?
  lastScanAt     DateTime?
  consentAt      DateTime   // когда пользователь дал явное согласие
  revokedAt      DateTime?

  user       User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  candidates ImportCandidate[]

  createdAt DateTime @default(now())

  @@index([userId, source])
}

enum ImportSourceId {
  csv
  email
  bank
}

enum ConnectionStatus {
  active
  expired
  revoked
  error
}

/// Кандидат на подписку. НИКОГДА не превращается в Subscription
/// автоматически — только после подтверждения пользователем (FR-10).
model ImportCandidate {
  id           String @id @default(cuid())
  connectionId String

  rawLabel    String   // как выглядело в источнике: "YM*PLUS 399.00"
  amountMinor Int
  currency    String
  occurredAt  DateTime
  guessedServiceId String?   // предположение, требует подтверждения
  confidence  Float          // 0..1 — уверенность распознавания

  status      CandidateStatus @default(pending)
  resolvedAt  DateTime?
  createdSubscriptionId String?

  connection ImportConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([connectionId, status])
}

enum CandidateStatus {
  pending
  accepted
  rejected     // отклонённый не предлагается повторно (FR-10)
  duplicate
}

// ─────────────────────────────────────────────────────────
//  Справочники и служебное
// ─────────────────────────────────────────────────────────

/// Курсы из источника ЦБ РФ, обновляются раз в сутки (FR-08).
model ExchangeRate {
  id        String   @id @default(cuid())
  currency  String   // ISO 4217
  date      DateTime @db.Date
  rateMinor Int      // курс к RUB в минорных единицах, 4 знака точности
  source    String   @default("cbr")

  @@unique([currency, date])
  @@index([date])
}

/// Тарифные ограничения. Проверяются НА СЕРВЕРЕ (FR-11).
model FeatureFlag {
  id          String  @id @default(cuid())
  key         String  @unique     // "import.bank", "analytics.full", "export.data"
  requiredPlan Plan   @default(pro)
  isEnabled   Boolean @default(true)
  description String?
}

/// Аудит изменений состояний подписок (NFR-03).
model AuditLog {
  id     String  @id @default(cuid())
  userId String?

  action     String   // "subscription.cancelled", "import.connected"
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ip         String?

  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([entityType, entityId])
}
```

## 5. Расчёт следующей даты списания

Логика живёт в `domain/billing-cycle/`, тестируется без базы.

| Период | Правило |
| --- | --- |
| `weekly` | +7 дней |
| `monthly` | +1 месяц, с прижатием к последнему дню месяца |
| `quarterly` | +3 месяца, с прижатием |
| `semiannual` | +6 месяцев, с прижатием |
| `yearly` | +1 год, 29 февраля → 28 февраля в невисокосный год |
| `custom` | +`periodDays` дней |

**«Прижатие»** — обязательное правило: подписка от 31 января при `monthly` даёт 28 (или 29) февраля, затем **31 марта**, а не 28 марта. Якорем служит исходный день месяца, а не предыдущая вычисленная дата. Это классический источник ошибок, и он покрыт отдельными тестами.

## 6. Индексы: что и зачем

| Индекс | Обслуживает |
| --- | --- |
| `Subscription(nextBillingAt)` | Ежечасная выборка планировщика — самый горячий запрос |
| `Subscription(userId, status)` | Дашборд и списки |
| `BillingEvent(dueAt, status)` | Формирование напоминаний |
| `BillingEvent(subscriptionId, dueAt)` unique | Защита от дублей при пересчёте расписания |
| `NotificationDelivery(dedupeKey)` unique | Идемпотентность на уровне БД, а не только Redis |
| `Service(slug)` | Публичные SEO-страницы каталога |
| `CancellationGuide(checkedAt)` | Поиск устаревших гидов |

## 7. Тестовые данные

Сид-скрипт наполняет:
- ~12 системных категорий
- ~40 популярных в РФ и СНГ сервисов с тарифами и гидами отмены
- Курсы валют за последние 30 дней
- Демо-пользователя с набором подписок во всех пяти состояниях, включая триал и подписку в валюте — чтобы каждое состояние было видно в интерфейсе без ручной подготовки

---

**Связанные документы:** [02-architecture.md](02-architecture.md) · [04-api-contract.md](04-api-contract.md) · [glossary.md](glossary.md)
