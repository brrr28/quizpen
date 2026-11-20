// Contract test for the waitlist backend (see API.md).
//   node backend/test-contract.mjs              -> starts mock-server.mjs (hidden), tests it, stops it
//   node backend/test-contract.mjs --target=gas -> runs Code.gs in a Node sandbox with stubbed Apps Script services
//   BASE_URL=<url> node backend/test-contract.mjs -> tests a running server (on the real /exec it WRITES test rows)
// Node 22, no packages.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv.includes('--target=gas') ? 'gas' : 'http';

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) passed++;
  else failures.push(`${name}${detail === undefined ? '' : ' -> ' + JSON.stringify(detail)}`);
}

const isInt = (v) => Number.isInteger(v);
const runId = Date.now().toString(36);
const cid = (name) => `test-${name}-${runId}`;

const LONG_TEXT_UK =
  'Фотосинтез — це процес, під час якого зелені рослини самі створюють собі поживні речовини. ' +
  'Він відбувається переважно в листках, у крихітних хлоропластах, що містять зелений пігмент хлорофіл. ' +
  'Рослини поглинають вуглекислий газ із повітря та воду з ґрунту і за допомогою енергії сонячного світла перетворюють їх на глюкозу. ' +
  'Побічним продуктом є кисень, тому ліси такі важливі для повітря, яким ми дихаємо. ' +
  'Без сонячного світла фотосинтез зупиняється, і рослина живе за рахунок запасів крохмалю.';

/* ---------- Transports ---------- */

async function httpTransport() {
  let child = null;
  let base = process.env.BASE_URL;
  if (!base) {
    child = spawn(process.execPath, [path.join(here, 'mock-server.mjs')], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: process.env.PORT || '8787', MOCK_QUIZ_DELAY_MS: '1200' },
    });
    base = `http://127.0.0.1:${process.env.PORT || '8787'}`;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('mock did not start in 10 s')), 10000);
      child.stdout.on('data', (d) => d.toString().includes('listening') && (clearTimeout(timer), resolve()));
      child.stderr.on('data', (d) => process.stderr.write(d));
      child.on('exit', (code) => (clearTimeout(timer), reject(new Error('mock exited with code ' + code))));
    });
  }
  return {
    name: child ? 'mock-server.mjs' : base,
    async get(query) {
      const res = await fetch(`${base}?${new URLSearchParams(query)}`, { redirect: 'follow' });
      return { json: await res.json(), cors: res.headers.get('access-control-allow-origin') };
    },
    async post(body) {
      const res = await fetch(base, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
      return { json: await res.json(), cors: res.headers.get('access-control-allow-origin') };
    },
    async close() {
      if (child && child.exitCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve));
        child.kill();
        await exited;
      }
    },
  };
}

