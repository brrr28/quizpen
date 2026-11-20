// Headless check of the UI polish (themes, sticky header, language switch without layout shift).
// Usage: node web/dev/ui-check.mjs   (stand ports 8080/8787/CDP 9339; exit 1 on any failure)
// Env: QP_CHROME_PROFILE (temp Chrome profile dir), UI_CHECK_OUT (optional JSON with details).
// Checks: Join button boxes identical across EN<->UK, CLS 0 across theme and language switches,
// no flash of the wrong theme on load, AA contrast in dark, student player follows the saved theme,
// no console errors at 375 and 1440. Screenshots go to shots\.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStand, BASE } from './stand.mjs';

const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = resolve(REPO, 'shots');
mkdirSync(SHOTS, { recursive: true });
const SAMPLES = JSON.parse(readFileSync(resolve(REPO, 'web/data/samples.json'), 'utf8')).samples;
const BG = { light: 'rgb(251, 248, 240)', dark: 'rgb(34, 37, 43)' };

const results = [];
const details = {};
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const s = await startStand();
const { page } = s;

// Runs before any page script: layout-shift sum (every entry, input or not) and the theme of the first frames.
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__cls = { sum: 0, n: 0, src: [] };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) {
      __cls.sum += e.value; __cls.n++;
      if (__cls.src.length < 40) __cls.src.push({ v: +e.value.toFixed(5), t: Math.round(e.startTime), nodes: (e.sources || []).map((x) => {
        let n = x.node; if (n && n.nodeType === 3) n = n.parentElement;
        if (!n) return '?';
        return n.nodeName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\\s+/).join('.') : '') + ' ' + JSON.stringify(Math.round(x.previousRect.y)) + '->' + Math.round(x.currentRect.y) + ' h' + Math.round(x.previousRect.height) + '->' + Math.round(x.currentRect.height);
      }) });
    } }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) { /* no layout-shift support */ }
  window.__paint = []; window.__themeLog = [];
  // documentElement does not exist yet when this runs, so watch the document subtree.
  new MutationObserver((rs) => rs.forEach((m) => { if (m.target === document.documentElement) __themeLog.push(m.target.getAttribute('data-theme')); })).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-theme'] });
  (function f(i) { requestAnimationFrame(() => {
    const b = document.body;
    __paint.push({ th: document.documentElement.getAttribute('data-theme'), bg: b ? getComputedStyle(b).backgroundColor : null });
    if (i < 5) f(i + 1);
  }); })(0);
` });

const media = (scheme) => page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
async function load(url, { saved = null, w = 1440, h = 900, mobile = false } = {}) {
  await page.viewport(w, h, mobile, mobile ? 2 : 1);
  await page.goto(BASE);
  await page.eval(`localStorage.clear(); sessionStorage.clear(); ${saved ? `localStorage.setItem('qp_theme', '${saved}');` : ''} true`);
  await page.goto(url);
}
const settle = (ms = 450) => s.wait(ms);
const resetCls = () => page.eval(`__cls.sum = 0; __cls.n = 0; __cls.src = []; true`);
const cls = () => page.eval(`({ sum: +__cls.sum.toFixed(5), n: __cls.n, src: __cls.src })`);
const clickJs = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)}).click(); true`);

// Viewport boxes of the three Join buttons (header, hero form, final band).
const BOXES = `(() => {
  const pick = { header: '.header-cta', hero: '#join-btn', final: 'button[data-scroll-join]:not(.header-cta)' };
  const out = {};
  for (const [k, sel] of Object.entries(pick)) {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    out[k] = r.width ? [r.left, r.top, r.width, r.height].map((n) => Math.round(n * 100) / 100) : null;
  }
  return out;
})()`;
function boxDiff(a, b) {
  let max = 0;
  for (const k of Object.keys(a)) {
    if (!a[k] && !b[k]) continue;
    if (!a[k] || !b[k]) return Infinity;
    a[k].forEach((v, i) => { max = Math.max(max, Math.abs(v - b[k][i])); });
  }
  return Math.round(max * 100) / 100;
}

