// Screenshots, OG image, flow recording and page weight from headless Chrome.
// Usage: node web/dev/shoot.mjs shots|sections|og|record|weight
// The mock writes placeholder questions, so for pictures the quiz request is answered
// with the prepared sample quiz (same shape as a live answer, see API.md).

import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStand, BASE } from './stand.mjs';

const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SHOTS = resolve(REPO, 'shots');
const SAMPLES = JSON.parse(readFileSync(resolve(REPO, 'web/data/samples.json'), 'utf8')).samples;
const mode = process.argv[2] || 'shots';
mkdirSync(SHOTS, { recursive: true });

// Fixed stand ports: next to another run the pictures would come from its server and browser tab.
if (await fetch(BASE).then(() => true, () => false)) {
  console.error('stand busy: ' + BASE + ' already answers (another check or shoot is running); try again when it ends');
  process.exit(75);
}
const s = await startStand();
const { page } = s;

// Answer quiz requests with the sample quiz after a short "thinking" delay;
// with quizDisabled the answer is the backend's "disabled" (early access).
let quizDisabled = false;
async function interceptQuiz(delayMs = 1600) {
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api*', requestStage: 'Request' }] });
  page.on('Fetch.requestPaused', async (p) => {
    let body = {};
    try { body = JSON.parse(p.request.postData || '{}'); } catch { /* GET */ }
    if (body.action !== 'quiz') return page.send('Fetch.continueRequest', { requestId: p.requestId });
    const sample = SAMPLES.find((x) => x.id === body.sample) || SAMPLES[0];
    const json = JSON.stringify(quizDisabled ? { ok: false, error: 'disabled' } : { ok: true, quiz: sample.quiz[body.lang === 'uk' ? 'uk' : 'en'] });
    await s.wait(delayMs);
    await page.send('Fetch.fulfillRequest', {
      requestId: p.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
      body: Buffer.from(json).toString('base64'),
    });
  });
}

// theme: the system colour scheme the page sees on a first visit (no saved choice). Headless Chrome
// otherwise follows the OS setting, so pictures meant to be light could come out dark.
async function fresh(lang, w, h, mobile, theme = 'light') {
  await page.viewport(w, h, mobile, mobile ? 2 : 1);
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  await page.goto(BASE + '?lang=' + lang);
  await page.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await page.goto(BASE + '?lang=' + lang);
  await page.waitFor(`document.querySelector('[data-counter].is-ready') && document.querySelector('#sample-chips .chip')`);
  const got = await page.eval(`document.documentElement.getAttribute('data-theme')`);
  if (got !== theme) throw new Error(`page theme is ${got}, expected ${theme}`);
  await s.wait(300);
}
const scrollTo = (expr) => page.eval(`(() => { ${expr}; return true; })()`).then(() => s.wait(500));
const demoTop = (mobile) => scrollTo(mobile
  ? `document.getElementById('quiz-panel').scrollIntoView({ block: 'start' }); scrollBy(0, -12)`
  : `document.getElementById('demo').scrollIntoView({ block: 'start' })`);

// Ready examples: a chip, "Show" (the quiz is local, no API call), then the right answer to question 1.
async function showSample(id, lang, answer = true) {
  const sample = SAMPLES.find((x) => x.id === id);
  await page.click(`.chip[data-sample="${id}"]`);
  await s.wait(200);
  await page.click('#show-btn');
  await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 8000);
  await s.wait(300);
  if (answer) {
    await page.click(`.opt[data-k="${(sample.quiz[sample.lang || lang] || sample.quiz.en).questions[0].answer}"]`);
    await s.wait(500);
  }
}

// Your text: paste the example text, generate; the live answer is the intercepted sample quiz.
async function answerFirst(lang) {
  const sample = SAMPLES.find((x) => x.id === 'photosynthesis');
  await page.click('#tab-own');
  await s.wait(300);
  await page.type('#lesson', sample.text[lang] || sample.text.en);
  await page.click('#gen-btn');
  await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 15000);
  await page.click(`.opt[data-k="${sample.quiz[lang].questions[0].answer}"]`);
  await s.wait(500);
}

