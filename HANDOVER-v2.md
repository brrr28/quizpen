# HANDOVER: landing v2 (branch landing-v2)

Stopped at the context guard (~150k). WIP commit 60e91d3.

## Done (committed)
- web/app.js I18N EN and UK: every COPY-V2 text (meta, hero, form, counter EN "has/have joined", counter.first, hero.try,
  share.text/subject without "in seconds", art.note, demo, features, proof, FAQ incl. UK faq.q3, final.title).
  New keys (43 per language): sheet.label, how.*, vs.* (title, sub, col.qp/bot/quiz, yes/no/partly, r1..r6 and cell
  notes, foot), students.title/sub/1..6, final.sub. samples.json ?v=20261121c.
- web/index.html: meta, OG, Twitter, JSON-LD; all 11 ?v= to 20261121c; sprite symbol #i-tick (hero pen tick path);
  "/ 5"; kicker, h1 (rsv-en/uk updated), hero-sub (rsv updated), form.label, form.note (now with data-rsv-en/uk),
  counter rsv "Be among...", hero.try rsv; `<p class="art-label" data-i18n="sheet.label" data-rsv-en/uk>` as first
  child of .hero-art; new sections #how, #vs, #students inserted between hero and demo; final: `.final-copy`
  wraps h2 + `p.final-sub`; all plain defaults of demo/features/proof/FAQ.
- web/nav.js labels: how "How it works"/"Як це працює", vs "Comparison"/"Порівняння", students "Students"/"Учні",
  why renamed "Research"/"Дослідження". Rail order is DOM order.
- analytics.js consent.css ?v=20261121c; sw.js VERSION '2026-11-21c'.
- Assertions updated: nav-check.mjs line 75 rail ids list (9 ids), line 91 "at ${spots.length} positions".
- shoot.mjs sections mode: ids how, vs, students added.

## Left
1. web/styles.css (NOT touched yet). Exact plan:
   - Lines 249-255: add `.how > .wrap, .vs > .wrap, .students > .wrap` to the sheet padding list, `.how, .vs, .students`
     to `position: relative`, `.how::before, .vs::before, .students::before` to the margin-line list. Line 529: add
     `.how h2, .vs h2, .students h2` to the h2 size rule. Update comment at 269-270.
   - .hero-art (483, 512-521) becomes a card: `padding: 0 24px var(--lh) 44px; border: 1px solid var(--line-strong);
     background-color: var(--surface); background-image: var(--ruling);` From 640px: `padding-left: 68px;` plus a red
     margin line `linear-gradient(to right, transparent 39px, var(--margin) 39px 40.5px, transparent 40.5px), var(--ruling)`.
     `.art-label`: margin `0 -24px 0 -44px` (-68px from 640), padding 0 16px, `font: 700 0.75rem/var(--lh) var(--font)`,
     letter-spacing .08em, uppercase, color ink-3, background surface, `box-shadow: inset 0 -1.5px 0 var(--ink)` (stays
     32px tall; may wrap to 2 lines in UK on phones, data-rsv reserves it). Remove the <1100 edge-to-edge bleed block;
     use `max-width: 36rem` there. Phones: `.art-note { padding-left: 44px; font-size: 1.625rem } .art-arrow { left: 8px }`.
     Keep desktop `grid-row: 4 / span 4` and `margin-top: var(--lh)`.
   - New CSS before `/* Footer */`: .how/.vs/.students `padding: 0 0 72px` (112px from 980). `.how-steps` grid, steps
     stacked with `.feature-num` in col 1 and h3/p in col 2, rule lines between; from 820px 3 columns, column-gap 40px,
     `border-top: 1.5px solid var(--ink)`. `.how-note` serif italic ink-3. `.vs-head` max-width 40rem, `.vs-head p,
     .students-sub` like `.features-head p`. `.vs-scroll { margin-top: 32px; overflow-x: auto; border: 1px solid
     var(--line-strong); background: var(--surface) }`, `.vs-table` `border-collapse: separate; border-spacing: 0;
     min-width: 720px` (600px under 640, row header 132px), cells padding 14px 16px, rule borders, thead small caps,
     `tbody th` serif 600 and sticky `left: 0` with surface background and a right border, `.vs-us` cells with 1.5px ink
     left/right borders. Marks: `.vs-tick` 26x22 color var(--right); `.vs-part` pill (1.25px ink-3 border, 0.75rem
     700 uppercase); `.vs-no` 1.25rem ink-3; `.vs-note` block 0.875rem ink-2; `.vs-foot` 0.875rem ink-3.
     `.students-grid` 2 columns from 820px (`1fr 280px`), `.students-list li` flex with `.students-tick` (pen colour),
     rule lines. `.phone` 260px, 2px ink border, radius 36px, paper bg; `.phone-screen` surface, radius 26px, notch
     ::before; `.phone-prog i` segments (is-on = var(--right)); `.phone-opts li` bordered rows, `.is-right` right-bg /
     right-line, `.phone-tick` right colour; `.phone-why` 3px right left border. `.final-copy { display: grid; gap: 12px;
     max-width: 36rem }`, `.final-sub` serif ink-2.
2. Run `heavy-run.sh -Name "quizpen: v2 shots" -WeightGB 2 -- node web/dev/shoot.mjs shots`, then `... sections`; look at
   hero-1440, hero-375, section-how/vs/students at 1440 and 375 and one dark; fix. After shots, restore
   shots/spec-*.png from HEAD (spec belongs to other agents).
3. Checks one at a time through the wrapper: check, analytics-check, nav-check, demo-check, ui-check, firstpaint-check
   (exit 75 = stand busy: run another, retry once at the end). Logs to the orchestrator scratchpad; delete them after.
4. Final commit message: "Landing v2: clear headline, labelled example, how it works, comparison, students, stronger copy".

## Decisions not to revisit
- Recommended accurate hero.sub (no "in any language"). Straight apostrophes in EN (as the rest of the page).
- Comparison: Quizizz/Kahoot "reason next to each right answer" = "—" (REFERENCES.md marks it "?", solver in Gold+ only).
- Section order: hero, how, vs, students, demo, features, why, faq, final.
- dev/og.html and og.png still show the old headline (not in this brief).

## Tests
None run yet.

## Files
web/app.js, web/index.html, web/nav.js, web/analytics.js, web/sw.js, web/dev/nav-check.mjs, web/dev/shoot.mjs;
next: web/styles.css. Apply script (one-off, can be deleted): orchestrator scratchpad qp-v2-apply.mjs.