/** Loads Code.gs into a sandbox with in-memory stubs of the Apps Script services it uses. */
function gasTransport() {
  const sheets = [];
  const makeSheet = (name) => {
    const data = [];
    const sheet = {
      name,
      data,
      frozen: 0,
      getName: () => sheet.name,
      setName: (n) => { sheet.name = n; },
      getLastRow: () => data.length,
      appendRow: (row) => { data.push(row.map((v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? '!' + v : v))); },
      setFrozenRows: (n) => { sheet.frozen = n; },
      getRange: (r, c, nr = 1, nc = 1) => ({
        setNumberFormat: () => {},
        setFontWeight: () => {},
        getValues: () => data.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
      }),
    };
    sheets.push(sheet);
    return sheet;
  };
  makeSheet('Sheet1');
  const cache = new Map();
  const props = new Map([['ANTHROPIC_API_KEY', 'test-key-not-real']]);
  const fetchLog = [];
  const claude = { mode: 'ok' };

  const fakeClaude = (payload) => {
    const count = Number(/Number of questions: (\d+)/.exec(payload.messages[0].content)[1]);
    if (claude.mode === 'refusal') return { stop_reason: 'refusal', stop_details: { category: 'general_harms' }, content: [] };
    if (claude.mode === 'garbage') return { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"title":"x","questions":[]}' }] };
    const questions = Array.from({ length: count }, (_, i) => ({
      q: `Question ${i + 1}?`, options: ['alpha', 'beta', 'gamma', 'delta'], answer: i % 4, explain: 'Because the text says so.',
    }));
    return {
      stop_reason: 'end_turn',
      content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text: JSON.stringify({ title: 'Photosynthesis', questions }) }],
    };
  };

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    SpreadsheetApp: {
      getActive: () => ({
        getSheetByName: (n) => sheets.find((s) => s.name === n) || null,
        getSheets: () => sheets,
        insertSheet: (n) => makeSheet(n),
      }),
      flush: () => {},
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => { cache.set(k, String(v)); },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => { props.set(k, String(v)); },
        deleteProperty: (k) => { props.delete(k); },
        getKeys: () => [...props.keys()],
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    UrlFetchApp: {
      fetch: (url, options) => {
        const payload = JSON.parse(options.payload);
        fetchLog.push({ url, options, payload });
        const body = JSON.stringify(fakeClaude(payload));
        return { getResponseCode: () => 200, getContentText: () => body };
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }),
    },
    Utilities: { formatDate: (d) => d.toISOString(), sleep: () => {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(here, 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });

  return {
    name: 'Code.gs (sandbox)',
    sheets, cache, props, fetchLog, claude,
    async get(query) {
      return { json: JSON.parse(sandbox.doGet({ parameter: query }).content), cors: '*' };
    },
    async post(body) {
      const contents = typeof body === 'string' ? body : JSON.stringify(body);
      return { json: JSON.parse(sandbox.doPost({ postData: { contents } }).content), cors: '*' };
    },
    async close() {},
  };
}

/* ---------- Contract checks (shared by every target) ---------- */

function checkJoinShape(name, r) {
  check(`${name}: ok`, r.ok === true, r);
  check(`${name}: position int >= 1`, isInt(r.position) && r.position >= 1, r.position);
  check(`${name}: total int >= position`, isInt(r.total) && r.total >= r.position, r);
  check(`${name}: refCode 6-8 chars`, typeof r.refCode === 'string' && /^[A-Z0-9]{6,8}$/.test(r.refCode), r.refCode);
  check(`${name}: referrals int`, isInt(r.referrals) && r.referrals >= 0, r.referrals);
  check(`${name}: already bool`, typeof r.already === 'boolean', r.already);
}

function checkQuizShape(name, r, count) {
  check(`${name}: ok`, r.ok === true, r);
  const quiz = r.quiz || {};
  check(`${name}: title`, typeof quiz.title === 'string' && quiz.title.length > 0, quiz.title);
  check(`${name}: ${count} questions`, Array.isArray(quiz.questions) && quiz.questions.length === count, quiz.questions && quiz.questions.length);
  (quiz.questions || []).forEach((q, i) => {
    check(`${name}: q${i} text`, typeof q.q === 'string' && q.q.length > 0, q);
    check(`${name}: q${i} 4 distinct options`, Array.isArray(q.options) && q.options.length === 4 && q.options.every((o) => typeof o === 'string' && o) && new Set(q.options).size === 4, q.options);
    check(`${name}: q${i} answer 0-3`, isInt(q.answer) && q.answer >= 0 && q.answer <= 3, q.answer);
    check(`${name}: q${i} explain`, typeof q.explain === 'string' && q.explain.length > 0, q.explain);
  });
}

