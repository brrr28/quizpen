// Headless check of the student play mode (web/play/) and the landing share UI.
// Usage: node web/dev/play-check.mjs   (own ports: static 8093, CDP 9353; exit 1 on any failure)
// Env: PLAY_CHROME_PROFILE (temp Chrome profile dir), CHROME (chrome.exe path).

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = process.env.PLAY_CHROME_PROFILE || resolve(process.env.TEMP || '.', 'play-chrome');
const PORT = 8093, CDP = 9353, BASE = `http://127.0.0.1:${PORT}/`, PLAY = BASE + 'play/';
const PROD_PLAY = 'https://brrr28.github.io/quizpen/play/';
const SHOTS = resolve(REPO, 'shots');
const SAMPLES = JSON.parse(readFileSync(resolve(REPO, 'web/data/samples.json'), 'utf8')).samples;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, label) {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* not ready */ }
    if (Date.now() > end) throw new Error('timeout: ' + label);
    await wait(120);
  }
}
const run = (cmd, args, env = {}) => spawn(cmd, args, { cwd: REPO, env: { ...process.env, ...env }, windowsHide: true, stdio: 'ignore' });
const killTree = (c) => { if (c && c.exitCode === null) spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); };

class Page {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.fail(new Error(m.error.message)) : p.ok(m.result); }
      else if (m.method) (this.handlers.get(m.method) || []).forEach((h) => h(m.params));
    });
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((ok, fail) => { this.pending.set(id, { ok, fail }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  on(method, fn) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(fn); }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  waitFor(expr, ms = 8000) { return until(() => this.eval(expr), ms, expr); }
  async viewport(width, height, mobile, scale) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  }
  async load(url) {
    const loaded = new Promise((r) => { const h = () => r(); this.on('Page.loadEventFired', h); });
    await this.send('Page.navigate', { url });
    await loaded;
  }
  // Fragment-only changes do not reload a page, so every open goes through about:blank.
  async open(url) { await this.load('about:blank'); await this.load(url); }
  async click(sel) {
    const box = await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null;
      el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!box) throw new Error('no element ' + sel);
    await wait(50);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await this.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  async shot(name) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(SHOTS, name), Buffer.from(r.data, 'base64'));
  }
}

