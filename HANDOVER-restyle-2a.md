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
- Second agent (commits 9feb9ba, 81a8881, e62ffbe and the handover commit):
  - web/app.js: renderChips = TOC rows (`.chip-subj` with en/uk data-rsv ghost, sr-only ": ", `.chip-topic` with the
    `.chip-tag` inside it); noteHtml without icon; renderQuiz = `.quiz-sheet` Name line + `.quiz-top`, `.quiz-item`
    (numbered `.quiz-q`, `.opt-key` + pen loop, `.opt-text`, pen tick, `.feedback` with "<strong>..</strong> explain"),
    quiz-actions, keyHtml (`.quiz-key.quiz-bars`, scissors, label, `<i>` per question "1&nbsp;C" / blank), note last;
    score = `.score-mark` (score-loop svg + `.score-num`), no dots, key strip after it; ea-btn, data-join, show/gen
    buttons btn-ink; busy view without the info icon; ea-done uses a pen tick (`.ea-tick`). Helpers penSvg/penTick,
    PEN_LOOP, SCORE_LOOP, SCISSORS next to icon().
  - web/demo-modes.css rewritten: underlined text tabs (bold ghost keeps widths), TOC list on a subgrid
    (`.chip-subj` line-height 16px so baseline alignment keeps rows at 32px; `.chip-tag` negative block margins so
    the circle does not grow the 24px line), italic langnote, ruled-paper sample text, small-print note, dashed
    `.ea` / `.demo-busy` slips. Join overflow at 1440 fixed (measured: button right 1199 < slip 1232 < panel 1265).
    Below 520px the input keeps its own height (the 200px basis applies only in the row layout).
  - web/play/share.css: tools = thin line, small-caps label, underlined text buttons (classes btn-ink/btn-ghost kept).
  - web/index.html: #show-btn, #gen-btn -> btn-ink.
  - Shots looked at: demo-samples-1440/375, demo-early-access-375, demo-samples-375-dark, plus scratch shots
    (TOC 375 uk light/dark, early access 1440, score 375 with tools). Demo shots committed, others reverted.
  - demo-check: 29/30. The one failure: "1440: no layout shift when the quiz appears" (all 0.0202, source
    features): the new question screen is taller than the 622px min-height, so the demo grid grows. Fixed by item 1.

## Left (exact next steps)
1. Re-measure the panel min-height (demo-modes.css: 600 / 622 from 640): with min-height off, measure the tallest
   unanswered first-question screen of every sample, en and uk, at 375, 640, 980, 1100, 1280, 1440 (a scratch script that
   imports web/dev/stand.mjs like demo-check.mjs), then set the values (more breakpoints if needed); keep the ratchet in
   app.js. Then demo-check must be 30/30.
2. Run through heavy-run.sh one at a time: demo-check (30), check (69), play-check (208), analytics-check (31),
   ui-check (30/32, 2 sub-pixel). Contrast rows in ui-check may change (tabs ink-3 text, chip-subj ink-3 0.75rem).
3. Retake shots after item 1 (`node web/dev/shoot.mjs shots`), keep the demo shots, `git checkout --` the others.
4. Final commit "Worksheet design, step 2a: the demo as a printed quiz sheet".

## Decisions (do not revisit)
- Two-column demo kept (input left, panel right), 5fr/7fr from 980px.
- Margin note from 1280px inside the panel (`.quiz-item` grid, 160px column); below it the inline pencil italic note.
- The answer key strip doubles as the progress (`.quiz-bars` class kept for the checks).
- Red pen on all marks (`--pen`); key label and right entries in `--right` green as in mock-A.

- Answer key entries follow mock-A ("1 C"), not "1-C".

## Tests
demo-check 29/30 (see above). check, play-check, analytics-check, ui-check not run yet.
