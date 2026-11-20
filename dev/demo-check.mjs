// Headless check of the two demo modes (#demo) on the dev stand: tabs by keyboard, ready
// examples without an API call, early access for "Your text" (mock started with
// MOCK_QUIZ_DISABLED=1), layout shift, horizontal overflow at 375 and console errors.
// Usage: node web/dev/demo-check.mjs   (one line per check, then "SUMMARY n/m passed"; exit 1 on any failure)

import { readFileSync } from 'node:fs';
import { startStand, BASE } from './stand.mjs';

const SAMPLES = Object.fromEntries(JSON.parse(readFileSync(new URL('../data/samples.json', import.meta.url), 'utf8')).samples.map((x) => [x.id, x]));
const OWN_TEXT = 'The Dnipro is one of the longest rivers in Europe. It starts in the Valdai Hills and flows south ' +
  'through Ukraine into the Black Sea. Its basin feeds farms, towns and power plants, and the river has carried ' +
  'boats, grain and timber for more than a thousand years.';
const FAST_MS = 700;

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
// The stand has fixed ports and one Chrome profile: a run started next to another one would share
// its server, mock and browser tab, so the results would mean nothing.
if (await fetch(BASE).then(() => true, () => false)) {
  console.error('stand busy: ' + BASE + ' already answers (another check or shoot is running); try again when it ends');
  process.exit(75);
}
const s = await startStand({ mockEnv: { MOCK_QUIZ_DISABLED: '1' } });
const { page } = s;

// Every API request that asks for a quiz (POST body or query string).
const quizReqs = [];
page.on('Network.requestWillBeSent', (p) => {
  if (!p.request.url.includes('/api')) return;
  let body = {};
  try { body = JSON.parse(p.request.postData || '{}'); } catch { /* not JSON */ }
  if (body.action === 'quiz' || /[?&]action=quiz\b/.test(p.request.url)) quizReqs.push(body.sample || 'get');
});

