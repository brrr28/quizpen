# HANDOVER: web (waitlist landing), agent 1 stopped at ~156k context

## Done (committed)
- web/index.html: full markup, all sections (header + lang toggle EN/УКР, hero with form + thank-you block + counter + HTML/CSS quiz-card illustration, dark demo section, features list, proof with 3 sourced facts + counter + sources, FAQ details, yellow final CTA, footer). English default text in HTML; keys in data-i18n / data-i18n-html / data-i18n-attr="attr:key;attr2:key2".
- web/styles.css: complete design system (paper #F6F6F2, ink #161B2E, one accent highlighter #F2E14A, right/wrong colors, Onest + JetBrains Mono). Classes used by JS listed below.
- web/data/samples.json: 3 samples (photosynthesis, printing, magi), text + 5-question quiz in en and uk.
- web/config.js (window.WAITLIST_API = ""), web/favicon.svg.
- Product name: Quizpen (web search: no existing product with that name). Headline EN "Paste a lesson. Get a quiz before the bell." UK "Вставте текст уроку. Отримайте тест ще до дзвінка."

## Left
1. web/app.js (see status at bottom: may be done by agent 1).
2. web/dev/serve.mjs (static server for web/, proxy /api -> http://127.0.0.1:8787, serve /config.js override `window.WAITLIST_API="/api"` when DEV_API=1; windowsHide; refuse TTY without ALLOW_TTY).
3. Mock: use backend/mock-server.mjs if it exists (MOCK_OK=1), else write web/dev/mock-server.mjs implementing the contract.
4. web/dev/og.html -> render web/og.png 1200x630 with headless Chrome (--headless=new --screenshot --window-size=1200,630, spawn windowsHide).
5. web/dev/shoot.mjs: CDP over WebSocket (node 20 needs `node --experimental-websocket`), Chrome at C:/Program Files/Google/Chrome/Application/chrome.exe, --headless=new --remote-debugging-port; 6 PNG to shots/: hero-1440, hero-375, demo-1440, demo-375 (sample chip -> Generate -> click one option), thanks-1440, thanks-375 (submit email). Collect console errors (Runtime.consoleAPICalled error + Runtime.exceptionThrown). Read shots, fix visual issues.
6. Stop servers, delete temp files, commit `git add web shots` only (backend/ belongs to the other agent). Plain commit message, no trailers.

## Decisions (do not revisit)
- Strings in app.js I18N {en, uk}; plural via Intl.PluralRules; ?lang=uk|en overrides; localStorage keys qp_lang, qp_cid, qp_joined, qp_attr (all try/catch).
- Thank-you replaces #join-form inside #join-slot; confetti canvas class .confetti; refresh of stored join at most every 6h via idempotent join call.
- Fallback quiz on disabled/rate_limited/server/timeout/network: sample quiz of active chip, else photosynthesis, note in .quiz-note.
- Sources: TALIS 2018 (ACER summary, ~4.2 h marking), Gallup+WFF 2025 (5.9 h, 2,232 teachers, self-reported), Roediger & Karpicke 2006.

## CSS classes JS must use
.counter.is-ready + .counter-text; .is-busy on buttons (shows .spinner); .thanks.is-new; .copy-btn.is-done; .chip[aria-pressed]; #quiz-empty/#quiz-body; .skel/.skel-steps li.is-now/.is-done/.skel-bar(.q/.opt); .quiz-note; .quiz-top/.quiz-title/.quiz-progress/.quiz-bars i.right/.wrong/.now; .quiz-q; .opts .opt(.is-right/.is-wrong/.is-dim) > .opt-key + span + svg.opt-mark; .feedback.is-right/.is-wrong; .quiz-actions; .score .score-num/.score-label/.score-dots i.right/.score-note; .quiz-error; .demo-meta .is-ok; textarea/input aria-invalid.