async function runContract(t) {
  const stats = await t.get({ action: 'stats' });
  check('stats: ok + int total', stats.json.ok === true && isInt(stats.json.total), stats.json);
  check('stats: CORS *', stats.cors === '*', stats.cors);

  const bad = await t.post('not json');
  check('bad json -> bad_request', bad.json.ok === false && bad.json.error === 'bad_request', bad.json);

  for (const email of ['not-an-email', 'a@b', 'x@' + 'a'.repeat(250) + '.com', '=cmd@evil.com', '', 42]) {
    const r = await t.post({ action: 'join', email, lang: 'en', ref: null, utm: {}, hp: '', cid: cid('invalid') });
    check(`join invalid ${JSON.stringify(String(email).slice(0, 20))} -> invalid_email`, r.json.ok === false && r.json.error === 'invalid_email', r.json);
  }

  const emailA = `Teacher.A+${runId}@Example.COM`;
  const a = (await t.post({ action: 'join', email: `  ${emailA}  `, lang: 'uk', ref: null, utm: { source: 'tg', medium: 'post', campaign: 'launch' }, hp: '', cid: cid('a') })).json;
  checkJoinShape('join A', a);
  check('join A: new', a.already === false && a.referrals === 0, a);

  const dup = (await t.post({ action: 'join', email: emailA.toLowerCase(), lang: 'en', ref: null, utm: {}, hp: '', cid: cid('a') })).json;
  checkJoinShape('join A again', dup);
  check('duplicate -> already, same position/refCode', dup.already === true && dup.position === a.position && dup.refCode === a.refCode, dup);

  const hp = (await t.post({ action: 'join', email: `bot-${runId}@spam.com`, lang: 'en', ref: null, utm: {}, hp: 'http://spam', cid: cid('bot') })).json;
  checkJoinShape('honeypot', hp);
  check('honeypot -> pretend new', hp.already === false, hp);

  const b = (await t.post({ action: 'join', email: `teacher.b.${runId}@example.com`, lang: 'en', ref: a.refCode.toLowerCase(), utm: {}, hp: '', cid: cid('b') })).json;
  checkJoinShape('join B (ref A)', b);
  check('honeypot wrote nothing (B total = A total + 1)', b.total === a.total + 1, { a: a.total, b: b.total });
  check('B refCode differs from A', b.refCode !== a.refCode, b);

  const c = (await t.post({ action: 'join', email: `teacher.c.${runId}@example.com`, lang: 'en', ref: 'ZZZZZZZ', utm: {}, hp: '', cid: cid('c') })).json;
  checkJoinShape('join C (unknown ref)', c);

  const aAfter = (await t.post({ action: 'join', email: emailA, lang: 'uk', ref: null, utm: {}, hp: '', cid: cid('a') })).json;
  check('A referrals = 1 after B joined with A ref', aAfter.referrals === 1 && aAfter.already === true, aAfter);

  const rl = [];
  for (let i = 0; i < 6; i++) {
    rl.push((await t.post({ action: 'join', email: `rl${i}.${runId}@example.com`, lang: 'en', ref: null, utm: {}, hp: '', cid: cid('rl') })).json);
  }
  check('join rate limit: 5 pass', rl.slice(0, 5).every((r) => r.ok === true), rl.slice(0, 5));
  check('join rate limit: 6th rate_limited', rl[5].ok === false && rl[5].error === 'rate_limited', rl[5]);

  const short = (await t.post({ action: 'quiz', text: 'x'.repeat(199), lang: 'en', count: 5, cid: cid('q') })).json;
  check('quiz 199 chars -> too_short', short.ok === false && short.error === 'too_short', short);
  const long = (await t.post({ action: 'quiz', text: 'x'.repeat(3001), lang: 'en', count: 5, cid: cid('q') })).json;
  check('quiz 3001 chars -> too_long', long.ok === false && long.error === 'too_long', long);

  const started = Date.now();
  const q5 = (await t.post({ action: 'quiz', text: LONG_TEXT_UK, lang: 'uk', count: 5, cid: cid('q') })).json;
  checkQuizShape('quiz uk count 5', q5, 5);
  const q3 = (await t.post({ action: 'quiz', text: LONG_TEXT_UK, lang: 'en', count: 1, cid: cid('q') })).json;
  checkQuizShape('quiz count 1 clamped to 3', q3, 3);
  const q7 = (await t.post({ action: 'quiz', text: LONG_TEXT_UK, lang: 'en', cid: cid('q2') })).json;
  checkQuizShape('quiz default count 5', q7, 5);
  return Date.now() - started;
}