// Layout shifts from the first paint on; hadRecentInput is kept so the check can count every shift.
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__ls = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, r: e.hadRecentInput,
    src: (e.sources || []).slice(0, 3).map((x) => x.node ? (x.node.id || String(x.node.className || '').slice(0, 24) || x.node.nodeName) : '?') }); })
    .observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* no layout-shift support */ }` });

async function fresh(lang, w, h, mobile) {
  await page.viewport(w, h, mobile, mobile ? 2 : 1);
  await page.goto(BASE + '?lang=' + lang);
  await page.eval('localStorage.clear(); sessionStorage.clear(); true');
  await page.goto(BASE + '?lang=' + lang);
  await page.waitFor(`document.querySelector('[data-counter].is-ready') && document.querySelector('#sample-chips .chip')`);
  await s.wait(300);
}
const toDemo = () => page.eval(`document.getElementById('demo').scrollIntoView({ block: 'start' }); true`).then(() => s.wait(400));

const shiftMark = () => page.eval('window.__ls.length');
// all: every shift in the window (strict); cls: without the ones right after input, as CLS counts them.
const shiftSince = (k) => page.eval(`(() => { const a = window.__ls.slice(${k}); const sum = (x) => +x.reduce((t, e) => t + e.v, 0).toFixed(4);
  return { all: sum(a), cls: sum(a.filter((e) => !e.r)), src: a.map((e) => e.src.join('/')).join(' ; ').slice(0, 160) }; })()`);
const shiftInfo = (r) => `all ${r.all}, cls ${r.cls}${r.src ? ', sources ' + r.src : ''}`;

const KEYS = { ArrowRight: 39, ArrowLeft: 37, Home: 36, End: 35 };
async function key(name) {
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', { type, key: name, code: name, windowsVirtualKeyCode: KEYS[name], nativeVirtualKeyCode: KEYS[name] });
  }
  await s.wait(120);
}
const tabState = () => page.eval(`(() => { const ids = ['samples', 'own'];
  return { sel: ids.filter((k) => document.getElementById('tab-' + k).getAttribute('aria-selected') === 'true'),
    focus: document.activeElement ? document.activeElement.id : '',
    tabindex: ids.map((k) => document.getElementById('tab-' + k).tabIndex),
    inert: ids.filter((k) => document.getElementById('pane-' + k).hasAttribute('inert')) }; })()`);

// Clicks "Show" (after an optional chip) and returns ms from the click event to the quiz title in the panel.
async function showSample(id) {
  if (id) { await page.click(`.chip[data-sample="${id}"]`); await s.wait(150); }
  await page.eval(`(() => { window.__t0 = 0; window.__t1 = 0;
    document.getElementById('show-btn').addEventListener('click', () => { window.__t0 = performance.now(); }, { once: true, capture: true });
    const body = document.getElementById('quiz-body');
    const mo = new MutationObserver(() => { if (window.__t0 && body.querySelector('.quiz-title')) { window.__t1 = performance.now(); mo.disconnect(); } });
    mo.observe(body, { childList: true, subtree: true }); return true; })()`);
  await page.click('#show-btn');
  await page.waitFor('window.__t1 > 0', 5000);
  return page.eval('Math.round(window.__t1 - window.__t0)');
}

const overflow = () => page.eval(`(() => { const w = document.documentElement.clientWidth;
  const wide = [...document.querySelectorAll('#demo *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > w + 1; })
    .slice(0, 4).map((e) => e.id || String(e.className || '').slice(0, 30) || e.nodeName);
  return { sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), w, wide }; })()`);
const overflowOk = (name, r) => ok(name, r.sw <= r.w, `scrollWidth ${r.sw}, width ${r.w}${r.wide.length ? ', wide in #demo: ' + r.wide.join(', ') : ''}`);

try {
  // 1. Tabs by keyboard: roving tabindex, automatic activation, focus follows.
  await fresh('en', 1440, 900, false);
  await toDemo();
  await page.eval(`document.getElementById('tab-samples').focus(); true`);
  const start = await tabState();
  ok('tabs: start on Ready examples', start.sel.join() === 'samples' && start.focus === 'tab-samples' && start.tabindex.join() === '0,-1', JSON.stringify(start));
  for (const [k, want] of [['ArrowRight', 'own'], ['ArrowRight', 'samples'], ['ArrowLeft', 'own'], ['Home', 'samples'], ['End', 'own'], ['ArrowLeft', 'samples']]) {
    await key(k);
    const st = await tabState();
    const other = want === 'own' ? 'samples' : 'own';
    const pass = st.sel.join() === want && st.focus === 'tab-' + want &&
      st.tabindex.join() === (want === 'samples' ? '0,-1' : '-1,0') && st.inert.join() === other;
    ok(`tabs: ${k} selects ${want}, focus and tabindex follow`, pass, JSON.stringify(st));
  }

  // 2. UK interface, Spanish example: the quiz is Spanish, the page stays Ukrainian, no API call.
  await fresh('uk', 1440, 900, false);
  await toDemo();
  quizReqs.length = 0;
  const msEs = await showSample('water_es');
  const es = await page.eval(`(() => ({ title: document.querySelector('#quiz-body .quiz-title').textContent.trim(),
    textLang: document.getElementById('sample-text').lang, htmlLang: document.documentElement.lang,
    tab: document.getElementById('tab-samples').innerText.trim() }))()`); // innerText: ui.js keeps hidden language variants in the DOM
  const esTitle = SAMPLES.water_es.quiz.es.title;
  ok('uk: water_es gives a Spanish quiz title', es.title === esTitle, `"${es.title}"`);
  ok('uk: example text marked lang=es, page stays uk', es.textLang === 'es' && es.htmlLang === 'uk' && es.tab === 'Готові приклади', JSON.stringify(es));
  ok(`uk: water_es quiz shown in < ${FAST_MS} ms`, msEs < FAST_MS, msEs + ' ms');
  ok('uk: ready example makes no quiz request', quizReqs.length === 0, quizReqs.join());

  // 3. Layout shift and overflow at both widths.
  for (const [w, h, mobile] of [[1440, 900, false], [375, 812, true]]) {
    await fresh('en', w, h, mobile);
    await toDemo();
    quizReqs.length = 0;
    if (mobile) overflowOk('375: no horizontal overflow on load', await overflow());
    let k = await shiftMark();
    await page.click('#tab-own'); await s.wait(700);
    await page.click('#tab-samples'); await s.wait(700);
    let r = await shiftSince(k);
    ok(`${w}: no layout shift when switching tabs`, r.all === 0, shiftInfo(r));

    k = await shiftMark();
    const ms = await showSample('printing');
    await s.wait(900);
    r = await shiftSince(k);
    ok(`${w}: no layout shift when the quiz appears`, r.all === 0, shiftInfo(r));
    ok(`${w}: ready quiz shown in < ${FAST_MS} ms`, ms < FAST_MS, ms + ' ms');

    k = await shiftMark();
    await page.click('#tab-own'); await s.wait(700);
    await page.click('#tab-samples'); await s.wait(700);
    r = await shiftSince(k);
    ok(`${w}: no layout shift when switching tabs with a quiz on screen`, r.all === 0, shiftInfo(r));
    ok(`${w}: ready examples make no quiz request`, quizReqs.length === 0, quizReqs.join());
    if (mobile) overflowOk('375: no horizontal overflow with a quiz', await overflow());
  }

  // 4. Your text with the quiz API disabled: early access, inline signup, hero card in its thanks state.
  await fresh('en', 375, 812, true);
  await toDemo();
  quizReqs.length = 0;
  await page.click('#tab-own');
  await s.wait(300);
  await page.type('#lesson', OWN_TEXT);
  await page.click('#gen-btn');
  await page.waitFor(`document.querySelector('#quiz-body .ea #ea-email')`, 8000);
  const ea = await page.eval(`(() => ({ title: document.querySelector('#quiz-body .ea-title').textContent.trim(),
    status: document.getElementById('quiz-status').textContent.trim(), busy: document.getElementById('quiz-panel').getAttribute('aria-busy') }))()`);
  ok('own: "disabled" opens early access with an email form', ea.title.length > 10 && ea.busy === 'false', JSON.stringify(ea));
  ok('own: status line announces early access', ea.status === ea.title, ea.status);
  ok('own: one quiz request was made', quizReqs.length === 1 && quizReqs[0] === 'custom', quizReqs.join());
  overflowOk('375: no horizontal overflow with early access', await overflow());

  await page.type('#ea-email', 'demo.check@example.org');
  await page.click('#ea-btn');
  await page.waitFor(`document.querySelector('#quiz-body .ea-done')`, 8000);
  const done = await page.eval(`(() => { const d = document.querySelector('#quiz-body .ea-done');
    return { text: d.textContent.trim(), focused: document.activeElement === d, form: !!document.getElementById('ea-form'),
      thanks: !document.getElementById('thanks').hidden, joinForm: document.getElementById('join-form').hidden,
      thanksTitle: document.getElementById('thanks-title').textContent.trim(),
      stored: !!localStorage.getItem('qp_joined') }; })()`);
  ok('own: email shows the confirmation with focus on it', done.text.length > 5 && done.focused && !done.form, JSON.stringify({ text: done.text, focused: done.focused, form: done.form }));
  ok('own: hero block turns to its thanks state', done.thanks && done.joinForm && done.thanksTitle.length > 3 && done.stored,
    JSON.stringify({ thanks: done.thanks, joinFormHidden: done.joinForm, title: done.thanksTitle, stored: done.stored }));

  ok('no console errors', s.errors.length === 0, s.errors.join(' || ').slice(0, 400));
} catch (e) {
  ok('run finished', false, e.message);
} finally {
  await s.stop();
}

const passed = results.filter((r) => r.pass).length;
console.log(`SUMMARY ${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