// WCAG contrast of every visible text against the composited background behind it.
const CONTRAST = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, bot) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bot[i] * (1 - a)).concat(1); };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => {
    const layers = []; let img = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none') img = true;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
    }
    let base = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return { c: base, img };
  };
  const hidden = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || +cs.opacity < 1 || cs.display === 'none') return true; } return false; };
  const name = (el) => el.nodeName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  const seen = new Set(), rows = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    const el = t.parentElement;
    if (!el || seen.has(el) || !t.data.trim() || el.closest('.sr-only, script, style, noscript, [hidden]')) continue;
    seen.add(el);
    if (!el.getClientRects().length || hidden(el)) continue;
    const cs = getComputedStyle(el);
    // The highlighter mark paints the accent as a background image: measure its text against the accent.
    const b = el.closest('.hl') ? { c: rgba(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), img: false } : bgOf(el);
    const fg = over(rgba(cs.color), b.c);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    rows.push({ el: name(el), text: t.data.trim().slice(0, 28), r: Math.round(ratio(fg, b.c) * 100) / 100, need, img: b.img, accent: el.closest('.btn-accent, .hl, .chip[aria-pressed="true"], .feature-icon, .thanks-badge, .final') ? 1 : 0, link: el.closest('a') ? 1 : 0 });
  }
  // Focus ring against what is behind the control (the ring sits outside its box).
  const rings = [];
  for (const sel of ['.header-cta', '#join-btn', '[data-theme-toggle]', '.lang [data-lang="uk"]', 'main a[href]', '.faq summary', 'footer a[href]', 'button[data-scroll-join]:not(.header-cta)', '#gen-btn']) {
    const el = document.querySelector(sel);
    if (!el || !el.getClientRects().length) continue;
    el.focus({ focusVisible: true, preventScroll: true });
    const cs = getComputedStyle(el);
    const ring = rgba(cs.outlineColor), bg = bgOf(el.parentElement).c;
    rings.push({ el: sel, style: cs.outlineStyle, w: cs.outlineWidth, r: Math.round(ratio(over(ring, bg), bg) * 100) / 100 });
    el.blur();
  }
  return { rows, rings };
})()`;

async function themeOnLoad(label, url, opts, expect) {
  await media(opts.system);
  await load(url, opts);
  await settle(200);
  const r = await page.eval(`({ paint: __paint, log: __themeLog, now: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor })`);
  const painted = r.paint.filter((p) => p.bg && p.bg !== 'rgba(0, 0, 0, 0)');
  const wrong = r.paint.some((p) => p.th !== expect) || r.log.some((v) => v !== expect) || painted.some((p) => p.bg !== BG[expect]);
  ok(`${label}: ${expect} from the first frame`, !wrong && r.now === expect && r.bg === BG[expect], `frames ${r.paint.map((p) => p.th + ':' + (p.bg || '-')).join(' | ')}; attr log ${r.log.join(',')}`);
}

async function viewportRun(w, h, mobile) {
  const tag = String(w);
  const err0 = s.errors.length;
  await media('light');
  await load(BASE + '?lang=en', { w, h, mobile });
  await page.waitFor(`document.querySelector('[data-counter].is-ready')`).catch(() => {});
  // Web fonts switch in one step after the load event (index.html, html.wf): measure in the final fonts.
  await page.waitFor(`typeof window.qpFontsCss !== 'function' || document.documentElement.classList.contains('wf')`, 15000);
  await settle(1600);
  const loadCls = await cls();
  ok(`${tag}: CLS on load`, loadCls.sum === 0, `sum ${loadCls.sum}, entries ${loadCls.n}`);
  details[tag + '-load-cls'] = loadCls;

  // Theme + language switches at three scroll positions; the boxes must not move and CLS must stay 0.
  const spots = {
    top: `scrollTo({ top: 0, behavior: 'instant' })`,
    faq: `document.getElementById('faq').scrollIntoView({ block: 'start', behavior: 'instant' })`,
    final: `document.querySelector('button[data-scroll-join]:not(.header-cta)').scrollIntoView({ block: 'center', behavior: 'instant' })`,
  };
  for (const [spot, expr] of Object.entries(spots)) {
    await page.eval(expr + '; true');
    await settle(500);
    await resetCls();
    const seq = [['start', null], ['dark', '[data-theme-toggle]'], ['uk', '.lang [data-lang="uk"]'], ['light', '[data-theme-toggle]'], ['en', '.lang [data-lang="en"]']];
    const boxes = [], scrolls = [];
    for (const [label, sel] of seq) {
      if (sel) { await clickJs(sel); await settle(); }
      boxes.push([label, await page.eval(BOXES)]);
      scrolls.push(await page.eval('Math.round(scrollY)'));
    }
    const diffs = boxes.slice(1).map(([l, b]) => l + ' ' + boxDiff(boxes[0][1], b));
    const max = Math.max(...boxes.slice(1).map(([, b]) => boxDiff(boxes[0][1], b)));
    const c = await cls();
    details[`${tag}-${spot}`] = { boxes, scrolls, cls: c };
    ok(`${tag} @${spot}: Join boxes identical across theme and EN<->UK`, max === 0, `max diff ${max}px (${diffs.join(', ')}); scrollY ${scrolls.join('>')}`);
    ok(`${tag} @${spot}: CLS 0 across theme and language switches`, c.sum === 0, `sum ${c.sum}, entries ${c.n}${c.n ? ' first ' + JSON.stringify(c.src.slice(0, 3)) : ''}`);
  }
  // Leaves html[lang] and the i18n texts as app.js set them (reserve() swaps them while measuring).
  const state = await page.eval(`({ lang: document.documentElement.lang, cta: document.querySelector('#join-btn').textContent.trim().slice(0, 40), h1: document.querySelector('.hero h1').textContent.trim().slice(0, 30) })`);
  ok(`${tag}: language state restored after switches`, state.lang === 'en', JSON.stringify(state));

  // Screenshots of the hero in both themes.
  for (const theme of ['light', 'dark']) {
    await media(theme);
    await load(BASE + '?lang=en', { w, h, mobile });
    await settle(3200); // the hero illustration finishes its answer animation
    await page.shot(resolve(SHOTS, `hero-${theme}-${w}.png`));
  }
  const errs = s.errors.slice(err0);
  ok(`${tag}: no console errors`, errs.length === 0, errs.slice(0, 5).join(' || '));
}

await viewportRun(1440, 900, false);
await viewportRun(375, 812, true);

// No flash of the wrong theme on load, saved choice beats the system setting.
await themeOnLoad('landing, system light', BASE + '?lang=en', { system: 'light' }, 'light');
await themeOnLoad('landing, system dark', BASE + '?lang=en', { system: 'dark' }, 'dark');
await themeOnLoad('landing, saved dark over system light', BASE + '?lang=en', { system: 'light', saved: 'dark' }, 'dark');
await themeOnLoad('landing, saved light over system dark', BASE + '?lang=en', { system: 'dark', saved: 'light' }, 'light');

// Dark contrast audit with a generated and answered demo quiz.
{
  const err0 = s.errors.length;
  await media('light');
  await load(BASE + '?lang=en', { saved: 'dark' });
  // The sample chips come from data/samples.json after load: wait for the one we click. A chip selects a ready
  // example (no API call) and #show-btn opens its quiz, as in demo-check.
  await page.waitFor(`document.querySelector('.chip[data-sample="magi"]')`, 15000);
  await page.click('.chip[data-sample="magi"]');
  await page.click('#show-btn');
  await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 15000);
  await page.click('#quiz-body button.opt');
  await settle(700);
  // Back to the own-text tab (the quiz stays on screen), so #gen-btn is visible for the focus ring audit.
  await page.click('#tab-own');
  await settle(300);
  await page.eval(`document.getElementById('demo').scrollIntoView({ block: 'start', behavior: 'instant' }); true`);
  await settle(500);
  await page.shot(resolve(SHOTS, 'demo-dark-1440.png'));
  for (const l of ['en', 'uk']) {
    if (l === 'uk') { await clickJs('.lang [data-lang="uk"]'); await settle(); }
    const a = await page.eval(CONTRAST);
    const bad = a.rows.filter((r) => r.r < r.need);
    const min = (f) => { const x = a.rows.filter(f); return x.length ? Math.min(...x.map((r) => r.r)) + ` (${x.length})` : '-'; };
    details['contrast-dark-' + l] = { bad, rings: a.rings };
    console.log(`  dark ${l}: min on yellow ${min((r) => r.accent)}, links ${min((r) => r.link)}, body p ${min((r) => /^p/.test(r.el))}, all ${min(() => true)}`);
    ok(`dark ${l}: AA text contrast`, bad.length === 0, bad.slice(0, 6).map((r) => `${r.el} "${r.text}" ${r.r}<${r.need}${r.img ? ' img' : ''}`).join(' | '));
    const badRing = a.rings.filter((r) => r.style === 'none' || r.r < 3);
    ok(`dark ${l}: focus ring >= 3:1`, badRing.length === 0, a.rings.map((r) => `${r.el} ${r.style} ${r.r}`).join(', '));
  }
  const errs = s.errors.slice(err0);
  ok('demo dark: no console errors', errs.length === 0, errs.slice(0, 5).join(' || '));
}

// Student player follows the saved theme (and the system one without a saved choice).
{
  const err0 = s.errors.length;
  await load(BASE + '?lang=en');
  const quiz = SAMPLES.find((x) => x.id === 'magi') || SAMPLES[0];
  const token = await page.eval(`QuizpenCodec.encode(${JSON.stringify(quiz.quiz.en)}, 'en')`);
  const PLAY = BASE + 'play/?lang=en#q=' + token;
  const pbg = async () => page.eval(`({ th: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor })`);
  await themeOnLoad('player, saved dark over system light', PLAY, { system: 'light', saved: 'dark' }, 'dark');
  await themeOnLoad('player, saved light over system dark', PLAY, { system: 'dark', saved: 'light' }, 'light');
  await themeOnLoad('player, system dark', PLAY, { system: 'dark' }, 'dark');
  await media('light');
  await load(PLAY, { saved: 'dark', w: 375, h: 812, mobile: true });
  await settle(900);
  const st = await pbg();
  await page.shot(resolve(SHOTS, 'play-dark-375.png'));
  ok('player 375: dark painted', st.th === 'dark', JSON.stringify(st));
  const errs = s.errors.slice(err0);
  ok('player: no console errors', errs.length === 0, errs.slice(0, 5).join(' || '));
}

await s.stop();
if (process.env.UI_CHECK_OUT) writeFileSync(process.env.UI_CHECK_OUT, JSON.stringify(details, null, 1));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