/** Extra checks that only make sense against Code.gs itself: the Claude request and failure handling. */
async function runGasOnly(t) {
  const call = t.fetchLog[0] || { options: { headers: {} }, payload: {} };
  check('claude: endpoint', call.url === 'https://api.anthropic.com/v1/messages', call.url);
  check('claude: x-api-key from Script Properties', call.options.headers['x-api-key'] === 'test-key-not-real');
  check('claude: anthropic-version', call.options.headers['anthropic-version'] === '2026-10-21', call.options.headers);
  check('claude: muteHttpExceptions', call.options.muteHttpExceptions === true);
  check('claude: model claude-haiku-5-5', call.payload.model === 'claude-haiku-5-5', call.payload.model);
  check('claude: effort low', call.payload.output_config && call.payload.output_config.effort === 'low');
  check('claude: json_schema format', call.payload.output_config && call.payload.output_config.format.type === 'json_schema');
  check('claude: no sampling params', !('temperature' in call.payload) && !('top_p' in call.payload) && !('top_k' in call.payload));
  check('claude: no prefill', call.payload.messages.at(-1).role === 'user', call.payload.messages);
  check('claude: max_tokens set', isInt(call.payload.max_tokens) && call.payload.max_tokens >= 2000, call.payload.max_tokens);
  check('claude: system prompt', typeof call.payload.system === 'string' && call.payload.system.length > 200);
  check('claude: asks for Ukrainian', call.payload.messages[0].content.includes('Ukrainian'));

  const sheet = t.sheets[0];
  check('sheet renamed to waitlist', sheet.name === 'waitlist', sheet.name);
  check('header row', JSON.stringify(sheet.data[0]) === JSON.stringify(['created_at', 'email', 'ref_code', 'referred_by', 'lang', 'utm_source', 'utm_medium', 'utm_campaign', 'cid']), sheet.data[0]);
  check('header frozen', sheet.frozen === 1);
  check('row A stored normalized with utm', sheet.data[1][1] === `teacher.a+${runId}@example.com` && sheet.data[1][4] === 'uk' && sheet.data[1][5] === 'tg', sheet.data[1]);
  check('row B referred_by A', sheet.data[2][3] === sheet.data[1][2], sheet.data[2]);
  check('no cell starts with a formula character', sheet.data.every((row) => row.every((v) => !String(v).startsWith('!'))));

  const textOk = { action: 'quiz', text: LONG_TEXT_UK, lang: 'en', count: 5 };
  t.claude.mode = 'refusal';
  const refused = (await t.post({ ...textOk, cid: cid('r1') })).json;
  check('refusal -> server', refused.ok === false && refused.error === 'server', refused);
  t.claude.mode = 'garbage';
  const garbage = (await t.post({ ...textOk, cid: cid('r2') })).json;
  check('invalid model output -> server', garbage.ok === false && garbage.error === 'server', garbage);
  t.claude.mode = 'ok';

  const perCid = [];
  for (let i = 0; i < 6; i++) perCid.push((await t.post({ ...textOk, cid: cid('qrl') })).json);
  check('quiz per-cid limit: 6th rate_limited', perCid.slice(0, 5).every((r) => r.ok) && perCid[5].error === 'rate_limited', perCid.map((r) => r.error || 'ok'));

  const dayKey = [...t.props.keys()].find((k) => k.startsWith('quiz_day_'));
  t.props.set(dayKey, '300');
  const daily = (await t.post({ ...textOk, cid: cid('day') })).json;
  check('quiz daily limit 300 -> rate_limited', daily.error === 'rate_limited', daily);

  t.props.delete('ANTHROPIC_API_KEY');
  const disabled = (await t.post({ ...textOk, cid: cid('dis') })).json;
  check('no API key -> disabled', disabled.ok === false && disabled.error === 'disabled', disabled);

  const leaked = JSON.stringify([refused, garbage, disabled]).includes('test-key-not-real');
  check('key never in responses', !leaked);
}

const t = target === 'gas' ? gasTransport() : await httpTransport();
let quizMs = 0;
try {
  quizMs = await runContract(t);
  if (target === 'gas') await runGasOnly(t);
} catch (err) {
  failures.push('crashed: ' + err.message);
} finally {
  await t.close();
}

console.log(`Target: ${t.name}`);
console.log(`Passed: ${passed}, failed: ${failures.length}${target === 'http' ? `, 3 quiz calls took ${quizMs} ms` : ''}`);
failures.forEach((f) => console.log('FAIL ' + f));
process.exitCode = failures.length ? 1 : 0;