const results = [];
const ok = (name, pass, info = '') => { results.push(!!pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

mkdirSync(PROFILE, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const serve = run(process.execPath, ['web/dev/serve.mjs'], { SERVE_OK: '1', PORT: String(PORT) });
const chrome = run(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--window-size=1440,900', 'about:blank']);
let ws;
try {
  await until(() => fetch(BASE).then((r) => r.ok), 8000, 'static server');
  const list = await until(() => fetch(`http://127.0.0.1:${CDP}/json/list`).then((r) => r.json()), 15000, 'chrome');
  ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
  const page = new Page(ws);
  const errors = [], requests = [];
  page.on('Runtime.exceptionThrown', (p) => errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error' || p.type === 'warning') errors.push(p.type + ': ' + p.args.map((a) => a.value ?? a.description).join(' ')); });
  page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error' || p.entry.level === 'warning') errors.push('log: ' + p.entry.text + ' ' + (p.entry.url || '')); });
  page.on('Network.requestWillBeSent', (p) => requests.push(p.request.url));
  await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable'].map((m) => page.send(m)));
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await page.send('Browser.grantPermissions', { origin: BASE.slice(0, -1), permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});

  /* ---------- Landing at 375: sample quiz -> Share with class -> Preview as student ---------- */
  const links = {};
  await page.viewport(375, 812, true, 2);
  for (const lang of ['en', 'uk']) {
    await page.open(BASE + '?lang=' + lang);
    // Ready examples are the default mode, photosynthesis is preselected: the quiz opens without an API call.
    await page.waitFor(`document.querySelector('#sample-chips .chip[aria-pressed="true"]') ? true : null`);
    // Web fonts switch in one step after the load event (index.html, html.wf): click in the final layout.
    await page.waitFor(`typeof window.qpFontsCss !== 'function' || document.documentElement.classList.contains('wf')`, 15000);
    await page.click('#show-btn');
    await page.waitFor(`(() => { const t = document.querySelector('.play-tools'); return t && !t.hidden; })()`, 15000);
    ok(`${lang}: landing tools shown with the quiz`, true);
    await page.click('.play-tools .btn-ink');
    await page.waitFor(`!!document.querySelector('dialog.play-share[open] .play-qr svg')`);
    const link = await page.eval(`document.getElementById('play-link').value`);
    const clip = await page.waitFor(`navigator.clipboard.readText().then((t) => t.startsWith('http') && t)`, 3000).catch(() => '');
    ok(`${lang}: share link copied`, clip === link && link.startsWith(PLAY + '?lang=' + lang + '#q=z.'), `${link.length} chars`);
    const qrN = await page.eval(`document.querySelector('.play-qr svg').viewBox.baseVal.width - 8`);
    ok(`${lang}: QR code rendered`, qrN >= 21, `${qrN} modules`);
    links['photosynthesis-' + lang] = link;
    if (lang === 'en') {
      await wait(400);
      await page.shot('share-modal-375.png');
      await page.click('.play-share .play-big');
      ok('en: large QR mode', await page.eval(`document.querySelector('.play-share').classList.contains('is-big')`));
    }
    await page.click('dialog.play-share [data-play-close]');
    await page.waitFor(`!document.querySelector('dialog.play-share')`);
    await page.click('.play-tools .btn-ghost');
    const title = await page.waitFor(`(() => { const f = document.querySelector('dialog.play-preview[open] iframe');
      const d = f && f.contentDocument; const e = d && d.querySelector('.start-title'); return e && e.textContent; })()`);
    ok(`${lang}: preview iframe shows the player`, title === SAMPLES[0].quiz[lang].title, title);
    await page.click('dialog.play-preview [data-play-close]');
    await page.waitFor(`!document.querySelector('dialog.play-preview')`);
  }
  // The rest of the samples are encoded by the same in-page codec the landing uses.
  // Spanish and Polish examples hold one quiz in their own language; the player UI still runs in en and uk.
  const quizOf = (s, lang) => s.quiz[s.lang || lang];
  for (const s of SAMPLES.slice(1)) for (const lang of ['en', 'uk']) {
    const token = await page.eval(`QuizpenCodec.encode(${JSON.stringify(quizOf(s, lang))}, '${lang}')`);
    links[s.id + '-' + lang] = PLAY + '?lang=' + lang + '#q=' + token;
  }
  for (const [k, v] of Object.entries(links)) console.log(`LINK ${k}: ${v.length} local, ${v.length - PLAY.length + PROD_PLAY.length} on GitHub Pages`);

  /* ---------- Player: every sample, both languages, all questions ---------- */
  async function play(key, quiz, wrongAt, shots = {}) {
    await page.open(links[key]);
    await page.waitFor(`!!document.querySelector('.screen-start')`);
    const start = await page.eval(`({ t: document.querySelector('.start-title').textContent, p: !!document.querySelector('.privacy'), lang: document.documentElement.lang })`);
    ok(`${key}: start screen`, start.t === quiz.title && start.p && start.lang === key.slice(-2), start.t);
    await page.click('.screen-start .btn-primary');
    const before = requests.length;
    let streak = 0, right = 0;
    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i], k = wrongAt.includes(i) ? (q.answer + 1) % 4 : q.answer;
      await page.waitFor(`document.querySelector('.count') && document.querySelector('.count').textContent === '${i + 1}/${quiz.questions.length}'`);
      if (i === 0) {
        const sizes = await page.eval(`[...document.querySelectorAll('.opt')].map((b) => Math.round(b.getBoundingClientRect().height))`);
        ok(`${key}: answer targets >= 56px`, sizes.every((h) => h >= 56), sizes.join(','));
      }
      await page.click(`.opt[data-k="${k}"]`);
      streak = k === q.answer ? streak + 1 : 0;
      right += k === q.answer ? 1 : 0;
      const fb = await page.eval(`(() => { const f = document.querySelector('.feedback.is-on'); return f && { cls: f.className, text: f.textContent,
        streak: document.querySelector('.streak-n').textContent, rightOpt: document.querySelector('.opt.is-right').getAttribute('data-k'),
        next: Math.round(document.querySelector('[data-next]').getBoundingClientRect().height) }; })()`);
      const good = fb && fb.cls.includes(k === q.answer ? 'is-right' : 'is-wrong') && fb.text.includes(q.explain.slice(0, 25))
        && fb.streak === String(streak) && fb.rightOpt === String(q.answer) && fb.next >= 56;
      ok(`${key}: q${i + 1} ${k === q.answer ? 'right' : 'wrong'} feedback, streak ${streak}`, good, good ? '' : JSON.stringify(fb));
      if (shots.question === i) { await wait(450); await page.shot(shots.name); }
      await page.click('[data-next]');
    }
    const n = quiz.questions.length, ratio = right / n, stars = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
    await page.waitFor(`!!document.querySelector('.screen-final')`);
    const fin = await page.eval(`({ score: document.querySelector('.final-score').textContent, stars: document.querySelectorAll('.star.is-on').length,
      wide: document.documentElement.scrollWidth <= innerWidth })`);
    ok(`${key}: final ${fin.score}, ${fin.stars} stars, no sideways scroll`, fin.score === `${right}/${n}` && fin.stars === stars && fin.wide);
    if (shots.final) { await wait(700); await page.shot(shots.final); }
    await page.click('.screen-final .btn-ghost');
    const rev = await page.eval(`({ all: document.querySelectorAll('.review-item').length, wrong: document.querySelectorAll('.review-item.is-wrong').length })`);
    ok(`${key}: review answers`, rev.all === n && rev.wrong === n - right, JSON.stringify(rev));
    await page.click('.screen-review .btn-ghost');
    await page.waitFor(`!!document.querySelector('.screen-final')`);
    await page.click('.screen-final .btn-primary');
    const again = await page.waitFor(`(() => { const c = document.querySelector('.count'); return c && c.textContent + ' ' + document.querySelector('.streak-n').textContent; })()`);
    ok(`${key}: play again restarts`, again === `1/${n} 0`, again);
    ok(`${key}: no network calls while playing`, requests.length === before, requests.slice(before).join(' '));
  }

  for (const s of SAMPLES) for (const lang of ['en', 'uk']) {
    const shots = s.id === 'photosynthesis' && lang === 'en' ? { question: 1, name: 'play-375-question.png', final: 'play-375-final.png' } : {};
    await play(s.id + '-' + lang, quizOf(s, lang), lang === 'en' ? [0] : [0, 2], shots);
  }

  /* ---------- Desktop 1440 ---------- */
  await page.viewport(1440, 900, false, 1);
  await play('printing-en', SAMPLES[1].quiz.en, [3], { question: 0, name: 'play-1440.png' });

  /* ---------- Malformed links, unsafe text, reduced motion ---------- */
  await page.viewport(375, 812, true, 2);
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const good = links['magi-en'].split('#q=')[1];
  const q4 = (over = {}) => ({ q: 'Question text', options: ['a', 'b', 'c', 'd'], answer: 1, explain: 'Because.', ...over });
  const bad = {
    'no fragment': ['', 'There is no quiz'],
    'bad characters': ['#q=z.@@@!!', 'broken'],
    'not deflate': ['#q=z.AAAAAAAAAAAA', 'broken'],
    'cut in half': ['#q=' + good.slice(0, Math.floor(good.length / 2)), 'broken'],
    'two questions': ['#q=p.' + b64u([1, 'en', 'T', [['q', ['a', 'b', 'c', 'd'], 0, ''], ['q', ['a', 'b', 'c', 'd'], 0, '']]]), 'broken'],
    'three options': ['#q=p.' + b64u({ title: 'T', questions: [q4(), q4(), q4({ options: ['a', 'b', 'c'] })] }), 'broken'],
    'answer 4': ['#q=p.' + b64u({ title: 'T', questions: [q4(), q4(), q4({ answer: 4 })] }), 'broken'],
    'not JSON': ['#q=p.' + Buffer.from('{oops').toString('base64url'), 'broken'],
  };
  for (const [name, [hash, text]] of Object.entries(bad)) {
    await page.open(PLAY + '?lang=en' + hash);
    const e = await page.waitFor(`(() => { const t = document.querySelector('.error-title'); return t && t.textContent; })()`);
    ok(`malformed (${name}): friendly error`, e.includes(text), e);
  }
  const evil = { title: '<b>bold</b>', questions: [q4({ q: '<img src=x onerror="window.__x=1">' }), q4({ options: ['x'.repeat(500), 'b', 'c', 'd'] }), q4({ explain: '<script>window.__x=1</script>' })] };
  await page.open(PLAY + '?lang=en#q=p.' + b64u(evil));
  await page.waitFor(`!!document.querySelector('.screen-start')`);
  const t1 = await page.eval(`document.querySelector('.start-title').textContent`);
  await page.click('.screen-start .btn-primary');
  const xss = await page.eval(`({ q: document.querySelector('.q').textContent, tags: document.querySelectorAll('#app img, #app b, #app script').length, x: window.__x === 1 })`);
  ok('unsafe text rendered as plain text', t1 === '<b>bold</b>' && xss.q.startsWith('<img') && xss.tags === 0 && !xss.x, JSON.stringify(xss));
  await page.click('.opt[data-k="1"]');
  await page.click('[data-next]');
  const long = await page.eval(`document.querySelector('.opt[data-k="0"] .opt-text').textContent.length`);
  ok('over-long option cut to 160 chars', long === 160, String(long));

  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.open(links['photosynthesis-en']);
  await page.waitFor(`!!document.querySelector('.screen-start')`);
  ok('reduced motion: no animations', (await page.eval(`getComputedStyle(document.querySelector('.start-title')).animationName`)) === 'none');
  await page.send('Emulation.setEmulatedMedia', { features: [] });

  // config.js has the real PostHog key: in headless Chrome PostHog drops every event as a bot and says so. Expected, not a page fault.
  const real = errors.filter((e) => !/\[PostHog\.js\] Events are being dropped because the user agent looks like a bot/.test(e));
  ok('no console errors or warnings', real.length === 0, real.slice(0, 5).join(' | '));
} catch (e) {
  ok('run', false, e.message);
} finally {
  try { ws && ws.send(JSON.stringify({ id: 999999, method: 'Browser.close' })); } catch { /* gone */ }
  await wait(400);
  try { ws && ws.close(); } catch { /* gone */ }
  killTree(chrome);
  killTree(serve);
}
const failed = results.filter((r) => !r).length;
console.log(`SUMMARY ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
