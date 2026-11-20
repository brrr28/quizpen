# HANDOVER firstpaint (branch firstpaint)

## Done (commits)
- b185d0d item 1: Google Fonts stylesheet non-blocking (media=print + onload, noscript), preconnects moved up after
  the theme script; "Onest Fallback" (Arial / Arial Bold, per weight 400-800) and "JetBrains Mono Fallback" (Courier New)
  @font-face with size-adjust / ascent / descent / line-gap overrides. Numbers measured in Chrome (canvas, EN+UK corpus):
  Onest ascent 97%, descent 31%, gap 0; width ratio vs Arial 400 1.053/1.038, 500 1.064/1.052, 600 (vs bold) 0.999/0.990,
  700 1.009/1.002, 800 1.019/1.015 (EN/UK); mono ratio 1.0, ascent 102%, descent 30%.
- 82dcb44 item 2: loading bar `html.js:not(.is-ready)::before` in styles.css (fixed, 3px, var(--ink), fades in after
  500 ms, sliding segment, 40 iterations cap; reduced motion = static full bar var(--ink-3)); app.js adds html.is-ready
  at the end of init.
- 6822eb3 WIP item 3 + check:
  - h1 #hero-title now holds data-rsv-key/en/uk ghosts, text moved into inner `<span data-i18n-html="hero.title">`;
    ghost pseudos use their own language size and measure (--h1-en / --h1-uk on .hero, 15ch / 17ch, min(..., 100cqw)).
  - nav links data-rsv (ghost on ::before because nav.css uses a::after); footer privacy data-rsv with pre-line ghost.
  - ui.js syncReservedBlocks: plain text when the key lives in an inner [data-i18n-html]; also syncs non-stack
    [data-rsv][data-i18n] (footer note).
  - NEW, not yet run: one-step font switch. index.html head script defines window.qpFontsCss (called from the fonts
    link onload): loads all weights for 'a' + 'я', then adds html.wf. styles.css: --font/--mono default to the
    fallbacks (--font-fb / --mono-fb); `html.wf, html:not(.js)` switch to Onest / JetBrains Mono.
  - web/dev/firstpaint-check.mjs (17 checks, SUMMARY line).

## Measurements so far (Slow 3G 400 kbps / 400 ms RTT, CPU 4x, 375)
- Before (HEAD before b185d0d): EN FCP 3392 ms, ready (QP_I18N) 11562 ms, CLS 0.00002; UK FCP 3400, ready 11652,
  CLS 0.00056 (try-link svg + h1). Check 5/17 (no bar, blocking fonts css).
- After items 1-3 but BEFORE the one-step font switch: EN FCP 3504, ready 11969, CLS 0.034; UK FCP 3508, ready 12035,
  CLS 0.034. Cause: fonts arriving by subset (Cyrillic and Latin files at different times) made the UK headline ghost
  4 lines at t~8.6 s and 3 lines again at t~11 s (h1 +26 px then back). The one-step switch is the fix under test.
  Remaining UK entry 0.00021: "svg 341,686 -> 341,766" at the app.js language switch (try-link arrow); not yet fixed.

## Left / exact next step
1. Run `node --experimental-websocket web/dev/firstpaint-check.mjs` (Node 20 here needs the flag) through
   `C:\Users\User1\tools\heavy-gate\heavy-run.ps1 -Name "quizpen: firstpaint-check" -WeightGB 2 -- ...`, log to the
   scratchpad, read only FAIL/METRIC/SUMMARY. Expect CLS to drop; if the swap itself still moves a block, tune that
   weight's size-adjust.
2. Try-link arrow (UK load and ui-check 375/1440 @top "svg" entries): still to diagnose; it is an 18x18 svg
   (try-link arrow or .art-tick in the hero card).
3. Item 4: web/play/play.js register ../sw.js with scope ../ under the app.js guard (https or 127.0.0.1, ?nosw=1
   unregisters). CSP in play/index.html (script-src 'self', no worker-src) already allows a same-origin worker.
4. Item 6: VERSION in web/sw.js = '2026-11-20b'.
5. Run each once (one at a time): ui-check, check, analytics-check, nav-check, demo-check, play-check, slow-check
   (add --experimental-websocket). Baseline ui-check here: 6 FAIL before a crash at line 206
   (`.chip[data-sample="magi"]` clicked before chips render: add a waitFor for the chip, not weakening anything).
   Then `git checkout -- shots/`, delete own scratch logs: fp-ui-base.log, fp-fp-base.log, fp-fp-1.log, fp-calib.log,
   fp-calib.mjs.

## Decisions not to revisit
- Bar is html::before (no extra DOM); ready marker html.is-ready set by app.js only.
- Headline ghost per language with its own size; text in an inner span so <mark> stays inline.
- Fonts switch in one step via html.wf (partial subset swaps are what moved the headline).
