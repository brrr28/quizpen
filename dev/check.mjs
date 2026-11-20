// Headless interaction check of the waitlist page against the local mock.
// Usage: node web/dev/check.mjs   (prints one line per check, exit 1 on any failure)

import { readFileSync } from 'node:fs';
import { startStand, BASE } from './stand.mjs';

const SAMPLES = Object.fromEntries(JSON.parse(readFileSync(new URL('../data/samples.json', import.meta.url), 'utf8')).samples.map((x) => [x.id, x]));
const OWN_TEXT = {
  en: 'The Dnipro is one of the longest rivers in Europe. It starts in the Valdai Hills and flows south through Ukraine into the Black Sea. ',
  uk: 'Річка Дніпро бере початок на Валдайській височині і впадає в Чорне море. ',
};
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

async function answerAll(quiz, wrongFirst) {
  const n = await page.eval(`document.querySelectorAll('.quiz-bars i').length`);
  for (let i = 0; i < n; i++) {
    const answer = quiz.questions[i].answer;
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

    const T = await page.eval('window.QP_I18N.' + lang);
    const noteText = `(document.querySelector('#quiz-body .quiz-note') || {}).textContent || ''`;

    // Ready example: the quiz written in advance opens at once, with the note under it and no API call.
    await page.waitFor(`document.querySelectorAll('#sample-chips .chip').length === ${Object.keys(SAMPLES).length}`, 5000);
    const pre = await page.eval(`({ pressed: [...document.querySelectorAll('#sample-chips .chip[aria-pressed="true"]')].map((c) => c.dataset.sample), text: document.getElementById('sample-text').textContent.length, tags: document.querySelectorAll('#sample-chips .chip-tag').length })`);
    ok(`${lang}: first example preselected`, pre.pressed.join() === 'photosynthesis' && pre.text > 200 && pre.tags === 2, JSON.stringify(pre));
    await page.click('.chip[data-sample="printing"]');
    await page.click('#show-btn');
    await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 3000);
    const sTitle = await page.eval(`document.querySelector('.quiz-title').textContent`);
    const sNote = await page.eval(noteText);
    ok(`${lang}: ready example quiz`, sTitle === SAMPLES.printing.quiz[lang].title, sTitle);
    ok(`${lang}: ready example note under the quiz`, sNote === T['quiz.noteSample'].replace('{link}', T['quiz.ownLink']) &&
      (await page.eval(`!!document.querySelector('#quiz-body > .quiz-note:last-child [data-open-own]')`)), sNote);
    ok(`${lang}: ready example without API call`, posts.filter((b) => b.action === 'quiz').length === 0);
    await page.click('.opt[data-k="' + SAMPLES.printing.quiz[lang].questions[0].answer + '"]');

    // The note link opens "Your text": live quiz from the mock.
    await page.click('#quiz-body [data-open-own]');
    await s.wait(100);
    const mode = await page.eval(`({ sel: document.getElementById('tab-own').getAttribute('aria-selected'), focus: document.activeElement && document.activeElement.id, empty: !document.getElementById('quiz-empty').hidden })`);
    ok(`${lang}: note link opens own text`, mode.sel === 'true' && mode.focus === 'lesson' && mode.empty, JSON.stringify(mode));
    await page.type('#lesson', OWN_TEXT[lang].repeat(3));
    await page.click('#gen-btn');
    await page.waitFor(`document.querySelector('.skel')`, 3000);
    ok(`${lang}: loading skeleton shown`, true);
    await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 15000);
    const title = await page.eval(`document.querySelector('.quiz-title').textContent`);
    ok(`${lang}: live quiz from mock`, (await page.eval(noteText)) === T['quiz.noteLive'], title);
    const qBody = posts.filter((b) => b.action === 'quiz').pop() || {};
    ok(`${lang}: quiz request sample field`, qBody.sample === 'custom' && qBody.lang === lang, JSON.stringify({ sample: qBody.sample, lang: qBody.lang }));

    // Each mode keeps its own view.
    await page.click('#tab-samples');
    await s.wait(100);
    const back = await page.eval(`({ title: document.querySelector('.quiz-title').textContent, answered: !!document.querySelector('.feedback') })`);
    ok(`${lang}: ready tab keeps its quiz`, back.title === sTitle && back.answered, JSON.stringify(back));
    await page.click('#tab-own');
    await s.wait(100);
    ok(`${lang}: own tab keeps the live quiz`, (await page.eval(`document.querySelector('.quiz-title').textContent`)) === title, title);

    const score = await answerAll(lastQuiz, true);
    ok(`${lang}: note under the score`, (await page.eval(`!!document.querySelector('.score') && (document.querySelector('#quiz-body > .quiz-note:last-child') || {}).textContent`)) === T['quiz.noteLive']);
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

  // Busy: mock stopped -> an honest message with retry, never a substitute quiz; the ready examples still work.
  s.errors.length = 0;
  s.stopMock();
  await page.goto(BASE + '?lang=uk');
  const TU = await page.eval('window.QP_I18N.uk');
  await page.click('#tab-own');
  await page.type('#lesson', OWN_TEXT.uk.repeat(4));
  await page.click('#gen-btn');
  await page.waitFor(`document.querySelector('#quiz-body .demo-busy')`, 15000);
  const busy = await page.eval(`({ text: document.querySelector('.demo-busy p').textContent, retry: !!document.querySelector('[data-retry]'), quiz: !!document.querySelector('#quiz-body .opt') })`);
  ok('busy: honest message, no substitute quiz', busy.text === TU['demo.busy'] && busy.retry && !busy.quiz, busy.text);
  await page.click('#quiz-body [data-open-samples]');
  await s.wait(100);
  await page.click('#show-btn');
  await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 3000);
  ok('busy: ready example still opens', (await page.eval(`document.querySelector('.quiz-title').textContent`)) === SAMPLES.photosynthesis.quiz.uk.title);
  await page.click('#tab-own');
  await s.wait(100);
  ok('busy: own tab keeps the busy view', await page.eval(`!!document.querySelector('#quiz-body .demo-busy')`));
  await s.startMock();
  await page.click('[data-retry]');
  await page.waitFor(`document.querySelector('#quiz-body button.opt')`, 15000);
  ok('busy: retry gives the live quiz', (await page.eval(`(document.querySelector('#quiz-body .quiz-note') || {}).textContent`)) === TU['quiz.noteLive']);
  const realErrors = s.errors.filter((e) => !/Failed to load resource|net::ERR|ERR_EMPTY_RESPONSE/.test(e));
  ok('busy: no console errors besides network', realErrors.length === 0, s.errors.join(' || ').slice(0, 400));

  // Disabled: own text opens early access; the inline signup joins quietly; a joined visitor sees "already".
  s.errors.length = 0;
  s.stopMock();
  await s.startMock({ MOCK_QUIZ_DISABLED: '1' });
  await page.goto(BASE + '?lang=en');
  await page.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await page.goto(BASE + '?lang=en');
  const TE = await page.eval('window.QP_I18N.en');
  await page.click('#tab-own');
  await page.type('#lesson', OWN_TEXT.en.repeat(3));
  await page.click('#gen-btn');
  await page.waitFor(`document.getElementById('ea-email')`, 15000);
  const ea = await page.eval(`({ title: document.querySelector('.ea-title').textContent, text: document.querySelector('.ea-text').textContent, quiz: !!document.querySelector('#quiz-body .opt') })`);
  ok('disabled: early access view', ea.title === TE['ea.title'] && ea.text === TE['ea.text'] && !ea.quiz, ea.title);
  await page.click('#ea-btn');
  await s.wait(200);
  ok('disabled: empty email error', (await page.eval(`document.getElementById('ea-msg').textContent`)) === TE['err.empty']);
  await page.type('#ea-email', `ea.${Date.now()}@example.com`);
  await page.click('#ea-btn');
  await page.waitFor(`document.querySelector('.ea-done')`, 8000);
  const done = await page.eval(`({ text: document.querySelector('.ea-done').textContent, thanks: !document.getElementById('thanks').hidden, focus: document.activeElement && document.activeElement.className })`);
  ok('disabled: inline join success', done.text === TE['ea.done'] && done.thanks && done.focus === 'ea-done', JSON.stringify(done));
  const joinBody = posts.filter((b) => b.action === 'join').pop() || {};
  ok('disabled: join request', /^ea\.\d+@example\.com$/.test(joinBody.email || '') && joinBody.lang === 'en', joinBody.email);
  await page.goto(BASE + '?lang=en');
  await page.click('#tab-own');
  await page.type('#lesson', OWN_TEXT.en.repeat(3));
  await page.click('#gen-btn');
  await page.waitFor(`document.querySelector('.ea-done')`, 15000);
  ok('disabled: joined visitor sees already', (await page.eval(`document.querySelector('.ea-done').textContent`)) === TE['ea.already'] && !(await page.eval(`!!document.getElementById('ea-email')`)));
  ok('disabled: no console errors', s.errors.length === 0, s.errors.join(' || ').slice(0, 400));
} catch (e) {
  ok('script', false, e.message);
} finally {
  await s.stop();
}
const failed = results.filter((r) => !r.pass).length;
console.log(`SUMMARY ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
