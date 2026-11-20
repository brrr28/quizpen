// Local mock of the Apps Script backend: same contract as backend/Code.gs (see API.md).
// Node 22, no packages, in-memory store. Usage: MOCK_OK=1 node backend/mock-server.mjs
// Env: PORT (default 8787), MOCK_QUIZ_DELAY_MS (default 1200), MOCK_QUIZ_DISABLED=1.
// Mock-only: GET ?action=debug returns the in-memory visit and demo-run counters.

import http from 'node:http';
import { randomInt } from 'node:crypto';

// PC rule: a stand must not grab an interactive console unless explicitly allowed.
if (process.stdout.isTTY && process.env.MOCK_OK !== '1') {
  console.error('Refusing to start in an interactive console. Set MOCK_OK=1 to run the mock here.');
  process.exit(1);
}

const PORT = Number(process.env.PORT || 8787);
const HOST = '127.0.0.1';
const QUIZ_DELAY_MS = Number(process.env.MOCK_QUIZ_DELAY_MS ?? 1200);
const QUIZ_DISABLED = process.env.MOCK_QUIZ_DISABLED === '1';

const LIMITS = {
  join: { perCid: 5, windowMs: 10 * 60 * 1000 },
  quiz: { perCidPerHour: 5, perMinute: 30, perDay: 300 },
  visit: { perCid: 20, windowMs: 10 * 60 * 1000, perMinute: 300 },
};
const REF_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const REF_ALPHABET = REF_LETTERS + '23456789';
const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;

const rows = []; // { created_at, email, ref_code, referred_by, lang, utm_source, utm_medium, utm_campaign, cid }
const counters = new Map(); // key -> { count, expires }
const visits = []; // { created_at, cid, lang, utm_source, utm_medium, utm_campaign, ref }
const demoRuns = []; // { created_at, cid, lang, sample, text_length, questions, ok, error, ms }, never the text
const seenVisits = new Set(); // "<cid>:<Kyiv day>"

function bump(key, limit, windowMs) {
  const now = Date.now();
  const entry = counters.get(key);
  const current = entry && entry.expires > now ? entry.count : 0;
  if (current >= limit) return false;
  counters.set(key, { count: current + 1, expires: entry && entry.expires > now ? entry.expires : now + windowMs });
  return true;
}

function peek(key) {
  const entry = counters.get(key);
  return entry && entry.expires > Date.now() ? entry.count : 0;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  if (email.length > 254 || email.indexOf('@') < 1) return '';
  if (email.split('@')[0].length > 64) return '';
  if (/^[=+\-]/.test(email)) return '';
  return EMAIL_RE.test(email) ? email : '';
}

const clean = (v, max) =>
  typeof v === 'string' || typeof v === 'number'
    ? String(v).replace(/[\u0000-\u001F\u007F]/g, '').trim().replace(/^[=+\-@]+/, '').slice(0, max)
    : '';
const cleanCid = (v) => (typeof v === 'string' ? v.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) : '');
const cleanRef = (v) => (typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : '');
const cleanLang = (v) => (v === 'uk' ? 'uk' : 'en');
const cleanSample = (v) => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9_-]/g, '').replace(/^-+/, '').slice(0, 32) : '');
const kyivDay = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });

function clampCount(v) {
  if (v === null || v === undefined || v === '') return 5;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(7, Math.max(3, n)) : 5;
}

