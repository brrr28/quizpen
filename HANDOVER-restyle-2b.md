# HANDOVER restyle-2b (lower sections, panel height)

Stopped at the context guard (~150k). All work is committed on branch restyle.

## Done
- Panel height (web/demo-modes.css): measured with min-height off, every sample EN+UK, first question screen:
  640: 708, 820: 584, 980: 736, 1100: 736, 1280/1440: 716 (375: 922, stays 600 by design). Set 708 from 640, 736 from
  980; comment updated. demo-check 30/30.
- web/index.html: features `ol.feature-list` with `.feature-num` 1-3 (icons and sprite symbols i-file, i-checklist,
  i-printer, i-plus removed); proof wrap `.proof-grid`; FAQ summaries use an inline `.faq-pm` plus/minus SVG
  (`.faq-pm-v` folds away when open); final CTA gets `.final-cut` scissors SVG.
- web/styles.css: lower sections join the sheet geometry (margin line, content after it); h2 of demo/features/proof/
  faq/final in Literata 600; features numbered list with circled numbers and --rule lines; proof as notes (figure in
  Literata with a 2px --pen underline, Literata text, footnotes under a short rule, sup links in ink); FAQ "Q1." via
  CSS counter (alt text empty), Literata Q and A, `--faq-n/--faq-gap` columns; final = dashed cut line + scissors +
  headline + ink button. Yellow accent gone from styles.css (tokens, .hl, .btn-accent, toast icon, confetti) and
  app.js confetti fallback.
- web/dev/shoot.mjs: `sections` mode (features/why/faq/final at 1440 and 375, light and dark; reveals forced, shot
  from scroll 0). 16 shots in shots/section-*.png committed and looked at.

## Left (exact next step)
1. ui-check is 26/32. The 2 sub-pixel ones are old (1440 @faq 0.33px). The 4 at 375 are NOT from this step: switching
   to UK at 375 grows the demo samples list by 48px (two `.chip-topic` rows wrap in UK; probe: chip 32 -> 56px), so
   features/why/faq/final move. Fix in web/app.js renderChips (line ~626): give `.chip-topic` an EN/UK height
   reservation like `[data-rsv-en]`/`[data-rsv-uk]` (styles.css ~1027: both variants overlap at the same width, so
   the box has the taller height), or keep the topic on one line at 375. Then rerun ui-check (expect 30/32).
2. Full suite in the next step (check, play-check, analytics-check, nav-check, firstpaint).
3. Not touched (other pages, out of scope): yellow in web/play/play.css, web/spec/spec.css, web/dev/og.html;
   ui-check.mjs still names `.hl`/`.btn-accent`/`.feature-icon` in its "on yellow" contrast row (harmless).

## Decisions (do not revisit)
- Lower sections on plain paper (no ruling), margin line continues; heading beside content from 980px.
- Features without icons. FAQ markup kept (details/summary); only the icon SVG changed.
- Extra space under some facts/FAQ items at 375 is ui.js language reservation (UK is longer), by design.

## Tests
demo-check 30/30; ui-check 26/32 (see Left 1). Others not run.
