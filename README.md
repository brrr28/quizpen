# Quizpen

Quizpen turns a pasted lesson text into a short multiple-choice quiz for teachers. The teacher can run the quiz in the browser, copy it, or share a link with the class; students open it on a phone with no signup, and no student data is collected. The project is a landing page with a working demo and a waitlist, built to test whether teachers want this product.

## Links

- Live site: https://brrr28.github.io/quizpen/
- Strict-to-spec version: https://brrr28.github.io/quizpen/spec/
- Case study (Ukrainian): https://brrr28.github.io/quizpen/case/
- Market and ICP research (Ukrainian, PDF): [research/](research/)

## What is inside

- `web/` is the static site: landing page, demo, student quiz page (`web/play/`), the strict-to-spec variant (`web/spec/`), analytics and a service worker. No build step.
- `backend/` is the Google Apps Script backend (`Code.gs`) behind the waitlist, the quiz generator and visit tracking, plus a local mock (`mock-server.mjs`) and a contract test (`test-contract.mjs`).
- `web/dev/` holds the local dev server and the browser checks.
- [API.md](API.md) describes the backend contract, [ANALYTICS-SEO.md](ANALYTICS-SEO.md) describes events, consent and SEO.

## Stack and why

- Plain HTML, CSS and JavaScript: the page is small, loads fast and needs no build or framework.
- GitHub Pages: free static hosting with a stable URL for the experiment.
- Google Apps Script with a Google Sheet: a free backend and storage the owner can read directly, including a formula-based Insights dashboard.
- Anthropic API, called from the backend: the quiz generator; the key stays in script properties and never reaches the browser.
- PostHog (cookieless) and Microsoft Clarity (after consent): funnel and heatmaps without tracking students.

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

## Deploy the backend

Step-by-step instructions are in [backend/DEPLOY.md](backend/DEPLOY.md). The site itself is published from this repository through GitHub Pages.

## How it was built

The project was built with Claude Code. One orchestrating session wrote the specs and accepted the work. Focused agents made each change, every one in its own git worktree, and automated checks (the ones above) ran on every merge.