async function shots() {
  await interceptQuiz(900);
  const lang = process.env.SHOT_LANG || 'en';
  for (const [w, h, mobile] of [[1440, 900, false], [375, 812, true]]) {
    await fresh(lang, w, h, mobile);
    await scrollTo('scrollTo(0, 0)');
    await s.wait(3200); // let the hero illustration finish its answer animation
    await page.shot(resolve(SHOTS, `hero-${w}.png`));

    await showSample('photosynthesis', lang);
    await demoTop(mobile);
    await page.shot(resolve(SHOTS, `demo-samples-${w}.png`));

    await answerFirst(lang);
    await demoTop(mobile);
    await page.shot(resolve(SHOTS, `demo-${w}.png`));

    await scrollTo('scrollTo(0, 0)');
    await page.type('#email', `maria.${w}@school.org`);
    await page.click('#join-btn');
    await page.waitFor(`!document.getElementById('thanks').hidden`, 8000);
    await scrollTo(mobile ? `document.getElementById('thanks').scrollIntoView({ block: 'center' })` : 'scrollTo(0, 0)');
    await s.wait(2200);
    await page.shot(resolve(SHOTS, `thanks-${w}.png`));
  }

  // Your text while the quiz API is off: the early-access panel with its inline email form.
  quizDisabled = true;
  await fresh(lang, 375, 812, true);
  await page.click('#tab-own');
  await s.wait(300);
  const photo = SAMPLES.find((x) => x.id === 'photosynthesis');
  await page.type('#lesson', photo.text[lang] || photo.text.en);
  await page.click('#gen-btn');
  await page.waitFor(`document.querySelector('#quiz-body .ea')`, 8000);
  await demoTop(true);
  await page.shot(resolve(SHOTS, 'demo-early-access-375.png'));
  quizDisabled = false;

  // Ready examples in the dark theme.
  await fresh(lang, 375, 812, true, 'dark');
  await showSample('photosynthesis', lang);
  await demoTop(true);
  await page.shot(resolve(SHOTS, 'demo-samples-375-dark.png'));
  console.log('shots written to', SHOTS);
}

// The lower sections (features, why, FAQ with the first answer open, the tear-off CTA) at 1440 and 375,
// light and dark: each one whole, from 24px above its top to 24px below its bottom.
async function sections() {
  const lang = process.env.SHOT_LANG || 'en';
  for (const [w, h, mobile] of [[1440, 900, false], [375, 812, true]]) {
    for (const theme of ['light', 'dark']) {
      await fresh(lang, w, h, mobile, theme);
      // Sections below the first screen fade in on scroll (nav.js); a section taller than the viewport would be
      // captured half revealed, so show them all, and shoot from the top so the sticky header covers nothing.
      await page.eval(`document.querySelector('#faq details').open = true; document.querySelectorAll('.nav-reveal').forEach((e) => e.classList.add('is-in')); true`);
      await s.wait(900);
      await scrollTo('scrollTo(0, 0)');
      for (const id of ['features', 'why', 'faq', 'final']) {
        const r = await page.eval(`(() => { const b = document.getElementById('${id}').getBoundingClientRect(); return { y: b.top + scrollY, h: b.height }; })()`);
        const clip = { x: 0, y: Math.max(0, Math.round(r.y) - 24), width: w, height: Math.ceil(r.h) + 48, scale: 1 };
        const out = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
        writeFileSync(resolve(SHOTS, `section-${id}-${w}${theme === 'dark' ? '-dark' : ''}.png`), Buffer.from(out.data, 'base64'));
      }
    }
  }
  console.log('section shots written to', SHOTS);
}

async function og() {
  await page.viewport(1200, 630, false, 1);
  await page.goto(BASE + 'dev/og.html');
  await s.wait(300);
  await page.shot(resolve(REPO, 'web/og.png'));
  console.log('og.png written');
}

