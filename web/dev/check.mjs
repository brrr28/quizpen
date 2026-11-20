// Headless interaction check of the waitlist page against the local mock.
// Usage: node web/dev/check.mjs   (prints one line per check, exit 1 on any failure)

import { startStand, BASE } from './stand.mjs';

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const s = await startStand();
const { page } = s;

// Capture API bodies through CDP so the check knows the right answers without page hooks.
const posts = [];
let lastQuiz = null;
const quizReqs = new Set();
page.on('Network.requestWillBeSent', (p) => {
  if (!p.request.url.includes('/api') || p.request.method !== 'POST') return;
  let body = {};
  try { body = JSON.parse(p.request.postData || '{}'); } catch { /* not JSON */ }
  posts.push(body);
  if (body.action === 'quiz') quizReqs.add(p.requestId);
});
page.on('Network.loadingFinished', async (p) => {
  if (!quizReqs.has(p.requestId)) return;
  const r = await page.send('Network.getResponseBody', { requestId: p.requestId });
  lastQuiz = JSON.parse(r.body).quiz;
});

async function answerAll(wrongFirst) {
  const n = await page.eval(`document.querySelectorAll('.quiz-bars i').length`);
  for (let i = 0; i < n; i++) {
    const answer = lastQuiz.questions[i].answer;
    const pick = wrongFirst && i === 0 ? (answer + 1) % 4 : answer;
    await page.click(`.opt[data-k="${pick}"]`);
    const fb = await page.eval(`(() => { const f = document.querySelector('.feedback'); return f && { cls: f.className, text: f.textContent.trim().slice(0, 60) }; })()`);
    ok(`q${i + 1} feedback ${pick === answer ? 'right' : 'wrong'}`, fb && fb.cls.includes(pick === answer ? 'is-right' : 'is-wrong') && fb.text.length > 15, fb && fb.text);
    await page.click('[data-next]');
  }
  return page.eval(`(() => { const n = document.querySelector('.score-num'); return n && n.textContent; })()`);
}