function newRefCode(taken) {
  for (;;) {
    let code = REF_LETTERS[randomInt(REF_LETTERS.length)];
    while (code.length < 7) code += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
}

const referralsOf = (code) => rows.filter((r) => r.referred_by === code).length;

function join(body) {
  if (clean(body.hp, 200)) {
    return { ok: true, position: rows.length + 1, total: rows.length + 1, refCode: newRefCode(new Set()), referrals: 0, already: false };
  }
  const email = normalizeEmail(body.email);
  if (!email) return { ok: false, error: 'invalid_email' };
  const cid = cleanCid(body.cid);
  if (!bump(`join:${cid || 'email:' + email}`, LIMITS.join.perCid, LIMITS.join.windowMs)) return { ok: false, error: 'rate_limited' };

  const index = rows.findIndex((r) => r.email === email);
  if (index >= 0) {
    const r = rows[index];
    return { ok: true, position: index + 1, total: rows.length, refCode: r.ref_code, referrals: referralsOf(r.ref_code), already: true };
  }
  const codes = new Set(rows.map((r) => r.ref_code));
  const ref = cleanRef(body.ref);
  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  const row = {
    created_at: new Date().toISOString(),
    email,
    ref_code: newRefCode(codes),
    referred_by: ref && codes.has(ref) ? ref : '',
    lang: cleanLang(body.lang),
    utm_source: clean(utm.source, 100),
    utm_medium: clean(utm.medium, 100),
    utm_campaign: clean(utm.campaign, 100),
    cid,
  };
  rows.push(row);
  return { ok: true, position: rows.length, total: rows.length, refCode: row.ref_code, referrals: 0, already: false };
}

function reserveQuiz(cid) {
  const keys = [
    [`quiz:${cid}`, LIMITS.quiz.perCidPerHour, 3600e3],
    ['quiz:minute', LIMITS.quiz.perMinute, 60e3],
    [`quiz:day:${new Date().toISOString().slice(0, 10)}`, LIMITS.quiz.perDay, 86400e3],
  ];
  if (keys.some(([key, limit]) => peek(key) >= limit)) return false;
  keys.forEach(([key, limit, windowMs]) => bump(key, limit, windowMs));
  return true;
}

/** Deterministic sample quiz: fill-in-the-blank questions built from the first sentences of the text. */
function buildSampleQuiz(text, lang, count) {
  const uk = lang === 'uk';
  const wordRe = /[\p{L}\p{N}'’-]{5,}/gu;
  let sentences = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter((s) => (s.match(wordRe) || []).length >= 2);
  if (sentences.length === 0) sentences = [text.slice(0, 300)];
  const pool = [...new Set((text.match(wordRe) || []).map((w) => w.toLowerCase()))];
  const fallback = uk ? ['контекст', 'приклад', 'процес', 'система', 'результат'] : ['context', 'example', 'process', 'system', 'result'];
  const short = (s) => (s.length > 140 ? s.slice(0, 137) + '...' : s);

  const questions = [];
  for (let i = 0; i < count; i++) {
    const sentence = sentences[i % sentences.length];
    const words = sentence.match(wordRe) || [sentence.split(/\s+/)[0]];
    const target = [...words].sort((a, b) => b.length - a.length || a.localeCompare(b))[i % Math.min(words.length, 2)];
    const distractors = [];
    for (const w of [...pool.slice(i * 3), ...pool, ...fallback]) {
      if (distractors.length === 3) break;
      if (w !== target.toLowerCase() && !distractors.includes(w)) distractors.push(w);
    }
    const answer = i % 4;
    const options = [...distractors];
    options.splice(answer, 0, target.toLowerCase());
    questions.push({
      q: (uk ? 'Яке слово пропущено? ' : 'Which word is missing? ') + short(sentence.replace(target, '_____')),
      options,
      answer,
      explain: uk ? `У тексті сказано: «${short(sentence)}».` : `The text says: "${short(sentence)}".`,
    });
  }
  const head = text.split(/\s+/).slice(0, 5).join(' ');
  return { title: (uk ? 'Тест за текстом: ' : 'Quiz: ') + head + '...', questions };
}

function visit(body) {
  const cid = cleanCid(body.cid);
  if (!cid) return { ok: false, error: 'bad_request' };
  if (!bump(`visit:${cid}`, LIMITS.visit.perCid, LIMITS.visit.windowMs)) return { ok: false, error: 'rate_limited' };
  const seenKey = `${cid}:${kyivDay()}`;
  if (seenVisits.has(seenKey)) return { ok: true, counted: false };
  if (!bump('visit:minute', LIMITS.visit.perMinute, 60e3)) return { ok: false, error: 'rate_limited' };
  seenVisits.add(seenKey);
  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  visits.push({
    created_at: new Date().toISOString(),
    cid,
    lang: cleanLang(body.lang),
    utm_source: clean(utm.source, 100),
    utm_medium: clean(utm.medium, 100),
    utm_campaign: clean(utm.campaign, 100),
    ref: cleanRef(body.ref),
  });
  return { ok: true, counted: true };
}

/** Same as Code.gs: every quiz request is logged, ok or not, with the text length only. */
async function loggedQuiz(body) {
  const started = Date.now();
  let result = { ok: false, error: 'server' };
  try {
    result = await quiz(body);
    return result;
  } finally {
    demoRuns.push({
      created_at: new Date().toISOString(),
      cid: cleanCid(body.cid),
      lang: cleanLang(body.lang),
      sample: cleanSample(body.sample),
      text_length: typeof body.text === 'string' ? body.text.trim().length : 0,
      questions: result.ok ? result.quiz.questions.length : 0,
      ok: result.ok === true,
      error: result.ok ? '' : result.error,
      ms: Date.now() - started,
    });
  }
}

/** Mock-only: GET ?action=debug shows the in-memory counters (Code.gs answers bad_request). */
function debugCounters() {
  return {
    ok: true,
    signups: rows.length,
    visits: visits.length,
    uniqueVisitors: new Set(visits.map((v) => v.cid)).size,
    demoRuns: demoRuns.length,
    demoRunsOk: demoRuns.filter((r) => r.ok).length,
    lastVisit: visits.at(-1) || null,
    lastDemoRun: demoRuns.at(-1) || null,
  };
}

async function quiz(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 200) return { ok: false, error: 'too_short' };
  if (text.length > 3000) return { ok: false, error: 'too_long' };
  if (QUIZ_DISABLED) return { ok: false, error: 'disabled' };
  if (!reserveQuiz(cleanCid(body.cid) || 'anon')) return { ok: false, error: 'rate_limited' };
  await new Promise((resolve) => setTimeout(resolve, QUIZ_DELAY_MS));
  return { ok: true, quiz: buildSampleQuiz(text, cleanLang(body.lang), clampCount(body.count)) };
}

function send(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(obj === null ? '' : JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, null);
    if (req.method === 'GET') {
      const action = new URL(req.url, `http://${HOST}`).searchParams.get('action') || 'stats';
      if (action === 'debug') return send(res, 200, debugCounters());
      return send(res, 200, action === 'stats' ? { ok: true, total: rows.length } : { ok: false, error: 'bad_request' });
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'bad_request' });
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return send(res, 200, { ok: false, error: 'bad_request' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 200, { ok: false, error: 'bad_request' });
    if (body.action === 'join') return send(res, 200, join(body));
    if (body.action === 'quiz') return send(res, 200, await loggedQuiz(body));
    if (body.action === 'visit') return send(res, 200, visit(body));
    if (body.action === 'stats') return send(res, 200, { ok: true, total: rows.length });
    return send(res, 200, { ok: false, error: 'bad_request' });
  } catch (err) {
    console.error('mock error:', err.message);
    return send(res, 200, { ok: false, error: 'server' });
  }
});

server.listen(PORT, HOST, () => console.log(`mock listening on http://${HOST}:${PORT}`));

const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
