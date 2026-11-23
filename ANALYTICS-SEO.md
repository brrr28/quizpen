# Quizpen analytics and SEO

Site: https://brrr28.github.io/quizpen/ . Code: `web/analytics.js` (included in `web/index.html` and in the three landing variants `web/spec/`, `web/spec/b/`, `web/spec/c/`), keys in `web/config.js`.

## What is collected and why

**PostHog (EU, eu.i.posthog.com)** is used for the funnel: how many teachers get from the landing page to the waitlist, and whether the demo helps.
No cookies and no localStorage (persistence `memory`): every page load gets its own anonymous id, there are no profiles, and IP capture can be discarded in the project settings. Autocapture of clicks is off; only our own events are counted.

| Event | When | Properties |
|---|---|---|
| `landing_viewed` | landing or spec page opened | `lang`, `has_ref`; on spec pages also `variant` |
| `demo_started` | "Create quiz" pressed | `sample` (id of a ready example, or `custom`), `lang` |
| `quiz_generated` | quiz shown or an error | `ok`, `ms`, `source` (`live` / `fallback`) |
| `quiz_answered`, `quiz_completed` | a question answered, quiz finished | `index`, `correct` / `score`, `questions` |
| `quiz_copied`, `share_opened`, `student_preview_opened` | quiz copied, "Share with class", "Student preview" | none |
| `signup_submitted`, `signup_succeeded` | signup sent and succeeded | `has_ref`, `already`, `demo_used`; on spec pages `variant` instead of `demo_used` |
| `referral_link_copied`, `referral_shared` | the user's own referral link | `channel` |
| `lang_switched`, `theme_toggled`, `consent_chosen` | language, theme, analytics choice | `from`/`to`, `theme`, `choice` |

Never sent: email, lesson text, quiz text, referral code, and `?ref=` and `#...` from the URL (they are stripped before sending).

**Microsoft Clarity** provides heatmaps and session recordings, only after consent. The email, lesson, quiz, link and "Share" dialog fields are masked.

**The student page (`web/play/`) sends nothing.** It states that answers are not sent anywhere, so `analytics.js` is not included there and the page CSP blocks any requests. The iframe preview is silent too.

## Consent

- Without keys in `config.js`, nothing is loaded.
- With Do Not Track, Global Privacy Control or the browser's data-saver mode on, nothing is loaded, not even PostHog.
- PostHog events are sent immediately (anonymous, no cookies). Clarity and PostHog session recordings load only after "Allow analytics".
- The EN/UA banner sits at the bottom; the choice is stored for 365 days (`localStorage.qp_consent`). To revoke it, use the "Analytics settings" / "Налаштування аналітики" button in the footer.
- The `spec/` pages (all three variants) use PostHog only, with no banner and no Clarity.

## Funnel in PostHog

eu.posthog.com -> Product analytics -> New insight -> **Funnels**:
1. `landing_viewed`
2. `demo_started`
3. `quiz_generated` (filter `ok = true`)
4. `signup_succeeded`

Filter `surface = landing` (or `spec` for the landing variants, see below). Conversion window: 1 hour. Since the id lives for one page load, the funnel counts the path within a single visit.
Demo vs no demo: Breakdown by `demo_used` on `signup_succeeded`, or two funnels: `landing_viewed -> signup_succeeded` with `demo_started` as an exclusion step, and `landing_viewed -> demo_started -> signup_succeeded`.
In the project settings, enable "Discard client IP data".

## Landing variants

The strict-to-spec landing exists in three variants: A "Teacher's worksheet" (`/spec/`), B "Textbook" (`/spec/b/`) and C "Class boards" (`/spec/c/`); `/spec/variants/` shows them side by side. `web/spec/spec.js` reads the variant from `data-variant` on `<body>` and tags it in two places:

| Where | Field | Values |
|---|---|---|
| Google Sheet, `waitlist` tab | `utm_campaign` | `spec-a`, `spec-b`, `spec-c` |
| PostHog events `landing_viewed`, `signup_submitted`, `signup_succeeded` | `variant` | `a`, `b`, `c` |

All three pages also send `surface = spec`, so they never mix with the main landing.

How to compare them:

- **Visit to signup rate per variant (PostHog):** Funnels, steps `landing_viewed -> signup_succeeded`, filter `surface = spec`, Breakdown by `variant`. Each row is one variant with its own conversion.
- **Signups per variant (sheet):** in the `waitlist` tab, filter or count rows by `utm_campaign`. This is the count of real addresses.

The spec pages do not write to the `visits` tab, so the rate per variant exists only in PostHog. The sheet can show more signups than PostHog: visitors with Do Not Track, GPC or data saver on send no events but can still sign up.

## Clarity heatmaps

clarity.microsoft.com -> project Quizpen -> **Heatmaps** -> page `brrr28.github.io/quizpen/`; recordings are under **Recordings**. Data comes only from visitors who pressed "Allow analytics". Masking in the project is set to Balanced.

## Search Console and sitemap

- Ownership is verified by the HTML file `web/googlecc0c4bdfc53fdacd.html` (present on main and gh-pages). **Do not delete it**, or the verification will be lost.
- On the page: canonical, hreflang en / uk / x-default, robots `index,follow`, JSON-LD (WebSite + EducationalApplication, price 0). `?lang=uk` has its own canonical. `spec/`, `spec/b/`, `spec/c/` and `play/` are `noindex,follow`; `spec/variants/` and `case/` are `noindex`.
- Sitemap: `https://brrr28.github.io/quizpen/sitemap.xml` (both language versions). After a release: Search Console -> Sitemaps -> add `sitemap.xml`; URL Inspection -> Request indexing for `/` and `/?lang=uk`.
- robots.txt is neither needed nor possible: a GitHub Pages project site cannot serve `/robots.txt` at the domain root.

## Check

`node web/dev/analytics-check.mjs`: starts its own server and headless Chrome; requests to PostHog and Clarity are intercepted and go nowhere, and the keys are replaced with empty or test ones.
