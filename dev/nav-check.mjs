// Headless check of the landing navigation (web/nav.js + web/nav.css): smooth in-page links, focus,
// scrollspy, the desktop rail, the mobile drawer keyboard flow, overflow, layout shifts and both themes.
// Usage: node web/dev/nav-check.mjs   (one line per check, exit 1 on any failure; screenshots go to shots/)

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStand, BASE } from './stand.mjs';

const SHOTS = resolve(dirname(fileURLToPath(import.meta.url)), '../../shots');
mkdirSync(SHOTS, { recursive: true });
const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const s = await startStand();
const { page, wait } = s;
const J = JSON.stringify;

// Layout shifts from the very first paint, and every nav_click event.
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__shifts = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__shifts.push({ v: e.value, input: e.hadRecentInput,
    src: (e.sources || []).map((x) => x.node ? x.node.nodeName + '.' + (x.node.className || '') : '?').join(',') })))
    .observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  window.__nav = [];
  document.addEventListener('DOMContentLoaded', () => {
    const a = window.qpAnalytics; if (!a) return;
    const o = a.track; a.track = function (n, p) { if (n === 'nav_click') window.__nav.push(p && p.target); return o.apply(this, arguments); };
  });` });

const shiftSum = () => page.eval(`window.__shifts.reduce((a, e) => a + e.v, 0)`);
const shiftSrc = () => page.eval(`window.__shifts.map((e) => e.v.toFixed(4) + ' ' + e.src).join(' | ')`);
const frames = (n = 3) => page.eval(`new Promise((r) => { let i = 0; const f = () => (++i >= ${n} ? r(true) : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
// Resolves once scrollY has not changed for 10 frames (smooth scroll finished).
const settle = () => page.eval(`new Promise((r) => { let last = -1, same = 0, n = 0; const f = () => { const y = scrollY;
  if (y === last) { if (++same > 10) return r(y); } else { same = 0; last = y; } if (++n > 600) return r(y); requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
const KEYS = { Tab: [9, 'Tab'], Enter: [13, 'Enter'], Escape: [27, 'Escape'] };
async function key(k, modifiers = 0) {
  const [vk, code] = KEYS[k];
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers, ...(k === 'Enter' ? { text: '\r' } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
}
async function mouse(x, y, types = ['mouseMoved', 'mousePressed', 'mouseReleased']) {
  for (const type of types) await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
}
// Clicks an element where it is now (no scrolling first, unlike page.click).
async function clickEl(sel) {
  const b = await page.eval(`(() => { const el = document.querySelector(${J(sel)}); if (!el) return null;
    const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!b) throw new Error('no element ' + sel);
  await mouse(b.x, b.y);
}
// Where a section's heading landed: below the header, inside the viewport, focused, marked active.
const landed = (id) => page.eval(`(() => { const s = document.getElementById(${J(id)});
  const h = document.getElementById(s.getAttribute('aria-labelledby')) || s.querySelector('h1, h2');
  const hb = document.querySelector('.site-header').getBoundingClientRect().bottom, r = h.getBoundingClientRect();
  const cur = document.querySelector('.nav-rail [aria-current]');
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), hb: Math.round(hb), vh: innerHeight, focused: document.activeElement === h,
    active: cur && cur.getAttribute('data-nav-target'), hash: location.hash, nav: window.__nav.slice(-1)[0] }; })()`);
const isLanded = (l) => l.top >= l.hb && l.bottom <= l.vh && l.focused;
const toTop = () => page.eval(`window.scrollTo({ top: 0, behavior: 'instant' }); true`);
async function load(width, height, mobile, theme = 'light', query = '?lang=en') {
  await page.viewport(width, height, mobile);
  await page.goto(BASE + query);
  await page.eval(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('qp_theme', ${J(theme)}); true`);
  await page.goto(BASE + query);
  await page.waitFor(`document.querySelector('.nav-rail') && document.querySelector('[data-counter].is-ready')`);
  await frames(4);
}

try {
  /* ---------- Desktop 1440 ---------- */
  s.errors.length = 0;
  await load(1440, 900, false);
  const ids = await page.eval(`[...document.querySelectorAll('.nav-rail [data-nav-target]')].map((a) => a.getAttribute('data-nav-target'))`);
  ok('desktop: rail lists every section', J(ids) === J(['top', 'how', 'vs', 'students', 'demo', 'features', 'why', 'faq', 'final']), J(ids));
  const railBox = await page.eval(`(() => { const r = document.querySelector('.nav-rail').getBoundingClientRect(); return { w: r.width, right: innerWidth - r.right, burger: getComputedStyle(document.querySelector('.nav-burger')).display, drawer: getComputedStyle(document.querySelector('.nav-drawer')).display }; })()`);
  ok('desktop: rail shown, burger and drawer hidden', railBox.w > 0 && railBox.right >= 0 && railBox.burger === 'none' && railBox.drawer === 'none', J(railBox));

  // Scrollspy at several positions (fresh page, no click pin): each section's top just under the header.
  const spots = await page.eval(`(() => { const hb = document.querySelector('.site-header').getBoundingClientRect().bottom, max = document.documentElement.scrollHeight - innerHeight;
    return [...document.querySelectorAll('main > section[id]')].map((s) => { const y = Math.round(s.getBoundingClientRect().top + scrollY - hb + 20);
      return { id: s.id, y: Math.max(0, Math.min(y, max)), clamped: y >= max }; }); })()`);
  const spyOut = [];
  for (const sp of spots) {
    await page.eval(`window.scrollTo({ top: ${sp.y}, behavior: 'instant' }); true`);
    await frames(4);
    const act = await page.eval(`(document.querySelector('.nav-rail [aria-current]') || {}).getAttribute?.call(document.querySelector('.nav-rail [aria-current]'), 'data-nav-target')`);
    const want = sp.clamped ? 'final' : sp.id;
    spyOut.push(sp.id + '@' + sp.y + '=' + act + (act === want ? '' : '(want ' + want + ')'));
  }
  ok(`desktop: scrollspy marks the section under the header at ${spots.length} positions`, spyOut.every((x) => !x.includes('want')), spyOut.join(' '));
  for (const [y, want] of [[0, 'top'], ['max', 'final']]) {
    await page.eval(`window.scrollTo({ top: ${y === 'max' ? 'document.documentElement.scrollHeight' : y}, behavior: 'instant' }); true`);
    await frames(4);
    const act = await page.eval(`document.querySelector('.nav-rail [aria-current]')?.getAttribute('data-nav-target')`);
    ok(`desktop: scrollspy at ${y === 'max' ? 'page end' : 'page top'} = ${want}`, act === want, act);
  }
  const headerNav = await page.eval(`[...document.querySelectorAll('.site-header .nav a[aria-current]')].map((a) => a.getAttribute('href'))`);
  ok('desktop: header nav has no active link on the final section', headerNav.length === 0, J(headerNav));

  // Clicks: header nav, "Try it" link in the hero, every rail dot.
  const clicks = [['.site-header .nav a[href="#demo"]', 'demo'], ['.site-header .nav a[href="#faq"]', 'faq'], ['.try-link', 'demo']]
    .concat(ids.map((id) => [`.nav-rail [data-nav-target="${id}"]`, id]));
  for (const [sel, id] of clicks) {
    await toTop(); await frames(2);
    if (id === 'top') await page.eval(`window.scrollTo({ top: 1500, behavior: 'instant' }); true`);
    if (sel === '.try-link') { await page.eval(`document.querySelector('.try-link').scrollIntoView({ block: 'center', behavior: 'instant' }); true`); await frames(2); }
    await clickEl(sel);
    const moving = await page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(scrollY))))`);
    await settle();
    const l = await landed(id);
    ok(`desktop: ${sel} lands on #${id}`, isLanded(l) && l.active === id && l.nav === id && l.hash === '#' + id,
      J({ ...l, firstFrames: moving }));
  }
  // Smooth: a long jump takes several frames.
  await toTop(); await frames(2);
  await clickEl('.nav-rail [data-nav-target="faq"]');
  await wait(150);
  const mid = await page.eval('scrollY');
  const end = await settle();
  ok('desktop: scrolling is smooth (part way after 150 ms)', mid > 0 && mid < end, `after 150 ms ${mid}, end ${end}`);
  const hdrFaq = await page.eval(`document.querySelector('.site-header .nav a[href="#faq"]').getAttribute('aria-current')`);
  ok('desktop: header nav marks FAQ after jumping there', hdrFaq === 'location', String(hdrFaq));

  // Keyboard: focus a rail dot, its label shows, Enter jumps and moves focus to the heading.
  await toTop(); await frames(2);
  await page.eval(`document.querySelector('.nav-rail [data-nav-target="features"]').focus(); true`);
  await key('Tab', 8); await key('Tab'); // real keyboard focus so :focus-visible applies
  await wait(260);
  const lab = await page.eval(`(() => { const a = document.activeElement; const l = a.querySelector('.nav-rail-link-label'); return { id: a.getAttribute('data-nav-target'), op: l && getComputedStyle(l).opacity, text: l && l.textContent }; })()`);
  ok('desktop: rail label shows on keyboard focus', lab.id === 'features' && lab.op === '1' && lab.text === 'Features', J(lab));
  await key('Enter');
  await settle();
  const kl = await landed('features');
  ok('desktop: Enter on a rail dot lands and focuses the heading', isLanded(kl) && kl.active === 'features', J(kl));

  // Screenshot: mid page with a hovered rail label.
  await page.eval(`document.activeElement.blur(); true`);
  const why = await page.eval(`(() => { const a = document.querySelector('.nav-rail [data-nav-target="why"]').getBoundingClientRect(); return { x: a.left + a.width / 2, y: a.top + a.height / 2 }; })()`);
  await mouse(why.x, why.y, ['mouseMoved']);
  await wait(300);
  await page.shot(resolve(SHOTS, 'rail-1440.png'));
  const hov = await page.eval(`getComputedStyle(document.querySelector('.nav-rail [data-nav-target="why"] .nav-rail-link-label')).opacity`);
  ok('desktop: rail label shows on hover', hov === '1', hov);
  await mouse(10, 450, ['mouseMoved']);

  // Both themes: the active dot stays visible against the page.
  for (const theme of ['light', 'dark']) {
    await page.eval(`document.documentElement.setAttribute('data-theme', ${J(theme)}); true`);
    await frames(2);
    const c = await page.eval(`(() => { const d = document.querySelector('.nav-rail [aria-current] .nav-rail-link-dot'); return { dot: getComputedStyle(d).backgroundColor, page: getComputedStyle(document.body).backgroundColor }; })()`);
    ok(`desktop ${theme}: active rail dot contrasts with the page`, c.dot !== c.page, J(c));
  }
  await page.eval(`document.documentElement.setAttribute('data-theme', 'light'); true`);

  // Load shifts with and without nav.js/nav.css (3 loads each). The page has a small, timing-dependent
  // header shift of its own (label reservation); the navigation must not add sources or size to it.
  const loads = { bare: [], nav: [] };
  let navSrc = '';
  for (let i = 0; i < 3; i++) {
    await page.send('Network.setBlockedURLs', { urls: ['*nav.js', '*nav.css'] });
    await page.viewport(1440, 900, false);
    await page.goto(BASE + '?lang=en');
    await wait(1000);
    loads.bare.push(+(await shiftSum()).toFixed(4));
    await page.send('Network.setBlockedURLs', { urls: [] });
    await load(1440, 900, false);
    await wait(1000);
    loads.nav.push(+(await shiftSum()).toFixed(4));
    navSrc += ',' + await page.eval(`window.__shifts.map((e) => e.src).join(',')`);
  }
  const navOwned = /nav-(rail|drawer|burger|reveal|end)/.test(navSrc);
  ok('desktop: no nav element shifts on load', !navOwned, `sources: ${[...new Set(navSrc.split(',').filter(Boolean))].join(', ') || 'none'}`);
  console.log(`INFO load shift (page's own header race, not nav): with nav ${J(loads.nav)}, without ${J(loads.bare)}`);

  // Layout shifts while scrolling the whole page with the wheel (reveal included).
  const before = await shiftSum();
  for (let i = 0; i < 40; i++) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: 220 });
    await wait(40);
  }
  await settle(); await wait(800);
  const after = await shiftSum();
  ok('desktop: CLS 0 while scrolling the whole page (reveal on)', after - before === 0, `scroll ${(after - before).toFixed(4)}`);
  const rev = await page.eval(`({ all: document.querySelectorAll('.nav-reveal').length, shown: document.querySelectorAll('.nav-reveal.is-in').length })`);
  ok('desktop: every reveal block is shown after scrolling past it', rev.all > 0 && rev.all === rev.shown, J(rev));

  // Counter tick: the mock has few signups, so the stats answer is replaced with 1234 for this step.
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*action=stats*' }] });
  const onPaused = (p) => page.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
    body: Buffer.from('{"ok":true,"total":1234}').toString('base64') }).catch(() => {});
  page.on('Fetch.requestPaused', onPaused);
  await load(1440, 900, false);
  await wait(900);
  const hero = await page.eval(`document.querySelector('.hero .counter-text').textContent`);
  const tick0 = await shiftSum();
  await page.eval(`window.scrollTo({ top: document.querySelector('.counter-lg').getBoundingClientRect().top + scrollY - 400, behavior: 'instant' }); true`);
  await wait(200);
  const midTick = await page.eval(`document.querySelector('.counter-lg .counter-text').textContent`);
  await wait(900);
  const endTick = await page.eval(`document.querySelector('.counter-lg .counter-text').textContent`);
  const tick1 = await shiftSum();
  const num = (x) => Number((x.match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, ''));
  ok('desktop: lower counter ticks up when it first appears, same width', hero.includes('1,234') && num(midTick) >= 1000 && num(midTick) < 1234 && endTick.includes('1,234') && tick1 - tick0 === 0,
    J({ hero, midTick, endTick, shift: tick1 - tick0 }));
  await page.send('Fetch.disable');

  // Reduced motion: the jump is instant and nothing is hidden for reveal.
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await load(1440, 900, false);
  const hidden = await page.eval(`document.querySelectorAll('.nav-reveal').length`);
  await clickEl('.site-header .nav a[href="#faq"]');
  const rl = await landed('faq');
  ok('reduced motion: link jumps at once, no reveal hiding', isLanded(rl) && hidden === 0, J({ ...rl, hidden }));
  await page.send('Emulation.setEmulatedMedia', { features: [] });
  ok('desktop: no console errors', s.errors.length === 0, s.errors.join(' || ').slice(0, 600));

  /* ---------- Mobile 375 ---------- */
  s.errors.length = 0;
  await load(375, 812, true);
  const m = await page.eval(`(() => { const d = (sel) => getComputedStyle(document.querySelector(sel)).display;
    window.scrollTo({ left: 400, top: 0, behavior: 'instant' });
    return { sw: document.documentElement.scrollWidth, vw: innerWidth, sx: scrollX, lang: d('.site-header .lang'), theme: d('.site-header [data-theme-toggle]'), burger: d('.nav-burger'), rail: d('.nav-rail') }; })()`);
  ok('375: no horizontal overflow', m.sw <= m.vw && m.sx === 0, J(m));
  ok('375: header language and theme hidden, burger shown, no rail', m.lang === 'none' && m.theme === 'none' && m.burger !== 'none' && m.rail === 'none', J(m));

  const st = () => page.eval(`(() => { const dr = document.querySelector('.nav-drawer'), p = dr.querySelector('.nav-drawer-panel'), a = document.activeElement;
    return { open: dr.classList.contains('is-open'), expanded: document.querySelector('.nav-burger').getAttribute('aria-expanded'),
      inside: p.contains(a), onBurger: a === document.querySelector('.nav-burger'), lock: getComputedStyle(document.documentElement).overflowY,
      mainInert: document.getElementById('main').inert, focus: a.className || a.tagName,
      sw: document.documentElement.scrollWidth, vw: innerWidth }; })()`);
  // Keyboard: open with Enter, Tab cycles inside, Shift+Tab wraps, Esc closes, focus returns.
  await page.eval(`window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.nav-burger').focus(); true`);
  const shift0 = await shiftSum();
  await key('Enter');
  await wait(350);
  const o1 = await st();
  ok('375: Enter opens the drawer and moves focus into it', o1.open && o1.expanded === 'true' && o1.inside && o1.lock === 'hidden' && o1.mainInert && o1.sw <= o1.vw, J(o1));
  const n = await page.eval(`[...document.querySelectorAll('.nav-drawer-panel a[href], .nav-drawer-panel button')].filter((e) => e.getClientRects().length).length`);
  const first = await page.eval(`document.activeElement.className`);
  let stayed = true, back = false;
  for (let i = 0; i < n; i++) {
    await key('Tab');
    const x = await st();
    if (!x.inside) stayed = false;
    if (i === n - 1) back = x.focus === first;
  }
  ok(`375: Tab cycles inside the drawer (${n} stops, wraps to the first)`, stayed && back, first);
  await key('Tab', 8);
  const lastEl = await page.eval(`document.activeElement.getAttribute('aria-pressed') !== null || document.activeElement.hasAttribute('data-theme-toggle')`);
  ok('375: Shift+Tab from the first stop wraps to the last', lastEl, await page.eval(`document.activeElement.outerHTML.slice(0, 80)`));
  // Wheel over the drawer must not scroll the page.
  const y0 = await page.eval('scrollY');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 20, y: 400, deltaX: 0, deltaY: 400 });
  await wait(250);
  ok('375: page does not scroll under the open drawer', (await page.eval('scrollY')) === y0);
  await page.shot(resolve(SHOTS, 'drawer-open-375.png'));
  await key('Escape');
  await wait(350);
  const c1 = await st();
  ok('375: Esc closes the drawer and focus returns to the menu button', !c1.open && c1.expanded === 'false' && c1.onBurger && c1.lock !== 'hidden' && !c1.mainInert, J(c1));

  // Overlay click closes and returns focus.
  await clickEl('.nav-burger');
  await wait(350);
  await mouse(16, 500);
  await wait(350);
  const c2 = await st();
  ok('375: overlay click closes the drawer, focus on the menu button', !c2.open && c2.onBurger, J(c2));

  // Language and theme from the drawer (their own text reflow is measured apart from the drawer).
  const sl0 = await shiftSum();
  await clickEl('.nav-burger');
  await wait(350);
  await clickEl('.nav-drawer .lang [data-lang="uk"]');
  await frames(3);
  const lu = await page.eval(`({ lang: document.documentElement.lang, faq: document.querySelector('.nav-drawer [data-nav-target="faq"]').textContent, rail: document.querySelector('.nav-rail [data-nav-target="why"]').textContent, h1: document.getElementById('hero-title').textContent.slice(0, 20), pressed: document.querySelector('.nav-drawer .lang [data-lang="uk"]').getAttribute('aria-pressed') })`);
  ok('375: drawer language switch works and relabels nav', lu.lang === 'uk' && lu.faq.includes('Питання') && lu.rail.includes('Дослідження') && lu.pressed === 'true', J(lu));
  await clickEl('.nav-drawer .lang [data-lang="en"]');
  await frames(3);
  await clickEl('.nav-drawer [data-theme-toggle]');
  await wait(450);
  const th = await page.eval(`({ theme: document.documentElement.getAttribute('data-theme'), pressed: [...document.querySelectorAll('[data-theme-toggle]')].map((b) => b.getAttribute('aria-pressed')), panel: getComputedStyle(document.querySelector('.nav-drawer-panel')).backgroundColor, open: document.querySelector('.nav-drawer').classList.contains('is-open') })`);
  ok('375: drawer theme toggle switches to dark and syncs both toggles', th.theme === 'dark' && th.pressed.every((p) => p === 'true') && th.open, J(th));
  await page.shot(resolve(SHOTS, 'drawer-open-375-dark.png'));
  await clickEl('.nav-drawer [data-theme-toggle]');
  await wait(450);

  const sl1 = await shiftSum();
  // Drawer link: closes, scrolls smoothly, focuses the heading.
  await clickEl('.nav-drawer [data-nav-target="faq"]');
  const dm = await page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(scrollY))))`);
  await settle();
  const dl = await landed('faq');
  const c3 = await st();
  const act = await page.eval(`document.querySelector('.nav-drawer [aria-current]')?.getAttribute('data-nav-target')`);
  ok('375: drawer link closes the drawer and lands on the section', !c3.open && isLanded(dl) && dl.nav === 'faq' && act === 'faq', J({ ...dl, smoothAt2Frames: dm, act }));
  const shift1 = await shiftSum();
  const drawerOnly = (shift1 - shift0) - (sl1 - sl0);
  ok('375: no layout shift from the drawer (open, Tab, Esc, overlay, link jump)', Math.abs(drawerOnly) < 1e-9, `drawer ${drawerOnly.toFixed(4)}; language switch reflow (after input, not CLS) ${(sl1 - sl0).toFixed(4)}`);
  const cls = await page.eval(`window.__shifts.filter((e) => !e.input).reduce((a, e) => a + e.v, 0)`);
  ok('375: CLS 0 (shifts without recent input) on this page session', cls === 0, cls.toFixed(4));

  // Dark theme at 375: drawer opens, overflow still none.
  await load(375, 812, true, 'dark');
  await clickEl('.nav-burger');
  await wait(350);
  const dk = await st();
  ok('375 dark: drawer opens, no overflow', dk.open && dk.inside && dk.sw <= dk.vw, J(dk));
  await key('Escape');
  ok('375: no console errors', s.errors.length === 0, s.errors.join(' || ').slice(0, 600));
} catch (e) {
  ok('nav-check run', false, e.stack || String(e));
} finally {
  await s.stop();
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