// Screencast of the main flow; frames go to a temp folder, ffmpeg turns them into a GIF.
async function record() {
  await interceptQuiz(1500);
  const W = 1280, H = 800;
  await fresh('en', W, H, false);
  const dir = resolve(process.env.QP_FRAMES || resolve(process.env.TEMP, 'qp-frames'));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  page.on('Page.screencastFrame', (p) => {
    frames.push({ t: p.metadata.timestamp, data: p.data });
    page.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
  });
  const smooth = (y) => page.eval(`window.scrollTo({ top: ${y}, behavior: 'smooth' }); true`).then(() => s.wait(900));
  await page.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  await s.wait(1200);
  const demoTop = await page.eval(`document.getElementById('demo').getBoundingClientRect().top + scrollY`);
  await smooth(demoTop);
  await s.wait(300);
  await page.click('.chip[data-sample="photosynthesis"]');
  await s.wait(900);
  await page.click('#gen-btn');
  await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 15000);
  await s.wait(1300);
  const q = SAMPLES[0].quiz.en.questions;
  await page.click(`.opt[data-k="${q[0].answer}"]`);
  await s.wait(1700);
  await page.click('[data-next]');
  await s.wait(700);
  await page.click(`.opt[data-k="${(q[1].answer + 1) % 4}"]`);
  await s.wait(1900);
  await smooth(0);
  await s.wait(300);
  await page.type('#email', 'maria.teacher@example.com');
  await s.wait(500);
  await page.click('#join-btn');
  await page.waitFor(`!document.getElementById('thanks').hidden`, 8000);
  await s.wait(2600);
  await page.send('Page.stopScreencast');
  await s.wait(200);
  // Constant 15 fps: repeat or drop frames by their timestamps.
  const fps = 15, t0 = frames[0].t, t1 = frames[frames.length - 1].t;
  let k = 0, n = 0;
  for (let t = t0; t <= t1; t += 1 / fps) {
    while (k + 1 < frames.length && frames[k + 1].t <= t) k++;
    writeFileSync(resolve(dir, `f${String(n++).padStart(4, '0')}.jpg`), Buffer.from(frames[k].data, 'base64'));
  }
  console.log(`frames: ${frames.length} raw, ${n} at ${fps} fps, ${(t1 - t0).toFixed(1)} s, dir ${dir}`);
  const ff = process.env.FFMPEG || 'ffmpeg';
  const out = resolve(SHOTS, 'flow.gif');
  const r = spawnSync(ff, ['-y', '-threads', '4', '-framerate', String(fps), '-i', resolve(dir, 'f%04d.jpg'),
    '-vf', 'scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    '-loop', '0', out], { windowsHide: true, encoding: 'utf8' });
  if (r.status !== 0) console.error(String(r.stderr).slice(-800));
  rmSync(dir, { recursive: true, force: true });
  console.log('flow.gif written');
}

// Page weight: bytes over the wire per resource type, plus layout shift.
async function weight() {
  const sizes = new Map();
  const types = new Map();
  page.on('Network.responseReceived', (p) => types.set(p.requestId, { url: p.response.url, type: p.type }));
  page.on('Network.loadingFinished', (p) => sizes.set(p.requestId, p.encodedDataLength));
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.viewport(1440, 900, false, 1);
  await page.eval(`localStorage.clear(); sessionStorage.clear(); true`).catch(() => {});
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });` });
  await page.goto(BASE + '?lang=en');
  await s.wait(2500);
  const by = {};
  let total = 0;
  for (const [id, info] of types) {
    const b = sizes.get(id) || 0;
    const key = info.url.includes('/api') ? 'api' : info.type;
    by[key] = (by[key] || 0) + b;
    total += b;
  }
  const cls = await page.eval('window.__cls');
  const imgs = await page.eval(`[...document.images].filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).map((i) => i.src)`);
  console.log(JSON.stringify({ totalKB: +(total / 1024).toFixed(1), byTypeKB: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +(v / 1024).toFixed(1)])), cls: +cls.toFixed(4), unsizedImages: imgs }, null, 1));
  console.log([...types.values()].map((t) => `${t.type} ${t.url.slice(0, 110)}`).join('\n'));
}

try {
  if (mode === 'shots') await shots();
  else if (mode === 'sections') await sections();
  else if (mode === 'og') await og();
  else if (mode === 'record') await record();
  else if (mode === 'weight') await weight();
  if (s.errors.length) console.log('console errors:', s.errors.join(' || ').slice(0, 600));
} catch (e) {
  console.error('FAILED', e.message);
  process.exitCode = 1;
} finally {
  await s.stop();
}
