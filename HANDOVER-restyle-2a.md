# HANDOVER restyle-2a (demo block as a printed quiz sheet)

Stopped early: the context guard reported ~158k (brief cap 160k, handover at ~135k).

## Done (WIP commit)
- web/styles.css: the whole "/* Demo */ ... .quiz-error" block (before "/* Toast (Copy quiz) */") is rewritten:
  no navy band; `.demo > .wrap` and `.demo::before` joined the sheet geometry (margin line continues);
  ruling from 1100px with 32px rhythm (h2 line-height 64, sub 32, tabs 32, grid margin 32);
  title/sub in Literata; captions `.demo-label` small caps; textarea = ruled slip (`background-attachment: local`);
  grid 5fr/7fr from 980px; `.gen-btn --btn-h 48`; panel = flat square sheet (1px line-strong border, surface);
  new classes already styled: `.quiz-sheet` (Name ____ line), `.quiz-top/.quiz-title/.quiz-progress` (small caps),
  `.quiz-item`, `.quiz-q` + `.quiz-num`, `.opt` + `.opt-key` (circled letter) + `.opt-text`, `.opt-loop` / `.opt-tick`
  (pen SVG, pen-draw, reduced-motion aware), `.opt.is-wrong .opt-text` line-through pen, `.opt.is-dim`,
  `.feedback` (pencil italic inline; from 1280px a Caveat red margin note in a 160px column of `.quiz-item`),
  `.quiz-key` (dashed tear line, `.quiz-key-cut` scissors, `.quiz-key-label`, `i.now/right/wrong`, `.key-blank`),
  `.score-mark` / `.score-num` (Caveat, pen) / `.score-loop`. Old dark overrides for the panel/textarea removed.
- Not yet touched: web/demo-modes.css, web/app.js, web/index.html, web/play/share.css. Checks not run.

## Left (exact next steps)
1. web/demo-modes.css (rewrite): tabs = underlined text tabs: `.demo-tabs {display:flex; gap:28px; height:32px; margin-top:32px}`,
   `.demo-tab {height:32px; line-height:32px; padding:0; border:0; background:none; color:var(--ink-3); font-weight:400}`,
   `.demo-tab > span {text-decoration: underline; thickness 1px; color var(--line-strong); offset 4px}`,
   selected: ink colour + 700 + 2px ink underline; keep width stable with `.demo-tab [data-rsv]::after {font-weight:700}`
   (CLS 0 on tab switch). `.demo-tabs + .demo-grid {margin-top:32px}`. Keep the panes rules as they are.
   Samples TOC: `.chips {display:grid; grid-template-columns:max-content minmax(0,1fr); column-gap:16px}`,
   `.chip {grid-column:1/-1; display:grid; grid-template-columns: 9.5rem minmax(0,1fr); grid-template-columns: subgrid;
   align-items:baseline; min-height:32px; padding:4px 0; line-height:24px; text-align:left; border:0; background:none}`
   (from 1100px padding 0, line-height 32px); `.chip-subj` small caps ink-3 with `align-items:flex-start`;
   `.chip-topic` serif 1.0625rem ink-2; pressed = ink + 2px pen underline (no weight change);
   `.chip-tag` = 22px circle, 1.25px border, 9.5px bold. `.demo-langnote` italic serif pencil, line-height 32.
   `.sample-text`: flex 1 1 224px, min-height 224, surface, 1px line-strong border, serif 1rem/1.6, padding 12px 18px.
   `.quiz-body > .quiz-note {margin:18px 0 0}` + `.quiz-note` small print (0.84rem, ink-3, no background, no icon).
   Early access `.ea`: `grid-template-columns:minmax(0,1fr)` (fixes the 1440 Join overflow, min-content of the input),
   dashed 1.5px ink-3 border slip, `.ea .join-row {height:auto; padding-top:0}` and from 520px `flex-wrap:wrap`,
   input `flex:1 1 200px`, `.ea .join-btn {--btn-h:48px}`; `.ea-title` serif 600 1.25rem; `.ea-done` no background,
   pen icon. `.demo-busy` same dashed slip.
