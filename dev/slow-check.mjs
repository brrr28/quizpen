// Headless check of weak and dropped connections on the dev stand, in a fresh Chrome profile:
// (a) the service worker (web/sw.js) installs and caches the shell;
// (b) a reload while offline (CDP offline emulation plus the static server and mock stopped) renders
//     the page, a ready example shows its quiz and the offline banner is visible in both themes;
// (c) a signup while offline is kept as pending and sent exactly once when back online (hero form,
//     next visit, early-access form), counted by the mock;
// (d) a live quiz slower than 8 s (MOCK_QUIZ_DELAY_MS=9000) shows the slow line; offline gives the busy view;
// (e) no console errors except the expected network failures.
// Usage: node web/dev/slow-check.mjs   (one line per check, then "SUMMARY n/m passed"; exit 1 on any failure)

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
// A profile of its own: no service worker or storage from other runs, removed at the end.
const PROFILE = resolve(process.env.TEMP || '.', 'qp-chrome-slow-' + process.pid);
process.env.QP_CHROME_PROFILE = PROFILE;
const { startStand, BASE } = await import('./stand.mjs');

const SAMPLES = Object.fromEntries(JSON.parse(readFileSync(new URL('../data/samples.json', import.meta.url), 'utf8')).samples.map((x) => [x.id, x]));
const OWN_TEXT = 'The Dnipro is one of the longest rivers in Europe. It starts in the Valdai Hills and flows south ' +
  'through Ukraine into the Black Sea. Its basin feeds farms, towns and power plants, and the river has carried ' +
  'boats, grain and timber for more than a thousand years.';
const MOCK = 'http://127.0.0.1:8787/';
const TXT = {
  bannerUk: 'Ви офлайн. Готові приклади працюють і без інтернету.',
  bannerEn: 'You\'re offline. Ready examples still work.',
  pendingEn: 'No connection. We\'ll send your email as soon as you\'re back online.',
  slowEn: 'Slow connection. Still working on it.',
};
// Failed loads while offline or with the servers stopped are expected; anything else is a real error.
const EXPECTED_NET = /net::ERR_(INTERNET_DISCONNECTED|CONNECTION_REFUSED|CONNECTION_RESET|ABORTED|NAME_NOT_RESOLVED|FAILED)\b/;

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
// The stand has fixed ports: a run next to another one would share its servers and the results would mean nothing.
if (await fetch(BASE).then(() => true, () => false)) {
  console.error('stand busy: ' + BASE + ' already answers (another check or shoot is running); try again when it ends');
  process.exit(75);
}
const s = await startStand();
const { page } = s;
const wait = s.wait;

const killTree = (child) => { if (child && child.exitCode === null) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); };
const up = (url) => fetch(url).then((r) => r.ok, () => false);
async function until(fn, ms) { const end = Date.now() + ms; for (;;) { if (await fn()) return true; if (Date.now() > end) return false; await wait(150); } }
async function startServe() {
  s.procs.serve = spawn(process.execPath, ['web/dev/serve.mjs'], { cwd: REPO, env: { ...process.env, SERVE_OK: '1', DEV_API: '1' }, windowsHide: true, stdio: 'ignore' });
  return until(() => up(BASE), 8000);
}
const net = (offline) => page.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const debug = () => fetch(MOCK + '?action=debug').then((r) => r.json());
const joinsFor = async (email) => ((await debug()).joinRequestsByEmail || {})[email] || 0;
const mark = () => s.errors.length;
const unexpected = (from) => s.errors.slice(from).filter((e) => !EXPECTED_NET.test(e));

async function fresh(lang) {
  await page.goto(BASE + '?lang=' + lang);
  await page.eval('localStorage.clear(); sessionStorage.clear(); true');
  await page.goto(BASE + '?lang=' + lang);
  await page.waitFor(`document.querySelector('#sample-chips .chip')`);
  await wait(300);
}
const banner = () => page.eval(`(() => { const b = document.getElementById('offline-bar'); if (!b) return null; const cs = getComputedStyle(b);
  return { on: b.classList.contains('is-on'), text: b.textContent, pos: cs.position, live: b.getAttribute('aria-live'), op: cs.opacity }; })()`);
// WCAG contrast of the banner text on its background, in the current theme.
const bannerContrast = () => page.eval(`(() => { const cs = getComputedStyle(document.getElementById('offline-bar'));
  const rgb = (c) => c.match(/[\\d.]+/g).slice(0, 3).map(Number); const lum = (c) => { const v = rgb(c).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }; const a = lum(cs.color), b = lum(cs.backgroundColor);
  return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); })()`);

