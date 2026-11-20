# HANDOVER restyle-1 (worksheet design, step 1)

Brief: tokens, fonts, header/rail/drawer, hero, thanks, footer, consent bar, meta fix. Reference: research/design-refs/mock-A.html, DIRECTIONS.md section A.

## Done (WIP commit)
- web/app.js: meta.desc EN/UK now "for each correct answer" / "до кожної правильної відповіді"; hero.title EN/UK without the <mark> highlighter; removed art.label, art.source, art.progress (EN+UK); added art.note ('every answer comes<br>with its reason' / 'кожна відповідь<br>має своє пояснення') and sheet.name/class/date/score (Name/Class/Date/Score, Ім’я/Клас/Дата/Бали).
- web/ui.js: '.kicker' removed from MID_SEL (kicker becomes a left-aligned small caps line, centred stacks would misalign it).
- web/index.html head: meta description fixed; theme-color #FBF8F0 / #22252B (metas and the inline script); fonts script loads faces ['400 1em Literata','600 1em Literata','italic 400 1em Literata','400 1em "PT Sans"','700 1em "PT Sans"','600 1em Caveat'] from
  https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=PT+Sans:wght@400;700&display=swap (also in <noscript>).

## Step 1b (items 1-2 below): DONE, commits e3879e2 (markup) + "Worksheet design, step 1b ..." (styles)
- index.html: plain h1, circled Q brand (header + footer), .sheet-holes (first child of .hero), .sheet-fields, graded hero-art (art-q/art-num, art-opts with art-letter, art-loop + art-tick pathLength=1, art-why, art-note with up arrow), tally svg in BOTH counters (hero + .counter-lg), red tick in thanks-badge.
- styles.css: fallbacks, tokens light/dark (dark --shadow-1 override removed, flat everywhere), --serif/--hand/--mono=UI font, --lh/--sheet-line/--sheet-gap/--ruling, margin line on .site-header::before/.hero::before (z-index 1), holes >=640, hero 2 columns >=1100 (1fr + 440px, not 400: at 400 the UK question wrapped and left a blank ruled line), ruled hero >=1100 with 32px rhythm (kicker/label/note/counter/try 32, h1 64, join-row 64 with input bottom on the rule), hero-art full-bleed ruled below 1100, h1 ghosts width 100%, header/lang ring/theme toggle/brand, input as an underlined line (serif), thanks flat/square + pen-draw tick, share/ref square, footer top rule (--rule), kicker/join-label small caps pencil.
- Shots looked at (1440 EN light, 1440 dark, 1440 UK, 375 hero, 375 art, 375 thanks): rules under text lines, margin line continuous header->hero, no 375 overflow (scrollWidth 375).
- Not fixed, for the orchestrator: (a) EN h1 at 1440 breaks "Paste a lesson. Get a / quiz before the bell." (mock: break after "lesson."); a fix needs a <br> or nbsp in hero.title (app.js + index.html) and newline support in the h1 ghosts (ui.js plain() collapses it), so it was left. (b) Reserved heights (UK ghosts) leave blank ruled lines under the EN h1/sub/try-link; by design. (c) Join button stays yellow btn-accent (step 2 decides). (d) Header height kept 64/72px (not the mock's 96). (e) burger background and the right rail dots are nav.css (item "nav.css" below).
- Last two CSS tweaks (art li font 1rem <640 with tick padding only on B; no extra top margin on the art below 1100) were shot but those pictures were not reviewed (context cap): first look of the next agent = hero art at 375.

## Step 1 closed (items 3-5 + main-chat fixes a-c): DONE, final commit "Worksheet design, step 1: nav, consent, ink buttons, headline breaks, checks"
- (a) hero.title EN/UK = two `.h1-line` block spans (app.js + index.html default); h1 ghosts keep the break: ui.js plainLines() joins .h1-line texts with \n, ghosts are white-space: pre-line.
- (b) >=1100: .hero-copy is display: contents; kicker + h1 span both columns (the EN/UK second sentence does not fit the 584px left column at 52-58px), sub/join/counter/try in column 1, .hero-art in column 2 rows 4-7; row-gap 0, kicker margin-top 64.
- (c) #join-btn is btn-ink (header-cta, copy-btn already ink; dark inverts via tokens); try-link underline --pen; global focus ring 2px solid --focus (ink), offset 3, square.
- nav.css: rail = opaque paper strip, 1px line-strong edge, no blur/shadow, ink ring dots (current filled), square label with 1px ink border; drawer flat, --rule borders, current link label underlined; burger/close transparent and square.
- consent.css: square, flat, 1.5px ink edge, ink focus outline, primary hover uses --ink-hover (was --night-2, unreadable in dark).
- CLS fixes: Literata 400 fallback 108.2% (sweep over sub widths; 107.4% gained a line at 375 on the swap); Cyrillic-only PT Sans fallbacks (400 93%, 700 86.9%); fixed em widths for the sheet labels.
- ui-check: BG = worksheet paper; PLAYER_BG keeps the old player colours (web/play not restyled).
- Checks: firstpaint 17/17, ui 30/32 (2 sub-pixel "Join boxes identical" 0.11-0.14px, were 3 before), check 69/69, nav 43/43, analytics 31/31, demo 30/30, play 208/208, slow 25/25.
- Left for step 2: demo band and lower sections still use --accent yellow (gen/show buttons, ea-btn in app.js, chips, demo focus rings, .final band, toast icon, feature icons); player (web/play) old palette; blank ruled lines from reserved UK heights (by design).

## Left (in this order, historical)
1. DONE (see above). index.html body:
   - h1 span: drop `<mark class="hl">quiz</mark>` (plain text, same as dictionary).
   - brand (header + footer): replace svg.brand-mark with `<span class="brand-mark" aria-hidden="true">Q</span>` (circled Q, 30px, 1.5px ink ring, PT Sans 700 14px; name in Literata 600 ~23px).
   - add first child of `.wrap.hero-grid`: `<div class="sheet-fields" aria-hidden="true">` with spans `data-i18n="sheet.name" data-rsv="Name&#10;Ім’я"` (etc.) and `<i>` blanks; Score + "/ 10" hidden below 640.
   - replace `.hero-art` content (keep `.hero-art` + aria-hidden, ui.js stacks `.hero-art [data-i18n]`): `p.art-q` (span.art-num "1." + span data-i18n="art.q"), `ul.art-opts` 4 li with `span.art-letter` A-D + span data-i18n art.a-d; li.is-right B gets red loop svg (path from mock, pathLength="1") inside the letter and a red tick svg (absolute at li right end); `p.art-why` span data-i18n="art.explain" (Literata italic, pencil); `p.art-note` span data-i18n-html="art.note" (Caveat 600 ~30px/32px, red pen) with a small red arrow svg pointing up to the reason.
   - counter: replace `<svg class="icon"><use href="#i-users"/></svg>` with the tally svg from the mock (class counter-tally, stroke currentColor).
   - thanks-badge: replace the i-check icon with an inline hand-drawn red tick (mock tick path), no background.
2. DONE except nav.css and consent.css parts of the last bullet (they move to the next agent with items 3-5). web/styles.css:
   - @font-face fallbacks (replace Onest/JetBrains ones). Measured in headless Chrome against EN+UK hero texts (ratio web/local; vertical metrics from canvas fontBoundingBox):
     - "Literata Fallback" 400: local Georgia, size-adjust 107.4%, ascent 109.9%, descent 28.9%, line-gap 0%
     - "Literata Fallback" 600: local "Georgia Bold", size-adjust 95.6%, ascent 123.4%, descent 32.4%
     - "Literata Fallback" 400 italic: local "Georgia Italic", size-adjust 98.1%, ascent 120.3%, descent 31.6%
     - "PT Sans Fallback" 400: local Arial, size-adjust 94.9%, ascent 107.5%, descent 29.5%
     - "PT Sans Fallback" 700: local "Arial Bold", size-adjust 88.6%, ascent 115.1%, descent 31.6%
     - "Caveat Fallback" 600: local "Comic Sans MS", size-adjust 73.2%, ascent 131.1%, descent 41.0%
     (raw: Literata 1.18/0.31 em, PT Sans 1.02/0.28, Caveat 0.96/0.30; opsz changes the 600 ratio only 0.95 -> 0.94 from 36 to 58px)
   - tokens: --font (PT Sans, UI, body default), --serif (Literata: headings h1-h3, hero sub, art), --hand (Caveat), --mono = UI font (JetBrains dropped). html.wf switch as before.
   - light: --paper #FBF8F0, --surface #FFFDF8, --surface-raised #FFFFFF, --ink #1F2A44, --ink-2 #3B4256, --ink-3 #5E6470 (pencil), --line #E4DDCC, --line-strong #CCC3AE, --line-hover #A0978A, --tint #F2EDE0, --tint-2 #EEE8DA, --right #1D6B3A, --pen #C8312B, --rule #C9D9EC, --margin #E58A8A, --hole #EBE5D6, --shadow-1 none.
   - dark: --paper #22252B, --surface #2A2D34, --surface-raised #32363E, --ink #ECE6D8, --ink-2 #CFC9BB, --ink-3 #A9A79F, --line #3A3E47, --line-strong #4A4F5A, --line-hover #6A707C, --tint #2E3138, --tint-2 #363A42, --right #6FD39A, --pen #FF7B6E, --rule #2E3A4D, --margin #7A3B3B, --hole #1A1C21, --night #1A1C21.
   - keep --accent yellow and the .final band for step 2 (contrast stays as before); .btn radius 0.
   - sheet geometry: margin line x: <640 28px, 640-1099 48px, >=1100 max(72px, calc((100% - 1200px)/2 + 8px)); text gap after line 16/32/56px; header + hero .wrap padding-left = line-x + gap - max(0px, (100% - 1200px)/2). Margin line = ::before on .site-header and .hero (continuous). Holes (`.sheet-holes`, 3 flat circles, --hole) >=640 only.
   - ruling (rules at 25-26px of every 32px band, repeating-linear-gradient with hard stops) on .hero at >=1100 (two columns: minmax(0,1fr) and ~400px, align-items start, all line-heights/margins multiples of 32: h1 64px lh); below 1100 one column, only .hero-art is ruled (full-bleed into the margins, as the mock phone view).
   - h1 ghosts: keep `.hero h1[data-rsv-en]::before/::after` font-size var(--h1-en)/var(--h1-uk), drop the ch widths (use width 100%), letter-spacing equal to the h1.
   - header/nav/lang (pressed = thin ink ring, "circled"), theme toggle transparent, header-cta ink square; nav.css rail (no blur/shadow, ink ring dots, square label with 1px ink border) and drawer (no shadow, rule-colour borders, current link underlined); thanks flat (1.5px ink border, square), footer top rule, consent.css square/flat with --focus outline instead of yellow.
3. web/dev/ui-check.mjs BG constants assert the old page colours: change to light 'rgb(251, 248, 240)', dark 'rgb(34, 37, 43)' (old visuals, explain in the commit).
4. Checks one at a time. Node here is v20: run with `$env:NODE_OPTIONS='--experimental-websocket'` (stand.mjs needs global WebSocket), via `powershell -NoProfile -File C:\Users\User1\tools\heavy-gate\heavy-run.ps1 -Name "quizpen: <name>" -WeightGB 2 -- node web/dev/<name>.mjs`, logs to the scratchpad. Baselines: firstpaint 17, ui 29/32 (3 sub-pixel), check 69, nav 43, analytics 31.
5. `node web/dev/shoot.mjs shots`, look at hero-1440, hero-375, thanks-375 and a dark hero; `git checkout -- shots/` for the rest. Final commit "Worksheet design, step 1: tokens, fonts, header, hero, thanks, footer".

## Decisions not to revisit
- Kicker stays as a plain small caps line (PT Sans 700, letter-spaced, pencil colour).
- Hero art = one graded question + reason + Caveat note; no answer-key tear line in the hero (that is the demo, step 2).
- Fallback ratios above are measured; do not re-measure unless the weights change.

## Tests
None run yet on the restyle. The measuring script (stand.mjs + injected Google Fonts link, DOM widths of EN+UK hero texts vs local faces) was deleted after use; the numbers above are its output. Stand ports 8080/8787/9339 are free.

## Files
web/index.html, web/app.js, web/ui.js, web/styles.css, web/nav.css, web/consent.css, web/dev/ui-check.mjs.