2. web/index.html: `#show-btn` and `#gen-btn` class `btn-accent` -> `btn-ink`.
3. web/app.js:
   - renderChips: split `label[lang]` at the first ": " -> `<span class="chip-subj" data-rsv="subjEn\nsubjUk">`,
     `<span class="sr-only">: </span>`, `<span class="chip-topic">Topic (first letter upper)` + existing `.chip-tag`.
     check.mjs needs exactly 2 `.chip-tag`.
   - noteHtml: drop the `i-info` icon.
   - renderQuiz: head = `<p class="quiz-sheet" aria-hidden="true"><span>t('sheet.name')</span><i></i></p>` +
     `.quiz-top` (title, progress). Question: `<div class="quiz-item"><p class="quiz-q" tabindex="-1"><span class="quiz-num"
     aria-hidden="true">n.</span>q</p><ul class="opts">…</ul>` + feedback (`<strong>…</strong> ` + explain, keep
     role="status" and is-right/is-wrong) `</div>` + quiz-actions (data-next) + keyHtml + note (note MUST stay the last
     child of #quiz-body). Options: `<span class="opt-key">A + LOOP svg if right</span><span class="opt-text">…</span>` +
     TICK svg if right; wrong pick `is-wrong`; others `is-dim`. Drop `.opt-mark` icons.
     LOOP/TICK: the hero paths (index.html .art-loop / .art-tick) with pathLength="1", aria-hidden, focusable=false.
   - keyHtml: `<div class="quiz-key quiz-bars" aria-hidden="true">` + scissors svg (mock-A.html line 262) +
     `<span class="quiz-key-label">t('quiz.keyTitle')</span>` + one `<i class="now|right|wrong">k-LETTER</i>` per question
     (unanswered `k-<span class="key-blank"></span>`). check.mjs counts `.quiz-bars i` to know the question count.
   - Score: `head + renderScore() + keyHtml + note`; `.score-num` text must stay `^\d+/\d+$`; wrap it in
     `<div class="score-mark">` with a `.score-loop` svg viewBox 0 0 168 108 (hand ellipse, pathLength 1); drop score-dots;
     `data-join` btn-accent -> btn-ink.
   - renderEarly: `#ea-btn` btn-accent -> btn-ink.
4. web/play/share.css: `.play-tools` thin line-top, small-caps label; `.play-tools-row .btn` text buttons (transparent,
   ink, underline 1.5px line-strong, offset 5px, padding 0, --btn-h 40px, flex none); hover selector must be
   `.play-tools-row .btn:hover:not(:disabled)` to beat `.btn-ink:hover:not(:disabled)`. Keep classes btn-ink/btn-ghost
   (play-check clicks them).
5. Re-measure the panel min-height (demo-modes.css: 600 / 622 from 640): with min-height off, measure the tallest
   unanswered first-question screen of every sample, en and uk, at 375, 640, 980, 1100, 1280, 1440 (a scratch script that
   imports web/dev/stand.mjs like demo-check.mjs), then set the values; keep the ratchet in app.js.
6. Run through heavy-run.sh one at a time: demo-check (30), check (69), play-check (208), analytics-check (31),
   ui-check (30/32, 2 sub-pixel). Then `node web/dev/shoot.mjs shots`, look at demo-samples-1440/375, demo-early-access-375,
   demo-samples-375-dark (+ a score shot from a scratch script), keep demo shots, `git checkout --` the others.
7. Final commit "Worksheet design, step 2a: the demo as a printed quiz sheet".

## Decisions (do not revisit)
- Two-column demo kept (input left, panel right), 5fr/7fr from 980px.
- Margin note from 1280px inside the panel (`.quiz-item` grid, 160px column); below it the inline pencil italic note.
- The answer key strip doubles as the progress (`.quiz-bars` class kept for the checks).
- Red pen on all marks (`--pen`); key label and right entries in `--right` green as in mock-A.

## Tests
None run yet.
