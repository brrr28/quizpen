# Quizpen

Quizpen turns a pasted lesson text into a short multiple-choice quiz for teachers. The teacher can run the quiz in the browser, copy it, or share a link with the class; students open it on a phone with no signup, and no student data is collected. The project is a landing page with a working demo and a waitlist, built to test whether teachers want this product.

## What to look at

1. **Delivery 1: the landing strictly to the brief**, built in 1.5 hours, in three design and copy variants:
   - A "Teacher's worksheet": https://brrr28.github.io/quizpen/spec/
   - B "Textbook": https://brrr28.github.io/quizpen/spec/b/
   - C "Class boards": https://brrr28.github.io/quizpen/spec/c/
   - all three side by side: https://brrr28.github.io/quizpen/spec/variants/
2. **Delivery 2: the product**, about 6 more hours: https://brrr28.github.io/quizpen/
   - English and Ukrainian interface;
   - a demo with ready examples in 4 languages, and "Your text" offered as early access;
   - the student player `/play/`, opened by link or QR code;
   - works offline after the first visit;
   - analytics in the Google Sheet Insights tab, PostHog (cookieless) and Microsoft Clarity (after consent).
3. **Case study** (Ukrainian): https://brrr28.github.io/quizpen/case/
4. **Market and ICP research** (Ukrainian, PDF): [web/case/quizpen-research-2026-11-20.pdf](web/case/quizpen-research-2026-11-20.pdf), a text version is in [research/](research/).
5. **The Google Sheet** behind the waitlist. It is private, so it is not linked; screenshots are in [shots/sheet-waitlist.png](shots/sheet-waitlist.png) and [shots/sheet-insights.png](shots/sheet-insights.png). Tabs:
   - `waitlist`: email, language, utm tags (the landing variants write `spec-a`, `spec-b` or `spec-c` into `utm_campaign`), referral code and who referred;
   - `visits`: visits of the main page with language and utm tags, no email;
   - `demo_runs`: demo runs, sample or own text, text length, success and time; the text itself is not stored;
   - `Insights`: formulas only, updated with every new row: funnel, samples vs own text, languages, the last 14 days with a chart, top referral codes.

## What is inside

- `web/` is the static site: landing page, demo, student quiz page (`web/play/`), the three strict-to-spec variants (`web/spec/`), the case study (`web/case/`), analytics and a service worker. No build step.
- `backend/` is the Google Apps Script backend (`Code.gs`) behind the waitlist, the quiz generator and visit tracking, plus a local mock (`mock-server.mjs`) and a contract test (`test-contract.mjs`).
- `web/dev/` holds the local dev server and the browser checks.
- [API.md](API.md) describes the backend contract, [ANALYTICS-SEO.md](ANALYTICS-SEO.md) describes events, consent and SEO.

## Stack and why

- Plain HTML, CSS and JavaScript: the page is small, loads fast and needs no build or framework.
- GitHub Pages: free static hosting with a stable URL for the experiment.
- Google Apps Script with a Google Sheet: a free backend and storage the owner can read directly, including a formula-based Insights dashboard.
- Anthropic API, called from the backend: the quiz generator; the key stays in script properties and never reaches the browser.
- PostHog (cookieless) and Microsoft Clarity (after consent): funnel and heatmaps without tracking students.

## Landing variants and how to compare them

The three variants meet the same brief and differ in design and copy. Variant A is `web/spec/index.html`, B and C are `web/spec/b/` and `web/spec/c/`; they share `web/spec/spec.js`, which reads the variant from `data-variant` on `<body>`. A strip at the top of each variant switches between them and links to the side-by-side page.

Tagging, done by `spec.js`:

- every signup is stored in the `waitlist` tab with `utm_campaign` = `spec-a`, `spec-b` or `spec-c`;
- the events `landing_viewed`, `signup_submitted` and `signup_succeeded` carry `variant` = `a`, `b` or `c` (and `surface` = `spec`).

To compare:

- **Visit to signup rate per variant:** in PostHog, a funnel `landing_viewed -> signup_succeeded` filtered by `surface = spec` and broken down by `variant`.
- **Signups per variant:** in the `waitlist` tab, filter or count by `utm_campaign`.

The spec pages do not write to the `visits` tab, so the rate per variant comes from PostHog only. Details are in [ANALYTICS-SEO.md](ANALYTICS-SEO.md#landing-variants).

## Run locally

Requires Node 22. No packages to install.

```
MOCK_OK=1 node backend/mock-server.mjs                # mock backend on 127.0.0.1:8787
SERVE_OK=1 DEV_API=1 node web/dev/serve.mjs           # site on http://127.0.0.1:8080
```

`DEV_API=1` points the site at the mock through `/api`. The `*_OK` variables only allow the servers to start in an interactive console.

## Checks

```
node backend/test-contract.mjs                 # backend contract against the mock
node backend/test-contract.mjs --target=gas    # same contract against Code.gs in a Node sandbox
node web/dev/check.mjs                         # also: ui-check, demo-check, nav-check, play-check, analytics-check, slow-check, firstpaint-check
```

The browser checks start their own servers and a headless Chrome, so Chrome must be installed. Each prints one line per check and exits with 1 on any failure. Run them one at a time, because they use fixed ports.

Current state: 8 browser suites, 456 of 458 checks pass. The backend contract has 270 checks.

| Suite | Checks | Passing |
|---|---|---|
| `check` | 69 | 69 |
| `analytics-check` | 31 | 31 |
| `nav-check` | 46 | 46 |
| `demo-check` | 30 | 30 |
| `play-check` | 208 | 208 |
| `slow-check` | 25 | 25 |
| `firstpaint-check` | 17 | 17 |
| `ui-check` | 32 | 30 |

The two `ui-check` failures are sub-pixel differences of 0.33 px.

## Release procedure

The service worker caches CSS, JS and data under versioned URLs (`?v=<mark>`). If the marks are not bumped, a returning visitor can get a new page with old cached files. For every release that changes `web/`:

1. Bump `VERSION` in `web/sw.js` (for example `2026-11-21e`). The mark is the same value without dashes (`20261121e`).
2. Set the new `?v=` mark everywhere it appears:
   - every HTML page: `web/index.html`, `web/spec/index.html`, `web/spec/b/index.html`, `web/spec/c/index.html`, `web/play/index.html`, `web/case/index.html`;
   - `web/analytics.js` (the `consent.css` link);
   - `web/app.js` (the `data/samples.json` request).
3. Run the checks above.
4. Deploy the `web/` folder to the `gh-pages` branch, which GitHub Pages serves:

```
git subtree split --prefix web -b release-split
git push origin release-split:gh-pages
git branch -D release-split
```

The split extends the previous one, so the push is a fast-forward. If it is rejected, `gh-pages` has commits that did not come from `main`; look at them before forcing anything.

## Deploy the backend

Step-by-step instructions are in [backend/DEPLOY.md](backend/DEPLOY.md).

## How it was built

The project was built with Claude Code. One orchestrating session wrote the specs and accepted the work. Focused agents made each change, every one in its own git worktree, and automated checks (the ones above) ran on every merge.
