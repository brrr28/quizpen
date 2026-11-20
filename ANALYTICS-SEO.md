# Аналитика и SEO Quizpen

Сайт: https://brrr28.github.io/quizpen/ . Код: `web/analytics.js` (подключён в `web/index.html` и `web/spec/index.html`), ключи в `web/config.js`.

## Что собираем и зачем

**PostHog (EU, eu.i.posthog.com)** — воронка: сколько учителей доходят от лендинга до записи в список и помогает ли демо.
Без cookies и localStorage (persistence `memory`): у каждой загрузки страницы свой анонимный id, профилей нет, IP можно отбросить в настройках проекта. Автосбор кликов выключен, считаются только наши события.

| Событие | Когда | Свойства |
|---|---|---|
| `landing_viewed` | открыт лендинг или spec | `lang`, `has_ref` |
| `demo_started` | нажали «Создать тест» | `sample` (id готового примера или `custom`), `lang` |
| `quiz_generated` | тест показан или ошибка | `ok`, `ms`, `source` (`live` / `fallback`) |
| `quiz_answered`, `quiz_completed` | ответ на вопрос, конец теста | `index`, `correct` / `score`, `questions` |
| `quiz_copied`, `share_opened`, `student_preview_opened` | копирование теста, «Поделиться с классом», «Превью для ученика» | — |
| `signup_submitted`, `signup_succeeded` | отправка и успех записи | `has_ref`, `already`, `demo_used` |
| `referral_link_copied`, `referral_shared` | своя реферальная ссылка | `channel` |
| `lang_switched`, `theme_toggled`, `consent_chosen` | язык, тема, выбор по аналитике | `from`/`to`, `theme`, `choice` |

Никогда не уходят: почта, текст урока, текст теста, реферальный код, `?ref=` и `#…` из адреса (вычищаются перед отправкой).

**Microsoft Clarity** — тепловые карты и записи сессий, только после согласия. Поля почты, урока, теста, ссылок и окна «Поделиться» замаскированы.

**Страница ученика (`web/play/`) не шлёт ничего**: там написано, что ответы никуда не отправляются, поэтому `analytics.js` туда не подключён, и CSP страницы блокирует любые запросы. Превью в iframe тоже молчит.

## Согласие

- Без ключей в `config.js` ничего не грузится.
- Do Not Track, Global Privacy Control или «экономия трафика» в браузере — не грузится ничего, даже PostHog.
- PostHog-события идут сразу (анонимно, без cookies). Clarity и записи сессий PostHog — только после «Allow analytics».
- Плашка EN/UA внизу, выбор хранится 365 дней (`localStorage.qp_consent`). Отозвать: кнопка «Analytics settings» / «Налаштування аналітики» в подвале.
- Страница `spec/` — только PostHog, без плашки и без Clarity.

## Воронка в PostHog

eu.posthog.com → Product analytics → New insight → **Funnels**:
1. `landing_viewed`
2. `demo_started`
3. `quiz_generated` (фильтр `ok = true`)
4. `signup_succeeded`

Фильтр `surface = landing` (или `spec` для второго варианта страницы). Окно конверсии — 1 час. Так как id живёт одну загрузку страницы, воронка считает путь внутри одного визита.
Демо против без демо: Breakdown по `demo_used` на `signup_succeeded`, или две воронки `landing_viewed → signup_succeeded` с шагом-исключением `demo_started` и `landing_viewed → demo_started → signup_succeeded`.
В настройках проекта включить «Discard client IP data».

## Тепловые карты Clarity

clarity.microsoft.com → проект Quizpen → **Heatmaps** → страница `brrr28.github.io/quizpen/`; записи — **Recordings**. Данные только от тех, кто нажал «Allow analytics». Маскирование в проекте — Balanced.

## Search Console и sitemap

- Владение подтверждено HTML-файлом `web/googlecc0c4bdfc53fdacd.html` (лежит на main и gh-pages). **Не удалять** — иначе подтверждение слетит.
- На странице: canonical, hreflang en / uk / x-default, robots `index,follow`, JSON-LD (WebSite + EducationalApplication, цена 0). `?lang=uk` — свой canonical. `spec/` и `play/` — `noindex,follow`.
- Sitemap: `https://brrr28.github.io/quizpen/sitemap.xml` (обе языковые версии). После выкладки: Search Console → Sitemaps → добавить `sitemap.xml`; URL Inspection → Request indexing для `/` и `/?lang=uk`.
- robots.txt не нужен и невозможен: сайт проекта GitHub Pages не может отдать `/robots.txt` в корне домена.

## Проверка

`node web/dev/analytics-check.mjs` (через `heavy-run`): свой сервер, headless Chrome, запросы к PostHog и Clarity перехватываются и никуда не уходят, ключи подменяются пустыми или тестовыми.
