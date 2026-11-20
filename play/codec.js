/* Quizpen student play: quiz <-> share-link codec.
   Shared by the landing (web/play/share.js) and the student player (web/play/play.js).
   A quiz travels only in the URL fragment: #q=z.<base64url of deflate-raw JSON>
   (or #q=p.<base64url of plain JSON> when the sender's browser has no CompressionStream).
   Kept to ES2017 syntax so that old phones still parse it and can show a friendly error. */
(function (root) {
  'use strict';

  var FORMAT = 1;
  var LIMITS = { title: 120, q: 300, option: 160, explain: 400, minQ: 3, maxQ: 7, token: 12000, bytes: 65536 };
  // Control characters, zero-width spaces, bidi overrides and BOM are replaced by spaces.
  var JUNK = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g;

  function clean(value, max) {
    if (typeof value !== 'string') return null;
    var s = value.replace(JUNK, ' ').replace(/\s+/g, ' ').trim();
    var chars = Array.from(s);
    if (chars.length > max) s = chars.slice(0, max - 1).join('').trim() + '…';
    return s;
  }

  function pickLang(v) { return v === 'en' || v === 'uk' ? v : null; }

  // Accepts the full shape {title, questions:[{q, options, answer, explain}]} or the compact
  // link shape [1, lang, title, [[q, options, answer, explain], ...]]. Returns null when invalid.
  function normalize(input) {
    var title, list, lang;
    if (Array.isArray(input)) {
      if (input.length !== 4 || input[0] !== FORMAT || !Array.isArray(input[3])) return null;
      lang = input[1]; title = input[2];
      list = input[3].map(function (x) {
        return Array.isArray(x) ? { q: x[0], options: x[1], answer: x[2], explain: x[3] } : null;
      });
    } else if (input && typeof input === 'object') {
      title = input.title; list = input.questions; lang = input.lang;
    } else {
      return null;
    }
    if (!Array.isArray(list) || list.length < LIMITS.minQ || list.length > LIMITS.maxQ) return null;

    var questions = [];
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (!x || typeof x !== 'object') return null;
      var q = clean(x.q, LIMITS.q);
      if (!q) return null;
      if (!Array.isArray(x.options) || x.options.length !== 4) return null;
      var options = x.options.map(function (o) { return clean(o, LIMITS.option); });
      if (options.some(function (o) { return !o; })) return null;
      if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer > 3) return null;
      var explain = x.explain === undefined || x.explain === null ? '' : clean(x.explain, LIMITS.explain);
      if (explain === null) return null;
      questions.push({ q: q, options: options, answer: x.answer, explain: explain });
    }
    var t = title === undefined || title === null ? '' : clean(title, LIMITS.title);
    if (t === null) return null;
    return { quiz: { title: t, questions: questions }, lang: pickLang(lang) };
  }

  /* ---------- bytes <-> base64url ---------- */
  function b64uEncode(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64uDecode(s) {
    var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* ---------- deflate-raw through the browser's own streams ---------- */
  function deflate(bytes) {
    try {
      var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    } catch (e) {
      return Promise.reject(e);
    }
  }
  // Reads the inflated stream with a size cap so a crafted link cannot blow up memory.
  function inflate(bytes) {
    var reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    var chunks = [], total = 0;
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) {
          var out = new Uint8Array(total), at = 0;
          chunks.forEach(function (c) { out.set(c, at); at += c.length; });
          return out;
        }
        total += r.value.length;
        if (total > LIMITS.bytes) {
          reader.cancel().catch(function () { /* already failed */ });
          throw new Error('too_big');
        }
        chunks.push(r.value);
        return pump();
      });
    }
    return pump();
  }

  function compact(norm) {
    return [FORMAT, norm.lang || '', norm.quiz.title, norm.quiz.questions.map(function (q) {
      return [q.q, q.options, q.answer, q.explain];
    })];
  }

  // Quiz -> link token ("z.<...>" or "p.<...>"). Extra questions above the limit are dropped.
  function encode(quiz, lang) {
    var norm = normalize({
      title: quiz && quiz.title,
      questions: quiz && Array.isArray(quiz.questions) ? quiz.questions.slice(0, LIMITS.maxQ) : null,
      lang: lang
    });
    if (!norm) return Promise.reject(new Error('invalid_quiz'));
    var bytes = new TextEncoder().encode(JSON.stringify(compact(norm)));
    return deflate(bytes).then(
      function (z) { return 'z.' + b64uEncode(z); },
      function () { return 'p.' + b64uEncode(bytes); }
    );
  }

  function parseBytes(bytes) {
    var text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return normalize(JSON.parse(text));
  }

  // Link token -> { ok: true, quiz, lang } or { ok: false, error: 'missing' | 'broken' | 'unsupported' }.
  function decode(token) {
    if (!token) return Promise.resolve({ ok: false, error: 'missing' });
    var m = /^(?:([zp])\.)?([A-Za-z0-9_-]+)$/.exec(String(token));
    if (!m || token.length > LIMITS.token) return Promise.resolve({ ok: false, error: 'broken' });
    var kind = m[1] || 'z', bytes;
    try { bytes = b64uDecode(m[2]); } catch (e) { return Promise.resolve({ ok: false, error: 'broken' }); }

    var done = function (norm) { return norm ? { ok: true, quiz: norm.quiz, lang: norm.lang } : { ok: false, error: 'broken' }; };
    var plain = function () {
      try { return done(parseBytes(bytes)); } catch (e) { return { ok: false, error: 'broken' }; }
    };
    if (kind === 'p') return Promise.resolve(plain());
    if (typeof DecompressionStream === 'undefined' || typeof Blob === 'undefined' || !Blob.prototype.stream) {
      // An unprefixed token may still be plain JSON; otherwise this browser cannot read it.
      var p = m[1] ? null : plain();
      return Promise.resolve(p && p.ok ? p : { ok: false, error: 'unsupported' });
    }
    var inflated;
    try { inflated = inflate(bytes); } catch (e) { return Promise.resolve({ ok: false, error: 'unsupported' }); }
    return inflated.then(function (out) { return done(parseBytes(out)); })
      .catch(function () { return m[1] ? { ok: false, error: 'broken' } : plain(); });
  }

  // Reads q=<token> from a location.hash such as "#q=z.abc".
  function tokenFromHash(hash) {
    var parts = String(hash || '').replace(/^#/, '').split('&');
    for (var i = 0; i < parts.length; i++) if (parts[i].indexOf('q=') === 0) return parts[i].slice(2);
    return '';
  }

  root.QuizpenCodec = {
    LIMITS: LIMITS, normalize: normalize, encode: encode, decode: decode, tokenFromHash: tokenFromHash
  };
})(window);
