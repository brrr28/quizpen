# HANDOVER restyle-3 (player, spec, share, OG, checks)

Stopped at the context guard (~150k). All work is committed on branch restyle (last: e982905).

## Done (brief items)
1. Demo samples height (web/app.js renderChips, web/demo-modes.css): `.chip-topic` now carries
   data-rsv-en/data-rsv-uk (generic [data-rsv-en] ghosts in styles.css), visible text in `.chip-topic-text`.
   Tagged chips (es/pl): `.has-tag` padding-right 30px + `.chip-tag` margin-right -30px (zero advance), so ghosts
   wrap like the visible text. ui-check: the 4 UK fails at 375 are gone.
2. Player web/play/play.css rewritten (worksheet tokens = landing light/dark, Georgia/Charter serif + system sans,
   margin line on `.screen::before`, ink square buttons, ruled answer lines min-height 64px, circled letters,
   no yellow). play.js: `penMark()` (landing loop/tick/score paths, pathLength 1); right option gets loop in
   `.opt-key` + tick; wrong pick struck out (x icon dropped); final score = `<span>n/m</span>` + red loop SVG
   (textContent unchanged). theme.js COLOR and index.html theme-color = #FBF8F0 / #22252B.
3. web/play/share.css: dialogs paper, 1.5px ink outline, square, no shadow; preview full screen without border on
   phones, ink border from 720px; QR border ink.
4. web/spec: Literata + PT Sans (Google Fonts), spec.css rewritten (margin line, circled Q brand, circled 1-3,
   email as an answer line, ink button, red-pen tick on thanks). No dark theme on spec (it had none).
5. web/dev/og.html rewritten; web/og.png regenerated and looked at (OK). shoot.mjs og waits for web fonts.
6. ui-check.mjs PLAYER_BG = landing paper (comment says why).
7. sw.js VERSION '2026-11-21a'.
- shoot.mjs `shots` now also writes spec-1440.png, spec-375.png, spec-thanks-375.png (not run yet).

## Tests so far
- firstpaint-check 17/17.
- ui-check 30/32. Two residuals, both "Join boxes identical": 1440 @faq 0.38px, 375 @final 0.33px; the same diff
  for dark/uk/light/en against "start". Probe: scrollY integer and unchanged by the toggle, so it is not scroll.
  Likely cause: `.nav-reveal` (web/nav.css:149-154, opacity/transform transition with --nav-reveal-i * 70ms delay)
  still finishing when ui-check measures "start" 500ms after the scroll. Verify by reading nav.css 145-155; if the
  transition + delay exceeds ~500ms that is it (pre-existing class of residual: 1440 @faq was 0.33 before).
- Not run yet: check, nav-check, analytics-check, demo-check, play-check, slow-check.

## Left (exact next steps)
1. Decide the residual above (report it; do not weaken the assertion).
2. Run, one at a time, via `C:\Users\User1\tools\heavy-gate\heavy-run.sh -Name "quizpen: <name>" -WeightGB 2 --
   node web/dev/<name>.mjs` (from the worktree root, Git Bash): check (69), nav-check (43), analytics-check (31),
   demo-check (30), play-check (208), slow-check (25). Fix pages, not assertions.
3. `node web/dev/shoot.mjs shots` via heavy-run; play-check writes play-375-question/final, play-1440,
   share-modal-375; ui-check writes play-dark-375. Look at play-375-question, play-375-final, share-modal-375,
   spec-*, hero-375, demo-early-access-375. Commit shots.
4. Final commit «Worksheet design, step 3: player, spec, share, OG image, checks», deleting HANDOVER-restyle-1.md,
   -2a.md, -2b.md (and this file).

## Decisions (do not revisit)
- Player stars kept (play-check counts `.star.is-on`), now small red-pen stars.
- Feedback = serif italic note, "Correct." in pen red; no coloured boxes.
- favicon.svg still has the old yellow dot: out of scope, report it.

## Files
web/app.js, web/demo-modes.css, web/play/{play.css,play.js,theme.js,index.html,share.css},
web/spec/{index.html,spec.css}, web/dev/{og.html,shoot.mjs,ui-check.mjs}, web/og.png, web/sw.js.