try {
  await page.viewport(390, 844, true, 2);

  // (a) Service worker installs, controls the page and caches the shell.
  let e0 = mark();
  await fresh('en');
  const controlled = await until(() => page.eval('!!navigator.serviceWorker.controller'), 10000);
  const reg = await page.eval(`navigator.serviceWorker.getRegistration().then((r) => r ? { scope: r.scope, active: !!r.active } : null)`);
  ok('sw: registered with scope ./ and controls the page', controlled && reg && reg.active && reg.scope === BASE, JSON.stringify(reg));
  const cached = await page.eval(`(async () => { const keys = await caches.keys(); const k = keys.find((x) => x.indexOf('qp-shell-') === 0);
    if (!k) return { keys }; const c = await caches.open(k); return { keys, urls: (await c.keys()).map((r) => r.url) }; })()`);
  const paths = (cached.urls || []).map((u) => new URL(u).pathname);
  const need = ['/index.html', '/styles.css', '/app.js', '/ui.js', '/nav.js', '/config.js', '/favicon.svg', '/data/samples.json', '/vendor/qrcode.js', '/play/index.html', '/play/share.js', '/play/codec.js'];
  const missing = need.filter((p) => !paths.includes(p));
  ok('sw: one versioned cache holds the shell', cached.keys.filter((k) => k.indexOf('qp-shell-') === 0).length === 1 && !missing.length, missing.length ? 'missing ' + missing.join(', ') : cached.keys.join(','));
  ok('sw: no API, cross-origin or verification file in the cache', (cached.urls || []).every((u) => u.startsWith(BASE) && !/\/api|googlecc0c4bdfc53fdacd/.test(u)));

  // (b) Reload with no network at all: offline emulation, static server and mock stopped.
  await net(true);
  s.stopMock();
  killTree(s.procs.serve);
  const down = await until(async () => !(await up(BASE)), 5000);
  await page.goto(BASE + '?lang=uk');
  const rendered = await until(() => page.eval(`!!document.querySelector('#sample-chips .chip') && !!document.getElementById('join-form')`), 6000);
  ok('offline reload: the page renders from the cache', down && rendered, down ? '' : 'static server still answers');
  const b1 = await banner();
  ok('offline reload: banner shown, fixed and polite', b1 && b1.on && b1.text === TXT.bannerUk && b1.pos === 'fixed' && b1.live === 'polite', JSON.stringify(b1));
  const id = 'photosynthesis';
  await page.click(`.chip[data-sample="${id}"]`); await wait(150);
  await page.click('#show-btn');
  const shown = await until(() => page.eval(`!!document.querySelector('#quiz-body .quiz-title')`), 5000);
  const title = shown ? await page.eval(`document.querySelector('#quiz-body .quiz-title').textContent`) : '';
  ok('offline reload: a ready example shows its quiz', shown && title === SAMPLES[id].quiz.uk.title, title);
  await wait(300);
  const theme0 = await page.eval(`document.documentElement.getAttribute('data-theme')`);
  const setTheme = (th) => page.eval(`document.documentElement.setAttribute('data-theme', '${th}'); true`).then(() => wait(100));
  await setTheme('light');
  const cLight = await bannerContrast();
  await setTheme('dark');
  const cDark = await bannerContrast();
  await setTheme(theme0 || 'light');
  ok('offline banner: readable in both themes', cLight >= 4.5 && cDark >= 4.5 && cLight !== cDark, `light ${cLight}, dark ${cDark}`);
  ok('offline reload: no console errors except network failures', !unexpected(e0).length, unexpected(e0).slice(0, 3).join(' | '));

  // Back online: servers up again, emulation off.
  const serveUp = await startServe();
  await s.startMock();
  await net(false);
  await wait(300);
  const b2 = await banner();
  ok('online again: banner hidden', serveUp && b2 && !b2.on && b2.text === '', JSON.stringify(b2));

  // (c1) Hero form while offline: pending, then sent once on 'online'.
  e0 = mark();
  await fresh('en');
  const email1 = 'slow.check1@example.org';
  await net(true);
  await page.waitFor(`document.getElementById('offline-bar').classList.contains('is-on')`, 3000);
  await page.type('#email', email1);
  await page.click('#join-btn');
  await page.waitFor(`document.getElementById('join-msg').textContent.length > 0 && !document.getElementById('join-btn').disabled`, 5000);
  const p1 = await page.eval(`({ msg: document.getElementById('join-msg').textContent, err: document.getElementById('join-msg').classList.contains('is-error'),
    invalid: document.getElementById('email').hasAttribute('aria-invalid'), pending: JSON.parse(localStorage.getItem('qp_join_pending') || 'null') })`);
  ok('join offline: email kept as pending with the notice', p1.msg === TXT.pendingEn && !p1.err && !p1.invalid && p1.pending && p1.pending.email === email1, JSON.stringify({ msg: p1.msg, err: p1.err }));
  ok('join offline: nothing reached the mock', (await joinsFor(email1)) === 0);
  await net(false);
  const thanks1 = await until(() => page.eval(`!document.getElementById('thanks').hidden && !!localStorage.getItem('qp_joined')`), 8000);
  ok('back online: the pending email is sent and thanks shows', thanks1);
  await page.eval(`window.dispatchEvent(new Event('online')); true`);
  await wait(800);
  await page.goto(BASE + '?lang=en');
  await wait(800);
  const n1 = await joinsFor(email1);
  const left1 = await page.eval(`localStorage.getItem('qp_join_pending')`);
  ok('back online: sent exactly once, pending cleared', n1 === 1 && left1 === null, `mock received ${n1}`);

  // (c2) Pending left from an earlier visit: sent once on the next load.
  const email2 = 'slow.check2@example.org';
  await page.eval(`localStorage.removeItem('qp_joined'); localStorage.setItem('qp_join_pending', JSON.stringify({ email: '${email2}', lang: 'en', hp: '' })); true`);
  await page.goto(BASE + '?lang=en');
  const thanks2 = await until(() => page.eval(`!document.getElementById('thanks').hidden && !!localStorage.getItem('qp_joined')`), 8000);
  await page.goto(BASE + '?lang=en');
  await wait(800);
  const n2 = await joinsFor(email2);
  ok('next visit: a pending email is sent once', thanks2 && n2 === 1 && (await page.eval(`localStorage.getItem('qp_join_pending')`)) === null, `mock received ${n2}`);

  // (c3) Early-access form (live quiz disabled) while offline.
  s.stopMock();
  await s.startMock({ MOCK_QUIZ_DISABLED: '1' });
  await fresh('en');
  await page.click('#tab-own'); await wait(500);
  await page.type('#lesson', OWN_TEXT);
  await page.click('#gen-btn');
  await page.waitFor(`!!document.getElementById('ea-email')`, 8000);
  const email3 = 'slow.check3@example.org';
  await net(true);
  await wait(200);
  await page.type('#ea-email', email3);
  await page.click('#ea-btn');
  await page.waitFor(`document.getElementById('ea-msg').textContent.length > 0`, 5000);
  const p3 = await page.eval(`({ msg: document.getElementById('ea-msg').textContent, pending: JSON.parse(localStorage.getItem('qp_join_pending') || 'null') })`);
  ok('early access offline: email kept as pending', p3.msg === TXT.pendingEn && p3.pending && p3.pending.email === email3, p3.msg);
  await net(false);
  const done3 = await until(() => page.eval(`!!document.querySelector('#quiz-body .ea-done')`), 8000);
  await wait(800);
  const n3 = await joinsFor(email3);
  ok('early access back online: sent once, done state shows', done3 && n3 === 1, `mock received ${n3}`);
  ok('signup flows: no console errors except network failures', !unexpected(e0).length, unexpected(e0).slice(0, 3).join(' | '));

  // (d) Slow live quiz: the line appears after 8 s and goes with the quiz; offline gives the busy view.
  e0 = mark();
  s.stopMock();
  await s.startMock({ MOCK_QUIZ_DELAY_MS: '9000' });
  await fresh('en');
  await page.click('#tab-own'); await wait(500);
  await page.type('#lesson', OWN_TEXT);
  const t0 = Date.now();
  await page.click('#gen-btn');
  await wait(5000);
  const early = await page.eval(`(() => { const el = document.querySelector('#quiz-body .skel-slow'); return el ? el.hidden : null; })()`);
  ok('slow quiz: no slow line in the first seconds', early === true, String(early));
  const appeared = await until(() => page.eval(`(() => { const el = document.querySelector('#quiz-body .skel-slow'); return !!el && !el.hidden; })()`), 5000);
  const at = Date.now() - t0;
  const slow = await page.eval(`({ text: (document.querySelector('#quiz-body .skel-slow') || {}).textContent, steps: !!document.querySelector('#quiz-body .skel-steps + .skel-slow') })`);
  ok('slow quiz: the slow line appears under the steps after 8 s', appeared && at >= 7900 && slow.text === TXT.slowEn && slow.steps, `at ${at} ms`);
  const quizCame = await until(() => page.eval(`!!document.querySelector('#quiz-body .quiz-title')`), 8000);
  ok('slow quiz: the quiz arrives and the line goes', quizCame && !(await page.eval(`!!document.querySelector('#quiz-body .skel-slow')`)));
  await net(true);
  await wait(200);
  await page.eval(`document.getElementById('lesson').scrollIntoView({ block: 'center' }); true`);
  await page.click('#gen-btn');
  const busy = await until(() => page.eval(`!!document.querySelector('#quiz-body .demo-busy [data-retry]')`), 5000);
  ok('quiz offline: the busy view with a retry button', busy);
  await net(false);
  await wait(300);
  await page.click('#quiz-body [data-retry]');
  const retried = await until(() => page.eval(`!!document.querySelector('#quiz-body .skel-steps')`), 3000);
  ok('quiz back online: retry resubmits', retried);
  ok('slow quiz: no console errors except network failures', !unexpected(e0).length, unexpected(e0).slice(0, 3).join(' | '));
} catch (err) {
  ok('run finished without an exception', false, err.message);
} finally {
  await s.stop();
  await wait(500);
  try { rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* Chrome still holds a file */ }
}

const failed = results.filter((r) => !r.pass).length;
console.log(`SUMMARY ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
