# CALORIA

**Спокойный дневник питания в Telegram: калории, БЖУ, вода, вес, статистика и мягкие напоминания.**

CALORIA — это полноценная экосистема из четырёх частей:

| Часть | Технологии | Где работает |
| --- | --- | --- |
| Telegram Mini App | HTML5, CSS3, vanilla ES modules, Chart.js, Lucide | GitHub Pages |
| REST API | Node.js 20+, Express, Zod, JWT | Render |
| Telegram-бот и планировщик | Telegraf 4, node-cron | Render (тот же сервис) |
| База данных | PostgreSQL (Supabase) + SQL-миграции, RLS | Supabase |

Проект не является медицинским изделием. Расчёты калорий и БЖУ носят ориентировочный характер и не заменяют консультацию врача или нутрициолога.

---

## Содержание

1. [Что уже реализовано](#что-уже-реализовано)
2. [Архитектура](#архитектура)
3. [Структура репозитория](#структура-репозитория)
4. [Локальный запуск](#локальный-запуск)
5. [Тесты и проверки](#тесты-и-проверки)
6. [Переменные окружения](#переменные-окружения)
7. [Supabase: база данных](#supabase-база-данных)
8. [Telegram-бот](#telegram-бот)
9. [GitHub Pages: публикация frontend](#github-pages-публикация-frontend)
10. [Render: backend и бот](#render-backend-и-бот)
11. [Порядок первого развёртывания](#порядок-первого-развёртывания)
12. [Проверка работоспособности](#проверка-работоспособности)
13. [API](#api)
14. [Безопасность](#безопасность)
15. [Надёжность и обработка ошибок](#надёжность-и-обработка-ошибок)
16. [Ограничения по здоровью](#ограничения-по-здоровью)
17. [Обслуживание](#обслуживание)
18. [Устранение неполадок](#устранение-неполадок)
19. [Что нужно сделать вручную](#что-нужно-сделать-вручную)

---

## Что уже реализовано

### Mini App

- **Онбординг**: возраст, рост, вес, пол, активность, цель, желаемый вес, часовой пояс.
- **Главная**: приветствие по времени суток, дата, аватар, переключение дня, большой круговой индикатор калорий (с корректным показом превышения), карточки БЖУ, вода, приёмы пищи, последние продукты, мини-график за 7 дней, серия заполненных дней.
- **Дневник**: завтрак / обед / ужин / перекусы; добавление, редактирование порции, перенос между приёмами, удаление, копирование отдельного приёма пищи или всего предыдущего дня, выбор даты, детальные БЖУ по каждой записи.
- **Добавление еды**: модальный поиск, недавние, избранное, популярные, создание своего продукта, пересчёт КБЖУ для любой граммовки в реальном времени, вес одной штуки.
- **Статистика**: периоды 7 / 30 / 90 дней и «Всё время»; калории по дням, цель, средние значения, регулярность, доля БЖУ, динамика веса. Chart.js, адаптивные минималистичные графики.
- **Прогресс**: вес, история, график тренда, обхваты (талия, бёдра, грудь), фотографии прогресса со сжатием на клиенте, удаление записей.
- **Профиль**: параметры тела и цели, ручная настройка калорий и БЖУ с защитными минимумами, напоминания (время, тихие часы, вода, часовой пояс), тема, выход, ссылка на бота.
- **Тёмная тема по умолчанию**, светлая — переключателем; safe-area Telegram, нижняя навигация, состояния загрузки, пустые состояния, ошибки, офлайн-баннер.

### Telegram-бот

- `/start` — приветствие и inline-кнопка **«ОТКРЫТЬ CALORIA»**.
- `/app` — открыть Mini App.
- `/today` — сводка за текущий день.
- `/help` — команды и подсказки.
- `/settings`, `/reminders` — управление напоминаниями.
- `/time завтрак 08:30` — изменить время.
- Текстовая запись еды: «Съела 2 яйца и 100 грамм хлеба» → парсинг, расчёт, **подтверждение**, сохранение только после нажатия «Добавить».
- Фото еды: если настроен `OPENAI_API_KEY` — приблизительное распознавание с обязательным подтверждением; без ключа бот честно просит описать текстом.
- Утреннее приветствие, завтрак, обед, ужин, вечерняя проверка, вода; тихие часы, защита от дублей через `notification_logs`, индивидуальный часовой пояс.
- Напоминания о приёме пищи не отправляются, если этот приём уже записан.

### Backend

- Проверка подписи `initData` по алгоритму Telegram (HMAC-SHA256), проверка `auth_date`, JWT-сессии.
- REST API с Zod-валидацией, rate limit, идемпотентностью изменяющих запросов, CORS allowlist, security headers.
- Supabase через service role только на сервере; RLS включён на всех таблицах.
- Планировщик напоминаний (node-cron, ежесекундная проверка раз в минуту) + endpoint `/api/cron/tick` для внешнего пинга.
- Webhook Telegram с секретным заголовком; polling — только в development.
- Graceful shutdown по SIGTERM/SIGINT.
- 45 автоматических тестов: API, авторизация, формулы, парсер, сценарии бота, часовые пояса, планировщик.

---

## Архитектура

```text
Telegram (iOS/Android/Desktop)
        │
        │  initData (подписано ботом)
        ▼
GitHub Pages ─── HTTPS ───► Render: Express API + Telegraf webhook
   Mini App                        │                │
   (static)                        │                └── node-cron: напоминания
                                   ▼
                             Supabase PostgreSQL
                             (service role, RLS)
```

- Frontend полностью статический: GitHub Pages не выполняет Node.js.
- Секреты хранятся только в Render → Environment (и в GitHub Secrets, если понадобятся).
- `frontend/config.js` не содержит секретов: только публичный `API_BASE_URL` и имя бота, которые подставляются при сборке Pages.

---

## Структура репозитория

```text
caloria/
├── frontend/                 # статический Mini App
│   ├── index.html
│   ├── config.js             # плейсхолдеры сборки
│   ├── css/                  # main.css, components.css, responsive.css
│   ├── js/                   # app, api, telegram, dashboard, diary, food, statistics, progress, profile
│   ├── assets/               # иконки и vendored Chart.js/Lucide
│   ├── test/                 # unit-тесты чистых функций
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── server.js         # HTTP + webhook + graceful shutdown
│   │   ├── bot.js            # команды и подтверждение еды
│   │   ├── config/           # конфигурация и валидация env
│   │   ├── routes/           # REST-маршруты
│   │   ├── controllers/      # тонкие HTTP-контроллеры
│   │   ├── services/         # бизнес-логика: питание, дневник, статистика, напоминания
│   │   ├── middleware/       # auth, validation, errors, rate limit, security
│   │   ├── database/         # Supabase и JSON-fallback для разработки
│   │   ├── scheduler/        # зарезервировано под расширение
│   │   └── utils/
│   ├── test/                 # node:test
│   ├── package.json
│   └── .env.example
├── database/migrations/
│   ├── 001_init.sql          # таблицы, индексы, RLS, триггеры
│   └── 002_seed_foods.sql    # проверенная база продуктов
├── scripts/                  # serve-frontend, prepare-pages, check-syntax
├── .github/workflows/deploy.yml
├── render.yaml
├── package.json
└── README.md
```

---

## Локальный запуск

### Требования

- Node.js **20+** (проверено на 22).
- npm 10+.
- Свободные порты `3000` (API) и `5500` (frontend).

### 1. Установить backend-зависимости

```bash
cd backend
npm ci
```

### 2. Запустить API

```bash
# из корня репозитория
npm run dev:api
```

Без Supabase backend использует локальное JSON-хранилище `backend/.dev-data/caloria.json`. Это **только для разработки**: в `NODE_ENV=production` конфигурация требует Supabase и не запустится без него.

### 3. Запустить frontend

Во втором терминале:

```bash
# из корня репозитория
npm run dev:web
```

Откройте <http://localhost:5500>. Вне Telegram при `NODE_ENV=development` работает dev-вход: создаётся тестовый пользователь. Другой тестовый Telegram ID можно задать через `?dev=123456789`.

### 4. Подключить Supabase локально (необязательно)

Скопируйте `backend/.env.example` в `backend/.env`, заполните `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` — backend автоматически переключится на PostgreSQL.

> Никогда не коммитьте `.env`. Он уже в `.gitignore`.

---

## Тесты и проверки

```bash
# из корня
npm test          # backend (45 тестов) + frontend (8 тестов)
npm run check     # синтаксис всех JS-файлов
```

Отдельно:

```bash
cd backend && npm test
cd frontend && npm test
```

Проверка production-сборки frontend без публикации:

```bash
API_BASE_URL=https://example.onrender.com BOT_USERNAME=my_caloria_bot npm run prepare:pages
# результат в dist/
```

Скрипт намеренно завершится ошибкой, если `API_BASE_URL` пустой, не HTTPS или указывает на localhost.

---

## Переменные окружения

### Backend (Render → Environment, локально `backend/.env`)

| Переменная | Обязательна | Где получить | Пример |
| --- | --- | --- | --- |
| `BOT_TOKEN` | да | @BotFather → `/mybots` → API Token | `123456:AA...` |
| `WEBHOOK_SECRET` | да | придумать: `openssl rand -hex 32` (только `A-Za-z0-9_-`) | `a1b2...` |
| `WEBHOOK_URL` | нет | Render подставляет `RENDER_EXTERNAL_URL`; можно задать вручную | `https://caloria-api.onrender.com` |
| `MINI_APP_URL` | да | URL GitHub Pages с завершающим `/` | `https://user.github.io/caloria/` |
| `SUPABASE_URL` | да | Supabase → Project Settings → API → Project URL | `https://abcd.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | да | Supabase → Project Settings → API → `service_role` | `eyJ...` |
| `JWT_SECRET` | да | `openssl rand -hex 48` | длинная строка |
| `CORS_ORIGINS` | рекомендуется | origin GitHub Pages (без пути) | `https://user.github.io` |
| `CRON_SECRET` | рекомендуется | `openssl rand -hex 32` | `...` |
| `NODE_ENV` | да | — | `production` |
| `PORT` | нет | Render задаёт сам | `3000` |
| `SCHEDULER_ENABLED` | нет | — | `true` |
| `DEFAULT_TIMEZONE` | нет | IANA timezone | `Europe/Moscow` |
| `AUTH_MAX_AGE_SECONDS` | нет | максимальный возраст `initData` | `86400` |
| `FOOD_API_KEY` | нет | USDA FoodData Central API key | `...` |
| `OPENAI_API_KEY` | нет | ключ OpenAI-совместимого API | `sk-...` |
| `OPENAI_VISION_MODEL` | нет | модель распознавания фото | `gpt-4o-mini` |
| `ENABLE_DEV_AUTH` | нет | **только локально**, в production игнорируется | `true` |
| `DEV_DATA_DIR` | нет | папка JSON-fallback | `./.dev-data` |

### Frontend (GitHub → Settings → Secrets and variables → Actions → Variables)

| Переменная | Обязательна | Значение |
| --- | --- | --- |
| `API_BASE_URL` | да | Публичный HTTPS URL Render, без `/` на конце |
| `BOT_USERNAME` | рекомендуется | Username бота без `@` — для кнопки «Открыть бота» |

Frontend не использует Supabase напрямую и не хранит никаких секретов.

---

## Supabase: база данных

1. Зарегистрируйтесь на <https://supabase.com> и создайте проект (Free tier достаточно).
2. Сохраните пароль базы данных в надёжном месте.
3. Откройте **SQL Editor**.
4. Выполните по очереди содержимое:
   - `database/migrations/001_init.sql`
   - `database/migrations/002_seed_foods.sql`
5. Проверьте **Table Editor**: должны появиться `users`, `food_products`, `food_entries`, `weight_history`, `body_measurements`, `progress_photos`, `user_goals`, `reminder_settings`, `notification_logs`, `water_logs`, `favorites`, `bot_pending_entries`.
6. Проверьте **Authentication → Policies** или SQL: RLS включён на всех таблицах.
7. Скопируйте из **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`;
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY` (только Render, никогда frontend).

Миграции идемпотентны: `create table if not exists`, `create index if not exists`. Повторный запуск безопасен.

> `service_role` обходит RLS. Он допустим только на сервере. Публичный `anon` key frontend не использует.

---

## Telegram-бот

1. Откройте @BotFather → `/newbot`.
2. Задайте имя (например, `CALORIA`) и username (например, `my_caloria_bot`).
3. Скопируйте **API Token** → `BOT_TOKEN`.
4. Username без `@` → GitHub Variable `BOT_USERNAME`.
5. После деплоя backend сам:
   - установит команды (`/start`, `/today`, `/app`, `/settings`, `/reminders`, `/help`);
   - настроит Menu Button с URL Mini App;
   - зарегистрирует webhook `https://<render-service>/telegram/webhook` с `secret_token`.
6. Mini App должен быть доступен по **HTTPS**. GitHub Pages даёт HTTPS автоматически.
7. Если Telegram просит подтвердить домен, выполните в @BotFather `/setdomain` и укажите домен GitHub Pages (`<user>.github.io`).
8. Проверьте webhook:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Ожидается `"url": "https://<render-service>/telegram/webhook"` и отсутствие `last_error_message`.

### Локальная разработка бота

Если `WEBHOOK_URL` не задан и `NODE_ENV != production`, backend запускает polling. Это удобно локально, но **не используйте polling в production** — Render работает через webhook.

---

## GitHub Pages: публикация frontend

Репозиторий: <https://github.com/artemmscode/caloria> · адрес приложения после публикации: <https://artemmscode.github.io/caloria/>

1. Создайте пустой репозиторий на GitHub (например, `caloria`).
2. Загрузите проект:

```bash
git init
git add .
git commit -m "CALORIA: Mini App, API and bot"
git branch -M main
git remote add origin https://github.com/<user>/caloria.git
git push -u origin main
```

3. В репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Settings → Secrets and variables → Actions → Variables**:
   - `API_BASE_URL` = `https://<render-service>.onrender.com`;
   - `BOT_USERNAME` = username бота.
5. Workflow `.github/workflows/deploy.yml` на каждом push в `main`:
   - ставит зависимости backend;
   - проверяет синтаксис;
   - запускает тесты;
   - собирает `dist/` c подставленным `API_BASE_URL`;
   - публикует GitHub Pages.
6. Сайт будет доступен по адресу `https://<user>.github.io/<repo>/`.

Сборка использует относительные пути, поэтому работает и в корне домена, и в подкаталоге репозитория. Плейсхолдеры заменяются скриптом `scripts/prepare-pages.mjs`; `localhost` в production-сборку не попадает.

---

## Render: backend и бот

Репозиторий проекта: <https://github.com/artemmscode/caloria>
Быстрое развёртывание Blueprint: <https://render.com/deploy?repo=https://github.com/artemmscode/caloria>

### Вариант A — Blueprint (рекомендуется)

1. Зарегистрируйтесь на <https://render.com> и подключите GitHub.
2. **New → Blueprint** → выберите репозиторий.
3. Render прочитает `render.yaml` и создаст сервис `caloria-api` (rootDir `backend`).
4. Заполните секретные переменные (`sync: false`) в дашборде.
5. Дождитесь статуса **Live** и проверьте `https://<service>.onrender.com/api/health`.

### Вариант B — вручную

- **New → Web Service**, репозиторий, Root Directory `backend`.
- Runtime: Node.
- Build Command: `npm ci --omit=dev`.
- Start Command: `npm start`.
- Health Check Path: `/api/health`.
- Добавьте переменные из таблицы выше.

### После первого деплоя

1. Скопируйте публичный URL Render.
2. Пропишите его в GitHub Variable `API_BASE_URL`.
3. В Render задайте `MINI_APP_URL` = URL GitHub Pages с `/` на конце.
4. Перезапустите backend (Manual Deploy → Deploy latest commit), чтобы webhook зарегистрировался с правильным URL.
5. Перезапустите workflow Pages, чтобы frontend получил актуальный API URL.

> Пока переменная `API_BASE_URL` не задана, workflow выполняет тесты и проверки, но шаги сборки и публикации Pages пропускаются (в логе появляется предупреждение). Это защищает от публикации сборки с нерабочим адресом API. После добавления переменной следующий push или ручной запуск workflow опубликует сайт.

### Free plan и напоминания

На бесплатном плане Render сервис засыпает после простоя, поэтому напоминания могут задерживаться. Варианты:

- включить платный always-on инстанс;
- настроить внешний пинг `POST https://<service>/api/cron/tick` с заголовком `X-Cron-Secret: <CRON_SECRET>` каждые 5–10 минут (cron-job.org, UptimeRobot и т.п.). Endpoint одновременно будит сервис и запускает проверку напоминаний с окном догона 20 минут.

Планировщик внутри процесса работает и без пинга, пока сервис не спит.

---

## Порядок первого развёртывания

1. Supabase: создать проект → выполнить `001_init.sql` → `002_seed_foods.sql` → сохранить URL и `service_role`.
2. BotFather: создать бота → сохранить токен и username.
3. Render: создать сервис из `render.yaml` или вручную.
4. Render: заполнить `BOT_TOKEN`, `WEBHOOK_SECRET`, `JWT_SECRET`, `MINI_APP_URL` (`https://artemmscode.github.io/caloria/`), `SUPABASE_*`, `CORS_ORIGINS` (`https://artemmscode.github.io`).
5. GitHub: создать репозиторий, включить Pages (Source: GitHub Actions), добавить Variables `API_BASE_URL` и `BOT_USERNAME`.
6. Push в `main` → дождаться зелёного workflow → открыть Pages URL.
7. Render: обновить `MINI_APP_URL` и `CORS_ORIGINS` на реальный Pages URL → redeploy.
8. Telegram: открыть бота, `/start`, нажать «ОТКРЫТЬ CALORIA».
9. Пройти онбординг, добавить продукт, проверить статистику и напоминания.

Подробный чек-лист проверки — в следующем разделе.

---

## Проверка работоспособности

### Backend

```bash
curl -s https://<service>.onrender.com/api/health
```

Ожидается `{"ok":true,...,"database":"ok","bot":true,"scheduler":true}`.

Проверка без авторизации должна возвращать 401:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<service>.onrender.com/api/user/profile
```

### Mini App

- [ ] Открывается внутри Telegram по кнопке бота.
- [ ] Онбординг сохраняется, после перезагрузки профиль на месте.
- [ ] Добавление продукта пересчитывает кольцо калорий и БЖУ.
- [ ] Редактирование порции и перенос между приёмами сохраняются.
- [ ] Удаление записи обновляет Dashboard.
- [ ] Статистика показывает реальные данные за выбранный период.
- [ ] Вес и обхваты сохраняются, график строится.
- [ ] Настройки напоминаний сохраняются и отражаются в боте.
- [ ] Тёмная/светлая тема переключается и запоминается.
- [ ] При выключенной сети появляется офлайн-баннер, после восстановления данные обновляются.
- [ ] Никаких ошибок в консоли браузера.

### Бот

- [ ] `/start` присылает приветствие и inline-кнопку.
- [ ] Кнопка открывает Mini App.
- [ ] `/today` показывает сводку за сегодня.
- [ ] «2 яйца и 100 г хлеба» → расчёт → «Добавить» → запись появляется в Mini App.
- [ ] «Отменить» ничего не сохраняет.
- [ ] `/settings` меняет время и переключатели.
- [ ] Напоминание приходит в заданное время и не дублируется.
- [ ] В тихие часы уведомлений нет.
- [ ] Если приём пищи уже записан, напоминание о нём не приходит.

### Часовые пояса

- Смените часовой пояс в профиле на `Asia/Kamchatka`, сохраните.
- `/today` и границы дня должны использовать новый пояс.
- Напоминания приходят по местному времени пользователя.

### Безопасность

- [ ] Запрос без токена → 401.
- [ ] Подделанный `initData` → 401 (проверяется подпись, а не присланный Telegram ID).
- [ ] Устаревший `auth_date` (> 24 часов) → 401.
- [ ] Запросы к чужим записям дневника → 404/403.
- [ ] В исходниках frontend и в GitHub нет `BOT_TOKEN`, `service_role`, `JWT_SECRET`.

---

## API

Все защищённые маршруты требуют `Authorization: Bearer <JWT>`.

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/api/health` | Состояние API, БД, бота, планировщика |
| POST | `/api/auth/telegram` | Вход по `initData`, создание пользователя, JWT |
| POST | `/api/auth/dev` | Только development, при `ENABLE_DEV_AUTH=true` |
| GET | `/api/user/profile` | Профиль, цели, план, ИМТ |
| POST | `/api/user/profile` | Сохранить профиль и пересчитать план |
| POST | `/api/user/plan-preview` | Предпросмотр плана без сохранения |
| PUT | `/api/user/goals` | Ручные цели с защитными минимумами |
| GET | `/api/dashboard?date=YYYY-MM-DD` | Данные главного экрана |
| GET | `/api/diary/:date` | Дневник за день |
| POST | `/api/diary` | Добавить запись |
| PUT | `/api/diary/:id` | Изменить порцию/приём пищи |
| DELETE | `/api/diary/:id` | Удалить запись |
| POST | `/api/diary/copy` | Скопировать приём пищи из другого дня |
| GET | `/api/diary/previous?date=` | Предыдущий непустой день |
| GET | `/api/food/search?q=` | Поиск по локальной базе + USDA (если есть ключ) |
| GET | `/api/food/discovery` | Недавние, избранное, популярные |
| POST | `/api/food/custom` | Создать свой продукт |
| POST | `/api/food/favorites/:id` | Добавить/убрать избранное |
| GET | `/api/statistics?period=7d\|30d\|90d\|all` | Аналитика |
| GET | `/api/progress?period=` | Вес, обхваты, фото |
| POST | `/api/weight` | Сохранить вес |
| DELETE | `/api/weight/:id` | Удалить вес |
| POST | `/api/measurements` | Сохранить обхваты |
| DELETE | `/api/measurements/:id` | Удалить обхваты |
| POST | `/api/photos` | Сохранить фото прогресса |
| DELETE | `/api/photos/:id` | Удалить фото |
| GET | `/api/water?date=` | Вода за день |
| POST | `/api/water` | Добавить/сбросить воду |
| GET | `/api/reminders` | Настройки напоминаний |
| PUT | `/api/reminders` | Изменить настройки |
| POST | `/api/cron/tick` | Внешний запуск планировщика (`X-Cron-Secret`) |
| POST | `/telegram/webhook` | Webhook Telegram (`X-Telegram-Bot-Api-Secret-Token`) |

Формат ответа: `{ "ok": true, "data": ... }` либо `{ "ok": false, "error": { "code", "message", "details", "requestId" } }`.

---

## Безопасность

- **Telegram initData** проверяется на сервере: `secret = HMAC_SHA256("WebAppData", bot_token)`, `hash = HMAC_SHA256(secret, data_check_string)`. Telegram ID берётся только из проверенных данных.
- **auth_date** ограничен `AUTH_MAX_AGE_SECONDS` (по умолчанию сутки).
- **JWT** подписывается `JWT_SECRET`, срок — 30 дней, issuer `caloria`.
- **service_role** Supabase не покидает Render.
- **RLS** включён на всех таблицах; клиентского доступа к Supabase нет.
- **CORS** — allowlist из `CORS_ORIGINS`, `MINI_APP_URL`, `API_BASE_URL`.
- **Rate limit**: 300 запросов/мин на API, 30/мин на авторизацию.
- **Идемпотентность**: повторный POST/PUT/DELETE с тем же `X-Idempotency-Key` не создаёт дубль.
- **Zod** валидирует тело, query и params; ошибки не раскрывают внутренние детали.
- **Логи** не содержат токенов и ключей (проверяйте при добавлении новых логов).

---

## Надёжность и обработка ошибок

- GET-запросы повторяются до 2 раз с задержкой; таймаут 20 секунд.
- Frontend показывает офлайн-баннер и не выдаёт «успех», пока сервер не подтвердил операцию.
- Ошибки API отображаются человеческим текстом с кнопкой «Повторить».
- Пустой поиск и пустой дневник имеют отдельные пустые состояния.
- Планировщик защищён от параллельных тиков и дублей (`notification_logs` + уникальный `dedupe_key`).
- Graceful shutdown закрывает HTTP, планировщик и бота; Render корректно перезапускает сервис.
- При недоступности внешнего food API используется локальная проверенная база; ошибка не ломает поиск.

---

## Ограничения по здоровью

- Используется формула Миффлина — Сан Жеора и консервативный дефицит.
- Калории не опускаются ниже безопасного минимума; экстремальные цели отклоняются или сопровождаются предупреждением.
- Пользователям младше 18 лет автоматический дефицит не назначается.
- При опасной цели по весу показывается предупреждение.
- Нет рекомендаций голодания, обезвоживания и похудения на 1 кг в неделю как стандарта.
- В интерфейсе и README явно указано: это не медицинская рекомендация.

---

## Обслуживание

### Обновить код

```bash
git add .
git commit -m "Update"
git push origin main
```

GitHub Actions пересоберёт frontend; Render задеплоит backend автоматически (`autoDeploy: true`).

### Добавить миграцию

Создайте `database/migrations/003_description.sql` с идемпотентными конструкциями и выполните её в Supabase SQL Editor. Backend не запускает миграции автоматически — это осознанное решение, чтобы production-схема не менялась неожиданно.

### Ротация секретов

1. Новый `BOT_TOKEN` — @BotFather → API Token → Revoke.
2. Новый `WEBHOOK_SECRET` — обновить в Render, перезапустить сервис (webhook перерегистрируется).
3. Новый `JWT_SECRET` — все пользователи переавторизуются при следующем открытии.
4. `SUPABASE_SERVICE_ROLE_KEY` — Supabase → API → Reset.

### Резервные копии

Supabase Free делает ежедневные бэкапы с ограниченным сроком. Для важных данных настройте `pg_dump` по расписанию или перейдите на платный план.

---

## Устранение неполадок

| Симптом | Причина | Решение |
| --- | --- | --- |
| `Failed to fetch` / CORS | Origin не в allowlist | Добавьте `https://<user>.github.io` в `CORS_ORIGINS`, перезапустите Render |
| 401 сразу после входа | `JWT_SECRET` изменился или истёк токен | Очистите сессию в приложении, откройте заново |
| `Missing required production environment variables` | Не заполнены env | Сверьтесь с таблицей переменных |
| Бот молчит | Неверный `BOT_TOKEN`, webhook не установлен, сервис спит | Проверьте `getWebhookInfo`, логи Render, разбудите сервис |
| Webhook 401 | `WEBHOOK_SECRET` содержит недопустимые символы | Оставьте только `A-Za-z0-9_-`, обновите и перезапустите |
| Mini App не открывается | URL не HTTPS или не совпадает с `MINI_APP_URL` | Исправьте URL, перезапустите Render |
| Напоминания не приходят | Выключены, тихие часы, приём уже записан, free plan спит | Проверьте `/settings`, часовой пояс, внешний cron-пинг |
| Пустой поиск продуктов | Нет совпадений в локальной базе | Создайте свой продукт или подключите `FOOD_API_KEY` |
| GitHub Pages 404 | Pages не включён или выбран не тот Source | Settings → Pages → Source: GitHub Actions |
| Страница открылась, но данных нет | `API_BASE_URL` указывает на localhost | Обновите GitHub Variable и перезапустите workflow |
| Фото не сохраняется | Слишком большой файл | Приложение сжимает до ~1 МБ; попробуйте другое фото |

Логи Render: **Dashboard → сервис → Logs**. Логи структурированные, без секретов.

---

## Что нужно сделать вручную

### Владельцу проекта (без этого система не заработает)

- [ ] Создать Telegram-бота через @BotFather и получить `BOT_TOKEN`.
- [ ] Создать проект Supabase и выполнить две миграции.
- [ ] Создать GitHub-репозиторий и загрузить код.
- [ ] Включить GitHub Pages (Source: GitHub Actions).
- [ ] Добавить GitHub Variables: `API_BASE_URL`, `BOT_USERNAME`.
- [ ] Создать Render Web Service / Blueprint.
- [ ] Заполнить переменные Render (таблица выше).
- [ ] Указать реальный `MINI_APP_URL` и `CORS_ORIGINS` после публикации Pages.
- [ ] Перезапустить Render и workflow Pages после смены URL.
- [ ] Проверить чек-лист из раздела «Проверка работоспособности».
- [ ] При желании: `CRON_SECRET` + внешний пинг, `FOOD_API_KEY`, `OPENAI_API_KEY`.

### Уже сделано в репозитории

- Полный frontend и backend.
- SQL-миграции, индексы, внешние ключи, RLS.
- Проверка Telegram `initData` и JWT.
- Бот, парсер еды, подтверждение, напоминания.
- GitHub Actions, `render.yaml`, `.env.example`, `.gitignore`.
- Тесты и скрипты проверки/сборки.
- Этот README.

---

## Лицензия

Проект создан для владельца CALORIA. Перед публикацией в открытый доступ добавьте выбранную лицензию (например, MIT или проприетарную).