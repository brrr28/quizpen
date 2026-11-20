// Headless check of web/analytics.js and the SEO tags (dev only).
// Usage: node web/dev/analytics-check.mjs   (own ports: static 8095, CDP 9355; exit 1 on any failure)
// The IDs are overridden in memory in the served config.js (empty or fake, never the real ones from web/config.js). Requests to PostHog and
// Clarity are intercepted by CDP and answered locally with empty bodies, so nothing leaves the machine.
// Env: CHROME (chrome.exe path), ANALYTICS_CHROME_PROFILE (base dir for temp Chrome profiles).

import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const WEB = join(REPO, 'web');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE_BASE = process.env.ANALYTICS_CHROME_PROFILE || resolve(process.env.TEMP || '.', 'qp-analytics-chrome');
const PORT = 8095, CDP = 9355, BASE = `http://127.0.0.1:${PORT}/`;
const FAKE = { POSTHOG_KEY: 'phc_fake_test_key', CLARITY_ID: 'fakeclarity1' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml' };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, label) {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* not ready */ }
    if (Date.now() > end) throw new Error('timeout: ' + label);
    await wait(100);
  }
}
const results = [];
const ok = (name, pass, info = '') => { results.push(!!pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

/* ---------- Static server with an in-memory config override and a tiny fake waitlist API ---------- */
let mode = 'empty';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  if (url.pathname === '/api') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const action = url.searchParams.get('action') || (JSON.parse(body || '{}').action);
      const out = action === 'join' ? { ok: true, position: 7, total: 12, refCode: 'abc123', referrals: 0, already: false }
        : action === 'stats' ? { ok: true, total: 12 } : action === 'quiz' ? { ok: false, error: 'busy' } : { ok: true };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  let path = normalize(join(WEB, decodeURIComponent(url.pathname)));
  if (!path.startsWith(WEB)) { res.writeHead(403); res.end(); return; }
  if (url.pathname.endsWith('/')) path = join(path, 'index.html');
  let data;
  try { data = readFileSync(path); } catch { res.writeHead(404); res.end(); return; }
  if (url.pathname === '/config.js') {
    let extra = '\nwindow.WAITLIST_API = "/api";\n';
    // The real IDs in web/config.js are always replaced: empty for the "off" run, fake for the rest.
    extra += mode === 'fake' ? `window.POSTHOG_KEY = "${FAKE.POSTHOG_KEY}"; window.CLARITY_ID = "${FAKE.CLARITY_ID}";\n` : 'window.POSTHOG_KEY = ""; window.CLARITY_ID = "";\n';
    data = Buffer.concat([data, Buffer.from(extra)]);
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(data);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/* ---------- Minimal CDP page ---------- */
class Page {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map(); this.covered = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.fail(new Error(m.error.message)) : p.ok(m.result); }
      else if (m.method) (this.handlers.get(m.method) || []).forEach((h) => h(m.params));
    });
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((ok2, fail) => { this.pending.set(id, { ok: ok2, fail }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  on(method, fn) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(fn); }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  waitFor(expr, ms = 8000) { return until(() => this.eval(expr), ms, expr); }
  async open(url) {
    const loaded = new Promise((r) => this.on('Page.loadEventFired', r));
    await this.send('Page.navigate', { url });
    await loaded;
  }
  async click(sel) {
    const box = await this.waitFor(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || el.disabled) return null;
      el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`, 6000);
    await wait(60);
    const top = await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}), hit = document.elementFromPoint(${box.x}, ${box.y});
      return !hit || el.contains(hit) ? '' : (hit.tagName + '.' + hit.className).slice(0, 80); })()`);
    if (top) this.covered.push(sel + ' under ' + top);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await this.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  async clickText(text) {
    await this.waitFor(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)} && !x.closest('[hidden]'));
      if (b) b.setAttribute('data-qa', 'target'); return !!b; })()`).catch(async (e) => {
      throw new Error(e.message.slice(0, 60) + ' buttons: ' + (await this.eval(`[...document.querySelectorAll('button')].map((x) => x.textContent.trim()).filter(Boolean).join('|')`)).slice(0, 300));
    });
    await this.click('[data-qa="target"]');
    await this.eval(`document.querySelector('[data-qa="target"]')?.removeAttribute('data-qa')`);
  }
}

async function session(name, fn, opts = {}) {
  const profile = join(PROFILE_BASE, name);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--no-first-run', '--lang=en-US', '--accept-lang=en-US',
    '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--window-size=1440,900', 'about:blank'],
  { windowsHide: true, stdio: 'ignore' });
  let ws, ctx;
  try {
    const list = await until(() => fetch(`http://127.0.0.1:${CDP}/json/list`).then((r) => r.json()), 15000, 'chrome');
    ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
    const page = new Page(ws);
    ctx = { page, errors: [], requests: [], intercepted: [] };
    page.on('Runtime.exceptionThrown', (p) => ctx.errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
    page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error' || p.type === 'warning') ctx.errors.push(p.type + ': ' + p.args.map((a) => a.value ?? a.description).join(' ')); });
    page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') ctx.errors.push('log: ' + p.entry.text + ' ' + (p.entry.url || '')); });
    page.on('Network.requestWillBeSent', (p) => ctx.requests.push(p.request.url));
    // Analytics hosts never get a real request: answer locally with an empty, CORS-open response.
    page.on('Fetch.requestPaused', (p) => {
      ctx.intercepted.push({ url: p.request.url, method: p.request.method, body: p.request.postData || '' });
      page.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, body: '',
        responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'content-type' }] }).catch(() => {});
    });
    await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable'].map((m) => page.send(m)));
    await page.send('Fetch.enable', { patterns: [{ urlPattern: '*posthog.com*' }, { urlPattern: '*clarity.ms*' }] });
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await page.send('Browser.grantPermissions', { origin: BASE.slice(0, -1), permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
    await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    // Reduced motion: the page then scrolls instantly, so click coordinates stay valid.
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (opts.gpc) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true });" });
    try { await fn(ctx); } finally { if (page.covered.length) console.log('COVERED ' + page.covered.slice(0, 3).join(' ; ')); }
    ok(`${name}: no console errors`, ctx.errors.length === 0, ctx.errors.slice(0, 4).join(' | '));
  } catch (e) {
    ok(`${name}: run`, false, e.message.slice(0, 600) + (ctx && ctx.errors.length ? '  errors: ' + ctx.errors.slice(0, 4).join(' | ') : ''));
  } finally {
    try { ws && ws.send(JSON.stringify({ id: 999999, method: 'Browser.close' })); } catch { /* gone */ }
    await wait(500);
    try { ws && ws.close(); } catch { /* gone */ }
    if (chrome.exitCode === null) spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    await wait(300);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

const isAnalytics = (u) => /posthog\.com|clarity\.ms/.test(u);
const external = (reqs) => reqs.filter((u) => /^https?:/.test(u) && !u.startsWith(BASE) && !/fonts\.(googleapis|gstatic)\.com/.test(u));
const captures = (page) => page.eval(`(window.posthog || []).filter((c) => Array.isArray(c) && c[0] === 'capture').map((c) => ({ e: c[1], p: c[2] }))`);

async function landingFlow(page) {
  // Ready examples are the default mode with the first example (photosynthesis) preselected: no API call.
  await page.waitFor("document.querySelector('#sample-chips .chip[aria-pressed=\"true\"]') ? true : null");
  await page.click('#show-btn');
  for (let i = 0; i < 10; i++) {
    // The loading skeleton also has .opt bars (div.skel-bar.opt) inside #quiz-body: wait for real answer buttons.
    const state = await page.waitFor(`document.querySelector('#quiz-body .score') ? 'done' : (document.querySelector('#quiz-body button.opt:not([disabled])') ? 'q' : null)`, 10000);
    if (state === 'done') break;
    await page.click('#quiz-body button.opt:not([disabled])');
    await page.click('#quiz-body [data-next]');
  }
  await page.click('#quiz-body [data-copy-quiz]');
  await page.clickText('Share with your class');
  await page.waitFor(`!!document.querySelector('dialog[open]')`);
  await page.eval(`document.querySelectorAll('dialog[open]').forEach((d) => d.close())`);
  await page.clickText('Preview as a student');
  const playLink = await page.waitFor(`document.querySelector('dialog[open] .play-frame')?.src || null`);
  await page.eval(`document.querySelectorAll('dialog[open]').forEach((d) => d.close())`);
  await page.eval(`(() => { const e = document.getElementById('email'); e.value = 'teacher@example.org'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.click('#join-btn');
  await page.waitFor(`!document.getElementById('thanks').hidden`);
  await page.click('#copy-btn');
  // Below 640 px the language switch lives in the menu drawer (web/nav.js), not in the header.
  await page.click('.nav-burger');
  await wait(350);
  await page.click('.nav-drawer .lang [data-lang="uk"]');
  await page.click('.nav-drawer-close');
  await wait(300);
  return playLink;
}

try {
  /* ---------- 1. Empty IDs: nothing external loads ---------- */
  mode = 'empty';
  await session('empty-ids', async ({ page, requests }) => {
    await page.open(BASE);
    await wait(1500);
    const st = await page.eval(`({ enabled: window.qpAnalytics && window.qpAnalytics.enabled, bar: !!document.querySelector('.qp-consent'), ph: typeof window.posthog, cl: typeof window.clarity,
      css: !!document.querySelector('link[href*="consent.css"]') })`);
    ok('empty: analytics off, no consent bar, no posthog/clarity globals', !st.enabled && !st.bar && st.ph === 'undefined' && st.cl === 'undefined' && !st.css, JSON.stringify(st));
    await landingFlow(page);
    await page.open(BASE + 'play/');
    await page.open(BASE + 'spec/');
    await wait(500);
    ok('empty: no external requests besides fonts (landing flow, play, spec)', external(requests).length === 0, external(requests).slice(0, 3).join(' '));
  });

  /* ---------- 2. Do Not Track style signal (GPC) with fake IDs: still nothing loads ---------- */
  mode = 'fake';
  await session('gpc', async ({ page, requests }) => {
    await page.open(BASE);
    await wait(1500);
    ok('gpc: fake IDs set but nothing analytics-related requested', !requests.some(isAnalytics) && !(await page.eval(`!!document.querySelector('.qp-consent')`)));
  }, { gpc: true });

  /* ---------- 3. Fake IDs: scripts requested, consent, funnel order, play beacons, spec ---------- */
  await session('fake-ids', async ({ page, requests, intercepted }) => {
    await page.open(BASE);
    await page.waitFor(`document.querySelector('.qp-consent.is-on') ? true : null`, 6000);
    await wait(300);
    await page.send('Page.captureScreenshot', { format: 'png' }).then((r) => writeFileSync(join(REPO, 'shots', 'consent-375.png'), Buffer.from(r.data, 'base64')));
    ok('fake: PostHog loader requested (eu-assets array.js)', requests.some((u) => u === 'https://eu-assets.i.posthog.com/static/array.js'));
    ok('fake: Clarity not requested before consent', !requests.some((u) => /clarity\.ms/.test(u)));
    const ld = await page.eval(`(() => { try { const j = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
      return j['@graph'].map((x) => x['@type'] + ':' + (x.applicationCategory || '') + ':' + (x.offers ? x.offers.price : '')).join(','); } catch (e) { return 'ERR ' + e.message; } })()`);
    ok('JSON-LD parses (WebSite + SoftwareApplication, price 0)', ld === 'WebSite::,SoftwareApplication:EducationalApplication:0', ld);
    const head = await page.eval(`({ canon: document.querySelector('link[rel=canonical]').href, alt: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => l.hreflang).join(','),
      robots: document.querySelector('meta[name=robots]').content, verif: document.querySelectorAll('meta[name="google-site-verification"]').length })`);
    ok('head: canonical, hreflang en/uk/x-default, robots, no empty verification tag', head.canon === 'https://brrr28.github.io/quizpen/' && head.alt === 'en,uk,x-default' && head.robots === 'index,follow' && head.verif === 0, JSON.stringify(head));

    await page.click('[data-consent="yes"]');
    await page.waitFor(`document.querySelector('.qp-consent').hidden`);
    await wait(300);
    ok('consent: Clarity tag requested after Allow', requests.some((u) => u === `https://www.clarity.ms/tag/${FAKE.CLARITY_ID}`));
    const masks = await page.eval(`['#email', '#lesson', '#quiz-body', '#ref-link'].map((s) => document.querySelector(s).getAttribute('data-clarity-mask')).join(',')`);
    ok('consent: email, lesson, quiz and referral fields masked for Clarity', masks === 'True,True,True,True', masks);
    const cq = await page.eval(`JSON.stringify((window.clarity && window.clarity.q || []).map((a) => [...a]))`);
    ok('consent: Clarity consentv2 granted is queued', cq.includes('"consentv2",{"ad_Storage":"denied","analytics_Storage":"granted"}'), cq.slice(0, 160));
    ok('consent: PostHog replay started only after consent', (await page.eval(`(window.posthog || []).some((c) => Array.isArray(c) && c[0] === 'startSessionRecording')`)));

    const playLink = await landingFlow(page);
    const got = await captures(page);
    const names = got.map((c) => c.e);
    const expected = ['landing_viewed', 'consent_chosen', 'demo_started', 'quiz_generated', 'quiz_answered', 'quiz_completed', 'quiz_copied', 'share_opened',
      'student_preview_opened', 'signup_submitted', 'signup_succeeded', 'referral_link_copied', 'lang_switched'];
    const order = expected.map((e) => names.indexOf(e));
    ok('funnel: track() events fire in flow order', order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), names.join(' > '));
    const gen = got.find((c) => c.e === 'quiz_generated')?.p || {};
    ok('funnel: quiz_generated props {ok, ms, source}', gen.ok === true && gen.source === 'sample' && typeof gen.ms === 'number' && gen.ms >= 0, JSON.stringify(gen));
    const su = got.find((c) => c.e === 'signup_succeeded')?.p || {};
    ok('funnel: signup_succeeded props {already, has_ref, demo_used}', su.already === false && su.has_ref === false && su.demo_used === true, JSON.stringify(su));
    const answered = got.filter((c) => c.e === 'quiz_answered').length;
    ok('funnel: one quiz_answered per question', answered >= 3, String(answered));
    // demo_started.sample is the fixed preset id ("photosynthesis"), not visitor text, so it is checked on its own.
    const leak = JSON.stringify(got.map((c) => ({ ...c.p, sample: undefined }))).match(/@|photosynth|chloroplast|teacher/i);
    const sample = got.find((c) => c.e === 'demo_started')?.p.sample;
    ok('privacy: no email, lesson or quiz text in event props (only the preset sample id)', !leak && sample === 'photosynthesis', leak ? leak[0] : String(sample));
    const stored = await page.eval(`localStorage.getItem('qp_consent')`);
    ok('consent: choice stored in localStorage', /"choice":"granted"/.test(stored || ''), stored);

    await page.open(BASE + '?lang=uk');
    await wait(1200);
    const after = await page.eval(`({ bar: !!(document.querySelector('.qp-consent') && !document.querySelector('.qp-consent').hidden), canon: document.querySelector('link[rel=canonical]').href,
      settings: document.querySelector('.qp-consent-link')?.textContent || '' })`);
    ok('remembered: no bar on return, Clarity auto-loads', !after.bar && requests.filter((u) => /clarity\.ms\/tag/.test(u)).length >= 2, JSON.stringify(after));
    ok('seo: ?lang=uk canonical points to itself', after.canon === 'https://brrr28.github.io/quizpen/?lang=uk', after.canon);
    ok('consent: footer settings button in Ukrainian', after.settings === 'Налаштування аналітики', after.settings);
    await page.click('.qp-consent-link');
    await page.waitFor(`document.querySelector('.qp-consent.is-on') ? true : null`);
    const ukText = await page.eval(`document.querySelector('[data-consent="no"]').textContent`);
    await page.click('[data-consent="no"]');
    ok('withdraw: bar reopens in UA, "Ні, дякую" stores denied', ukText === 'Ні, дякую' && /"choice":"denied"/.test(await page.eval(`localStorage.getItem('qp_consent')`) || ''), ukText);
    const before = requests.filter((u) => /clarity\.ms/.test(u)).length;
    await page.open(BASE);
    await wait(1500);
    ok('withdraw: after reload no bar and no Clarity request', !(await page.eval(`!!(document.querySelector('.qp-consent') && !document.querySelector('.qp-consent').hidden)`)) &&
      requests.filter((u) => /clarity\.ms/.test(u)).length === before);

    // Student player: sends nothing even with IDs set (its page promises answers go nowhere).
    const n0 = intercepted.length, r0 = requests.length;
    await page.open(playLink);
    await page.click('.btn-primary');
    for (let i = 0; i < 10; i++) {
      const st = await page.waitFor(`document.querySelector('.screen-final') ? 'done' : (document.querySelector('button.opt:not([disabled])') ? 'q' : null)`);
      if (st === 'done') break;
      await page.click('button.opt:not([disabled])');
      await page.click('[data-next]');
    }
    await wait(600);
    const playExt = external(requests.slice(r0)).concat(intercepted.slice(n0).map((r) => r.url));
    const playGlobals = await page.eval(`typeof window.qpAnalytics + ',' + typeof window.posthog + ',' + typeof window.clarity`);
    ok('play: student quiz played to the end, no request leaves the site, no analytics globals', playExt.length === 0 && playGlobals === 'undefined,undefined,undefined', playExt.slice(0, 3).join(' ') + ' ' + playGlobals);
    const playHtml = readFileSync(join(WEB, 'play', 'index.html'), 'utf8') + readFileSync(join(WEB, 'play', 'play.js'), 'utf8');
    ok('play: no analytics include or track() call in web/play/ player files', !/analytics\.js|config\.js|track\(|posthog|clarity/i.test(playHtml));

    // Strict variant: PostHog signup events, no consent bar, no Clarity.
    await page.open(BASE + 'spec/');
    await page.eval(`document.getElementById('email').value = 'teacher@example.org'`);
    await page.click('#btn');
    await page.waitFor(`!document.getElementById('thanks').hidden`);
    const spec = (await captures(page)).map((c) => c.e).join(',');
    ok('spec: landing_viewed, signup_submitted, signup_succeeded; no bar', spec === 'landing_viewed,signup_submitted,signup_succeeded' && !(await page.eval(`!!document.querySelector('.qp-consent')`)), spec);
    const robots = await page.eval(`document.querySelector('meta[name=robots]').content`);
    ok('spec: robots noindex,follow', robots === 'noindex,follow', robots);

    // Sitemap is well-formed XML with both language URLs.
    const sm = await page.eval(`fetch('/sitemap.xml').then((r) => r.text()).then((t) => { const d = new DOMParser().parseFromString(t, 'application/xml');
      return d.querySelector('parsererror') ? 'ERR' : [...d.getElementsByTagName('loc')].map((l) => l.textContent).join(' '); })`);
    ok('sitemap.xml valid XML with en and uk URLs', sm === 'https://brrr28.github.io/quizpen/ https://brrr28.github.io/quizpen/?lang=uk', sm);
    const playRobots = readFileSync(join(WEB, 'play', 'index.html'), 'utf8').includes('<meta name="robots" content="noindex,follow">');
    ok('play: robots noindex,follow', playRobots);
  });
} finally {
  server.close();
  rmSync(PROFILE_BASE, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
const failed = results.filter((r) => !r).length;
console.log(`SUMMARY ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
