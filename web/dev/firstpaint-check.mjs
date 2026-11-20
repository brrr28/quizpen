// Headless first-paint check on a weak mobile connection.
// Usage: node web/dev/firstpaint-check.mjs   (stand ports 8080/8787/CDP 9339; one line per check, then
// "SUMMARY n/m passed"; exit 1 on any failure). On Node 20 add --experimental-websocket.
// Load: Slow 3G (400 kbps down and up, 400 ms RTT), CPU 4x slower, 375 px, first visit (no HTTP cache, no
// service worker), EN and UK. Measures first contentful paint, time to html.is-ready, CLS over the whole load
// including late fonts, and the loading bar (shown only after its delay, gone at ready). Also: a fast load never
// shows the bar, the bar is absent without JS, static under reduced motion, fixed, painted in both themes.

import { startStand, BASE } from './stand.mjs';

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const CLS_MAX = 0.001;
const BAR_DELAY = 500; // styles.css: the bar fades in only after this delay
const r0 = (v) => (v === null || v === undefined ? 'n/a' : Math.round(v));

const s = await startStand();
const { page } = s;
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__fp = { cls: 0, n: 0, src: [], fcp: null, app: null, ready: null, barOn: null, barOff: null, fontsAt: null, wf: null };
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) {
        __fp.cls += e.value; __fp.n++;
        if (__fp.src.length < 12) __fp.src.push({ v: +e.value.toFixed(5), t: Math.round(e.startTime), nodes: (e.sources || []).map((x) => {
          let n = x.node; if (n && n.nodeType === 3) n = n.parentElement;
          if (!n) return '?';
          const r = (q) => Math.round(q.x) + ',' + Math.round(q.y) + ' ' + Math.round(q.width) + 'x' + Math.round(q.height);
          return n.nodeName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\\s+/).join('.') : '') + ' ' + r(x.previousRect) + ' -> ' + r(x.currentRect);
        }) });
      } }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') __fp.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
    } catch (e) { /* no observer support */ }
    try { document.fonts.addEventListener('loadingdone', () => { __fp.fontsAt = performance.now(); }); } catch (e) { /* no FontFaceSet */ }
    (function tick() {
      const d = document.documentElement, now = performance.now();
      if (d) {
        if (__fp.app === null && window.QP_I18N) __fp.app = now;
        if (__fp.ready === null && d.classList.contains('is-ready')) __fp.ready = now;
        if (__fp.wf === null && d.classList.contains('wf')) __fp.wf = now;
        const cs = getComputedStyle(d, '::before');
        const on = cs.content !== 'none' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.5 && parseFloat(cs.height) > 0;
        if (on && __fp.barOn === null) __fp.barOn = now;
        if (!on && __fp.barOn !== null && __fp.barOff === null) __fp.barOff = now;
      }
      if (now < 90000) requestAnimationFrame(tick);
    })();
  ` });
  await page.send('Network.setBypassServiceWorker', { bypass: true });
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  const media = (features) => page.send('Emulation.setEmulatedMedia', { features });
  const slow = (on) => Promise.all([
    page.send('Network.emulateNetworkConditions', on
      ? { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 }
      : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }),
    page.send('Emulation.setCPUThrottlingRate', { rate: on ? 4 : 1 }),
  ]);
  const fresh = async () => {
    await slow(false);
    await page.goto(BASE + '?nosw=1');
    await page.eval('localStorage.clear(); sessionStorage.clear(); true');
    await page.send('Network.clearBrowserCache');
  };
  // Waits for ready, the one-step web font switch (html.wf), fonts and a quiet tail, then returns the measurements.
  const measure = async (quietMs) => {
    await page.waitFor(`__fp.ready !== null || __fp.app !== null`, 90000);
    await page.waitFor(`typeof window.qpFontsCss !== 'function' || document.documentElement.classList.contains('wf')`, 90000);
    await page.waitFor(`document.fonts.status === 'loaded'`, 90000);
    await s.wait(quietMs);
    return page.eval(`(() => {
      const css = performance.getEntriesByType('resource').find((r) => r.name.includes('fonts.googleapis.com/css2'));
      return Object.assign({}, __fp, { cls: +__fp.cls.toFixed(5), fontsCss: css ? { block: css.renderBlockingStatus, end: Math.round(css.responseEnd) } : null });
    })()`);
  };

  await page.viewport(375, 812, true, 2);
  await media([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
  for (const lang of ['en', 'uk']) {
    await fresh();
    await slow(true);
    await page.goto(BASE + '?lang=' + lang);
    const m = await measure(2500);
    await slow(false);
    const ready = m.ready ?? m.app;
    console.log(`METRIC ${lang} slow3g fcp=${r0(m.fcp)}ms ready=${r0(ready)}ms fonts=${r0(m.fontsAt)}ms wf=${r0(m.wf)}ms cls=${m.cls} shifts=${m.n} barOn=${r0(m.barOn)} barOff=${r0(m.barOff)} fontsCss=${JSON.stringify(m.fontsCss)}`);
    ok(`${lang} slow 3G: first contentful paint before the scripts are ready`, m.fcp !== null && ready !== null && m.fcp < ready, `fcp ${r0(m.fcp)} ms, ready ${r0(ready)} ms`);
    ok(`${lang} slow 3G: fonts stylesheet does not block rendering`, m.fontsCss && m.fontsCss.block === 'non-blocking', JSON.stringify(m.fontsCss));
    ok(`${lang} slow 3G: html.is-ready set by app.js`, m.ready !== null, `ready ${r0(m.ready)} ms`);
    ok(`${lang} slow 3G: CLS over the whole load <= ${CLS_MAX}`, m.cls <= CLS_MAX, `cls ${m.cls}, entries ${m.n}${m.n ? ' ' + JSON.stringify(m.src.slice(0, 6)) : ''}`);
    ok(`${lang} slow 3G: loading bar appears after its delay`, m.barOn !== null && m.fcp !== null && m.barOn >= m.fcp + BAR_DELAY - 100, `fcp ${r0(m.fcp)}, bar on ${r0(m.barOn)}`);
    ok(`${lang} slow 3G: loading bar disappears at ready`, m.barOff !== null && m.ready !== null && m.barOff >= m.ready - 50 && m.barOff <= m.ready + 500, `ready ${r0(m.ready)}, bar off ${r0(m.barOff)}`);
  }

  // A fast load (no throttling) is ready before the delay ends, so the bar never shows.
  {
    await fresh();
    await page.goto(BASE + '?lang=en');
    const m = await measure(300);
    ok('fast load: loading bar never shown', m.ready !== null && m.barOn === null && m.ready < BAR_DELAY, `ready ${r0(m.ready)} ms, bar on ${r0(m.barOn)}`);
  }

  // Bar styles while loading: html.is-ready removed by hand to inspect the pending state.
  const barStyle = () => page.eval(`(() => {
    const d = document.documentElement; d.classList.remove('is-ready');
    const cs = getComputedStyle(d, '::before');
    const r = { content: cs.content, position: cs.position, bg: cs.backgroundColor, img: cs.backgroundImage, anim: cs.animationName, h: cs.height };
    d.classList.add('is-ready');
    return r;
  })()`);
  for (const theme of ['light', 'dark']) {
    await media([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.goto(BASE + '?lang=en');
    const b = await barStyle();
    const painted = b.content !== 'none' && b.bg !== 'rgba(0, 0, 0, 0)' && b.img === 'none';
    ok(`${theme}: bar fixed, solid colour, no layout box`, painted && b.position === 'fixed' && parseFloat(b.h) <= 4, JSON.stringify(b));
  }
  await media([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(BASE + '?lang=en');
  {
    const b = await barStyle();
    ok('reduced motion: static bar (no sliding animation)', b.content !== 'none' && !/slide/.test(b.anim), JSON.stringify(b));
  }
  await media([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);

  // Without JS there is no 'js' class and no bar.
  await page.send('Emulation.setScriptExecutionDisabled', { value: true });
  await page.goto(BASE + '?lang=en');
  {
    const r = await page.eval(`({ cls: document.documentElement.className, content: getComputedStyle(document.documentElement, '::before').content })`);
    ok('no JS: no loading bar', !/\bjs\b/.test(r.cls) && r.content === 'none', JSON.stringify(r));
  }
  await page.send('Emulation.setScriptExecutionDisabled', { value: false });
} catch (e) {
  ok('run finished', false, String(e && e.stack || e).slice(0, 400));
} finally {
  await s.stop();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`SUMMARY ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
