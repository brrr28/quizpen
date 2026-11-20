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

/** Parses 'B2', 'A5:B12' or 'A:A' into 1-based row/column bounds (a column-only range has row 1 and no row count). */
function parseA1(a1) {
  const m = /^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(a1);
  if (!m) throw new Error('bad A1 ' + a1);
  const col = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const r = Number(m[2] || 1);
  const c = col(m[1]);
  return { r, c, nr: m[4] ? Number(m[4]) - r + 1 : 1, nc: m[3] ? col(m[3]) - c + 1 : 1, a1 };
}

/** Utilities.formatDate stub that honours the patterns Code.gs uses, in the requested time zone. */
function formatDate(date, timeZone, pattern) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const offset = parts.timeZoneName === 'GMT' ? '+00:00' : parts.timeZoneName.slice(3);
  return pattern
    .replace('yyyy', parts.year).replace('MM', parts.month).replace('dd', parts.day)
    .replace('HH', parts.hour).replace('mm', parts.minute).replace('ss', parts.second)
    .replace("'T'", 'T').replace('XXX', offset);
}

/** Loads Code.gs into a sandbox with in-memory stubs of the Apps Script services it uses. */
function gasTransport() {
  const sheets = [];
  const ssState = { timeZone: 'America/New_York', active: null };
  const makeSheet = (name) => {
    const data = []; // rows written by appendRow
    const cells = new Map(); // 'r,c' -> value written by setValues / setFormula (the Insights tab)
    const charts = [];
    const sheet = {
      name, data, cells, charts,
      frozen: 0,
      getName: () => sheet.name,
      setName: (n) => { sheet.name = n; },
      getLastRow: () => data.length,
      appendRow: (row) => { data.push(row.map((v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? '!' + v : v))); },
      setFrozenRows: (n) => { sheet.frozen = n; },
      setColumnWidth: () => {},
      setHiddenGridlines: () => {},
      clear: () => { data.length = 0; cells.clear(); },
      getCharts: () => [...charts],
      removeChart: (chart) => { charts.splice(charts.indexOf(chart), 1); },
      insertChart: (chart) => { charts.push(chart); },
      newChart: () => {
        const spec = { ranges: [], options: {} };
        const builder = {
          setChartType: (type) => ((spec.type = type), builder),
          addRange: (range) => (spec.ranges.push(range.a1), builder),
          setNumHeaders: (n) => ((spec.headers = n), builder),
          setPosition: (row, col) => ((spec.position = [row, col]), builder),
          setOption: (key, value) => ((spec.options[key] = value), builder),
          build: () => ({ ...spec }),
        };
        return builder;
      },
      getRange: (...args) => {
        const b = typeof args[0] === 'string' ? parseA1(args[0]) : { r: args[0], c: args[1], nr: args[2] || 1, nc: args[3] || 1 };
        const range = {
          a1: b.a1,
          getValues: () => data.slice(b.r - 1, b.r - 1 + b.nr).map((row) => row.slice(b.c - 1, b.c - 1 + b.nc)),
          setValues: (values) => {
            if (values.length !== b.nr || values.some((row) => row.length !== b.nc)) throw new Error('setValues size mismatch at ' + JSON.stringify(b));
            values.forEach((row, i) => row.forEach((v, j) => cells.set(`${b.r + i},${b.c + j}`, v)));
            return range;
          },
          setFormula: (f) => (cells.set(`${b.r},${b.c}`, f), range),
        };
        for (const m of ['setNumberFormat', 'setFontWeight', 'setFontSize', 'setFontColor', 'setBackground', 'setHorizontalAlignment']) range[m] = () => range;
        return range;
      },
    };
    sheets.push(sheet);
    return sheet;
  };
  makeSheet('Sheet1');
  const spreadsheet = {
    getSheetByName: (n) => sheets.find((s) => s.name === n) || null,
    getSheets: () => sheets,
    insertSheet: (n) => makeSheet(n),
    getSpreadsheetTimeZone: () => ssState.timeZone,
    setSpreadsheetTimeZone: (tz) => { ssState.timeZone = tz; },
    setActiveSheet: (s) => { ssState.active = s; return s; },
    moveActiveSheet: (pos) => { sheets.splice(sheets.indexOf(ssState.active), 1); sheets.splice(pos - 1, 0, ssState.active); },
  };
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
    SpreadsheetApp: { getActive: () => spreadsheet, flush: () => {} },
    Charts: { ChartType: { LINE: 'LINE' } },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => { cache.set(k, String(v)); },
        remove: (k) => { cache.delete(k); },
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
    Utilities: { formatDate, sleep: () => {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(here, 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });

  return {
    name: 'Code.gs (sandbox)',
    sheets, cache, props, fetchLog, claude, ssState, sandbox,
    sheet: (n) => sheets.find((s) => s.name === n),
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

/** Visit beacon and the optional quiz `sample` field: shared by every target. */
async function runAnalytics(t) {
  const visit = (extra) => t.post({ action: 'visit', lang: 'uk', utm: { source: 'tg', medium: 'post', campaign: 'launch' }, ref: 'k7xq-2ma', ...extra });
  const v1 = (await visit({ cid: cid('v') })).json;
  check('visit: ok + counted', v1.ok === true && v1.counted === true, v1);
  const v2 = (await visit({ cid: cid('v') })).json;
  check('visit reload same day: ok, not counted', v2.ok === true && v2.counted === false, v2);
  const v3 = (await visit({ cid: cid('v2'), lang: 'xx', utm: undefined, ref: undefined })).json;
  check('visit other cid: counted', v3.ok === true && v3.counted === true, v3);
  const noCid = (await visit({ cid: '' })).json;
  check('visit without cid -> bad_request', noCid.ok === false && noCid.error === 'bad_request', noCid);

  const burst = [];
  for (let i = 0; i < 21; i++) burst.push((await visit({ cid: cid('vrl') })).json);
  check('visit burst: 20 ok, only the first counted', burst.slice(0, 20).every((r) => r.ok) && burst.filter((r) => r.counted).length === 1, burst.map((r) => r.error || r.counted));
  check('visit burst: 21st rate_limited', burst[20].ok === false && burst[20].error === 'rate_limited', burst[20]);

  const withSample = (await t.post({ action: 'quiz', text: LONG_TEXT_UK, lang: 'uk', count: 3, cid: cid('qs'), sample: 'photosynthesis' })).json;
  checkQuizShape('quiz with sample field', withSample, 3);
}

/** Mock only: the in-memory counters behind GET ?action=debug. */
async function runMockCounters(t, quizPosts) {
  const d = (await t.get({ action: 'debug' })).json;
  check('mock: 3 visits counted (one per cid per day)', d.visits === 3 && d.uniqueVisitors === 3, d);
  check('mock: every quiz request logged', d.demoRuns === quizPosts, { logged: d.demoRuns, sent: quizPosts });
  const run = d.lastDemoRun || {};
  check('mock: demo run keeps sample, length, no text', run.sample === 'photosynthesis' && run.text_length === LONG_TEXT_UK.trim().length && run.ok === true && !('text' in run), run);
  check('mock: visit row cleaned', d.lastVisit && d.lastVisit.ref === 'K7XQ2MA' && d.lastVisit.utm_source === 'tg', d.lastVisit);
}

/** Code.gs only: rows written to visits and demo_runs, and the Insights tab. */
async function runGasAnalytics(t, quizPosts) {
  // After runGasOnly the API key is gone, so this request ends as "disabled" and is still logged.
  const custom = (await t.post({ action: 'quiz', text: LONG_TEXT_UK, lang: 'en', cid: cid('qc'), sample: '=Custom' })).json;
  check('quiz without key still answers disabled', custom.error === 'disabled', custom);
  quizPosts++;

  const visits = t.sheet('visits');
  check('visits tab created', !!visits);
  if (!visits) return;
  check('visits header', JSON.stringify(visits.data[0]) === JSON.stringify(['created_at', 'cid', 'lang', 'utm_source', 'utm_medium', 'utm_campaign', 'ref']), visits.data[0]);
  check('visits header frozen', visits.frozen === 1);
  const byCid = (sheet, col, id) => sheet.data.slice(1).filter((row) => row[col] === id);
  const rowsV = byCid(visits, 1, cid('v'));
  check('visit stored once for a reloaded page', rowsV.length === 1, rowsV.length);
  const rowV = rowsV[0] || [];
  check('visit row fields', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(rowV[0]) && rowV[2] === 'uk' && rowV[3] === 'tg' && rowV[4] === 'post' && rowV[5] === 'launch' && rowV[6] === 'K7XQ2MA', rowV);
  const rowV2 = byCid(visits, 1, cid('v2'))[0] || [];
  check('visit row defaults', rowV2[2] === 'en' && rowV2[3] === '' && rowV2[6] === '', rowV2);
  check('visit burst stored once', byCid(visits, 1, cid('vrl')).length === 1);
  check('visits: 3 rows in total', visits.data.length === 4, visits.data.length);

  const dayKey = `visit:${cid('v')}:${formatDate(new Date(), 'Europe/Kyiv', 'yyyy-MM-dd')}`;
  check('visit dedupe mark is per Kyiv day', t.cache.has(dayKey), [...t.cache.keys()].filter((k) => k.startsWith('visit:')));
  t.cache.delete(dayKey);
  const nextDay = (await t.post({ action: 'visit', cid: cid('v'), lang: 'uk' })).json;
  check('visit counted again once the day mark is gone', nextDay.counted === true && byCid(visits, 1, cid('v')).length === 2, nextDay);

  const runs = t.sheet('demo_runs');
  check('demo_runs tab created', !!runs);
  if (!runs) return;
  check('demo_runs header', JSON.stringify(runs.data[0]) === JSON.stringify(['created_at', 'cid', 'lang', 'sample', 'text_length', 'questions', 'ok', 'error', 'ms']), runs.data[0]);
  check('demo_runs: one row per quiz request, ok or not', runs.data.length - 1 === quizPosts, { rows: runs.data.length - 1, sent: quizPosts });
  const rowOk = byCid(runs, 1, cid('qs'))[0] || [];
  check('demo run ok row', rowOk[2] === 'uk' && rowOk[3] === 'photosynthesis' && rowOk[4] === LONG_TEXT_UK.trim().length && rowOk[5] === 3 && rowOk[6] === true && rowOk[7] === '' && isInt(rowOk[8]) && rowOk[8] >= 0, rowOk);
  const rowShort = runs.data.find((row) => row[7] === 'too_short') || [];
  check('demo run too_short row', rowShort[3] === '' && rowShort[4] === 199 && rowShort[5] === 0 && rowShort[6] === false, rowShort);
  check('demo run refusal logged as server', runs.data.some((row) => row[1] === cid('r1') && row[7] === 'server' && row[6] === false));
  check('demo run rate_limited logged', runs.data.some((row) => row[1] === cid('qrl') && row[7] === 'rate_limited'));
  const rowCustom = byCid(runs, 1, cid('qc'))[0] || [];
  check('demo run sample cleaned, disabled logged', rowCustom[3] === 'custom' && rowCustom[7] === 'disabled', rowCustom);
  const stored = JSON.stringify(runs.data);
  check('demo_runs never stores the pasted text', !stored.includes(LONG_TEXT_UK.slice(0, 30)) && !stored.includes('Фотосинтез') && !stored.includes('xxxxxxxxxx'));
  check('no formula characters in analytics rows', [visits, runs].every((sh) => sh.data.every((row) => row.every((v) => !String(v).startsWith('!')))));

  // Insights: build twice (the second time through checkSetup) to prove the rebuild is clean.
  t.sandbox.setupInsights();
  t.sandbox.checkSetup();
  const insightTabs = t.sheets.filter((sh) => sh.name === 'Insights');
  check('insights: exactly one tab after two builds', insightTabs.length === 1, insightTabs.length);
  const ins = insightTabs[0];
  if (!ins) return;
  check('insights: first tab', t.sheets[0] === ins, t.sheets.map((sh) => sh.name));
  check('insights: data tabs untouched', visits.data.length === 5 && runs.data.length - 1 === quizPosts);
  check('insights: one chart after rebuild', ins.charts.length === 1, ins.charts.length);
  const chart = ins.charts[0] || {};
  check('insights: line chart of dates and signups', chart.type === 'LINE' && JSON.stringify(chart.ranges) === '["A23:A37","D23:D37"]' && chart.headers === 1, chart);
  check('insights: spreadsheet time zone Europe/Kyiv', t.ssState.timeZone === 'Europe/Kyiv', t.ssState.timeZone);
  check('insights: title rows frozen', ins.frozen === 2, ins.frozen);

  const cell = (a1) => { const b = parseA1(a1); return ins.cells.get(`${b.r},${b.c}`); };
  const formulas = [...ins.cells.values()].filter((v) => typeof v === 'string' && v.startsWith('='));
  check('insights: formulas written', formulas.length >= 70, formulas.length);
  const tabs = new Set(formulas.flatMap((f) => [...f.matchAll(/'([^']+)'!/g)].map((m) => m[1])));
  check('insights: formulas read only the data tabs', tabs.size === 3 && [...tabs].every((n) => ['waitlist', 'visits', 'demo_runs'].includes(n)), [...tabs]);
  const balanced = (f) => {
    if ((f.match(/"/g) || []).length % 2) return false;
    let depth = 0;
    for (const ch of f.replace(/"[^"]*"/g, '')) {
      depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
      if (depth < 0) return false;
    }
    return depth === 0;
  };
  check('insights: balanced quotes and parentheses', formulas.every(balanced), formulas.filter((f) => !balanced(f)));
  check('insights: unique visitors by visits.cid', cell('A5') === 'Unique visitors' && cell('B5') === `=COUNTUNIQUEIFS('visits'!B2:B,'visits'!B2:B,"<>")`, cell('B5'));
  check('insights: signups by waitlist.email', cell('A8') === 'Signups' && cell('B8') === `=COUNTA('waitlist'!B2:B)`, cell('B8'));
  check('insights: visitors who signed up joins visits.cid to waitlist.cid', cell('B9').includes(`FILTER('visits'!B2:B,'visits'!B2:B<>"")`) && cell('B9').includes(`'waitlist'!I2:I`), cell('B9'));
  check('insights: demo users who signed up joins demo_runs.cid', cell('B10').includes(`'demo_runs'!B2:B`) && cell('B10').includes(`'waitlist'!I2:I`), cell('B10'));
  check('insights: conversions', cell('A11') === 'Visit → signup' && cell('B11') === '=IFERROR(B9/B5,0)' && cell('B12') === '=IFERROR(B10/B7,0)', [cell('B11'), cell('B12')]);
  check('insights: sample vs own text', cell('B16') === `=COUNTIF('demo_runs'!D2:D,"custom")` && cell('C15').includes(`'demo_runs'!G2:G,TRUE`), [cell('B16'), cell('C15')]);
  check('insights: language split', cell('A20') === 'Ukrainian (uk)' && cell('D21') === `=COUNTIF('waitlist'!E2:E,"en")` && cell('E20') === '=IFERROR(D20/$B$8,0)', [cell('A20'), cell('D21'), cell('E20')]);
  check('insights: 14 days ending today', cell('A24') === '=TODAY()-13' && cell('A37') === '=TODAY()-0' && cell('A38') === undefined, [cell('A24'), cell('A37')]);
  check('insights: signups per day', cell('D24') === `=COUNTIF('waitlist'!A2:A,TEXT($A24,"yyyy-mm-dd")&"*")` && cell('B37') === `=COUNTIF('visits'!A2:A,TEXT($A37,"yyyy-mm-dd")&"*")`, [cell('D24'), cell('B37')]);
  check('insights: top referrers query on waitlist.referred_by', cell('A40').startsWith(`=IFERROR(QUERY('waitlist'!D2:D,"select D, count(D)`) && cell('A40').includes('group by D order by count(D) desc limit 10'), cell('A40'));
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
let quizPosts = 0;
const rawPost = t.post;
t.post = (body) => {
  if (body && body.action === 'quiz') quizPosts++;
  return rawPost(body);
};
let quizMs = 0;
try {
  quizMs = await runContract(t);
  await runAnalytics(t);
  if (target === 'gas') {
    await runGasOnly(t);
    await runGasAnalytics(t, quizPosts);
  } else if (t.name === 'mock-server.mjs') {
    await runMockCounters(t, quizPosts);
  }
} catch (err) {
  failures.push('crashed: ' + err.message);
} finally {
  await t.close();
}

console.log(`Target: ${t.name}`);
console.log(`Passed: ${passed}, failed: ${failures.length}${target === 'http' ? `, 3 quiz calls took ${quizMs} ms` : ''}`);
failures.forEach((f) => console.log('FAIL ' + f));
process.exitCode = failures.length ? 1 : 0;