try {
  for (const lang of ['en', 'uk']) {
    s.errors.length = 0;
    await page.viewport(1440, 900);
    await page.goto(BASE + '?lang=' + lang);
    await page.eval(`localStorage.clear(); sessionStorage.clear(); true`);
    posts.length = 0;
    await page.goto(BASE + '?lang=' + lang);
    await page.waitFor(`document.querySelector('[data-counter].is-ready')`);
    ok(`${lang}: html lang`, (await page.eval('document.documentElement.lang')) === lang);
    ok(`${lang}: counter ready`, true, await page.eval(`document.querySelector('.counter-text').textContent`));
    const visits = posts.filter((b) => b.action === 'visit');
    ok(`${lang}: one visit per session`, visits.length === 1 && visits[0].lang === lang && visits[0].cid, JSON.stringify(visits[0] || {}));

    // Invalid email -> inline error, no thank-you.
    await page.type('#email', 'teacher@school');
    await page.click('#join-btn');
    await s.wait(300);
    const inv = await page.eval(`({ inv: document.getElementById('email').getAttribute('aria-invalid'), msg: document.getElementById('join-msg').textContent.trim(), thanks: !document.getElementById('thanks').hidden })`);
    ok(`${lang}: invalid email inline error`, inv.inv === 'true' && inv.msg && !inv.thanks, inv.msg);

    // Demo: chip -> generate -> answer all.
    await page.click('.chip[data-sample="printing"]');
    await page.waitFor(`document.getElementById('lesson').value.length > 200`);
    await page.click('#gen-btn');
    await page.waitFor(`document.querySelector('.skel')`, 3000);
    ok(`${lang}: loading skeleton shown`, true);
    await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 15000);
    const title = await page.eval(`document.querySelector('.quiz-title').textContent`);
    const note = await page.eval(`(document.querySelector('.quiz-note') || {}).textContent || ''`);
    ok(`${lang}: live quiz from mock`, !note, title);
    const qBody = posts.filter((b) => b.action === 'quiz').pop() || {};
    ok(`${lang}: quiz request sample field`, qBody.sample === 'printing' && qBody.lang === lang, JSON.stringify({ sample: qBody.sample, lang: qBody.lang }));
    const score = await answerAll(true);
    ok(`${lang}: final score`, /^\d+\/\d+$/.test(score || ''), score);
    const copyBtn = await page.eval(`!!document.querySelector('[data-copy-quiz]')`);
    if (copyBtn) {
      await page.click('[data-copy-quiz]');
      await s.wait(300);
      const clip = await page.eval(`navigator.clipboard.readText().catch(e => 'ERR ' + e.message)`);
      ok(`${lang}: copy quiz`, /1\./.test(clip) && /A\)/.test(clip) && /Answer|Відповід/i.test(clip), clip.split('\n').slice(0, 2).join(' | '));
      const toast = await page.eval(`(document.querySelector('.toast') || {}).textContent || ''`);
      ok(`${lang}: copied toast`, toast.length > 0, toast);
    } else ok(`${lang}: copy quiz button`, false, 'missing');

    // Valid email -> thank-you with position, referral link, copy.
    await page.eval(`document.getElementById('email').value = ''; true`);
    await page.type('#email', `t.${lang}.${Date.now()}@example.com`);
    await page.click('#join-btn');
    await page.waitFor(`!document.getElementById('thanks').hidden`, 8000);
    const th = await page.eval(`({ title: document.getElementById('thanks-title').textContent.trim(), link: document.getElementById('ref-link').value, formHidden: document.getElementById('join-form').hidden })`);
    ok(`${lang}: thank-you with position`, /\d/.test(th.title) && th.formHidden, th.title);
    ok(`${lang}: referral link`, /[?&]ref=[A-Z0-9]{7}/.test(th.link), th.link);
    await page.click('#copy-btn');
    await s.wait(300);
    const clip2 = await page.eval(`navigator.clipboard.readText().catch(e => 'ERR ' + e.message)`);
    const copied = await page.eval(`document.getElementById('copy-btn').className`);
    ok(`${lang}: copy referral link`, clip2 === th.link && copied.includes('is-done'), clip2);

    // Reload -> thank-you persists.
    await page.goto(BASE + '?lang=' + lang);
    await s.wait(400);
    const persisted = await page.eval(`!document.getElementById('thanks').hidden && document.getElementById('ref-link').value`);
    ok(`${lang}: thank-you persists after reload`, persisted === th.link, String(persisted));

    // Language toggle flips texts and html lang.
    const other = lang === 'en' ? 'uk' : 'en';
    const h1Before = await page.eval(`document.getElementById('hero-title').textContent`);
    await page.click(`.lang [data-lang="${other}"]`);
    await s.wait(200);
    const after = await page.eval(`({ h1: document.getElementById('hero-title').textContent, lang: document.documentElement.lang, thanks: document.getElementById('thanks-title').textContent })`);
    ok(`${lang}: toggle to ${other}`, after.lang === other && after.h1 !== h1Before, after.thanks);
    await page.click(`.lang [data-lang="${lang}"]`);

    ok(`${lang}: no console errors`, s.errors.length === 0, s.errors.join(' || ').slice(0, 600));
  }

  // Fallback: mock stopped -> sample quiz with honest note.
  s.errors.length = 0;
  s.stopMock();
  await page.goto(BASE + '?lang=en');
  await page.click('.chip[data-sample="magi"]');
  await page.waitFor(`document.getElementById('lesson').value.length > 200`);
  await page.click('#gen-btn');
  await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 15000);
  const fbNote = await page.eval(`(document.querySelector('.quiz-note') || {}).textContent || ''`);
  ok('fallback: sample quiz with note', fbNote.length > 20, fbNote);
  // Own text without a sample -> photosynthesis fallback with the other note.
  await page.goto(BASE + '?lang=uk');
  await page.type('#lesson', 'Річка Дніпро бере початок на Валдайській височині і впадає в Чорне море. '.repeat(4));
  await page.click('#gen-btn');
  await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 15000);
  const fbNote2 = await page.eval(`(document.querySelector('.quiz-note') || {}).textContent || ''`);
  ok('fallback uk own text: note', fbNote2.length > 20, fbNote2);
  const realErrors = s.errors.filter((e) => !/Failed to load resource|net::ERR|ERR_EMPTY_RESPONSE/.test(e));
  ok('fallback: no console errors besides network', realErrors.length === 0, s.errors.join(' || ').slice(0, 400));
} catch (e) {
  ok('script', false, e.message);
} finally {
  await s.stop();
}
const failed = results.filter((r) => !r.pass).length;
console.log(`SUMMARY ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
