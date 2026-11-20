/* Quizpen landing UI polish, loaded after app.js: theme switch, sticky header state and a language
   switch that moves nothing on the page (stable labels for controls, reserved heights for text blocks). */
(function () {
  'use strict';

  var html = document.documentElement;
  var I18N = window.QP_I18N;
  var LANGS = ['en', 'uk'];
  var EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Strings for the UI this file adds (app.js does not know them). */
  var UI = {
    en: { 'theme.dark': 'Dark theme' },
    uk: { 'theme.dark': 'Темна тема' }
  };
  function lang() { return html.lang === 'uk' ? 'uk' : 'en'; }
  function ui(key) { return UI[lang()][key] || UI.en[key]; }
  function applyUi() {
    document.querySelectorAll('[data-ui-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-ui-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':'); if (p.length === 2) el.setAttribute(p[0].trim(), ui(p[1].trim()));
      });
    });
  }

  /* ---------- Theme ---------- */
  var THEME_KEY = 'qp_theme';
  var THEME_COLOR = { light: '#F6F6F2', dark: '#0E1220' };
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  var fadeTimer = 0, maskSeq = 0;

  function savedTheme() {
    try { var v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; }
  }
  function saveTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* storage blocked: the choice lasts for this page only */ }
  }
  function currentTheme() { return html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function paintTheme(t) {
    html.setAttribute('data-theme', t);
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', THEME_COLOR[t]); });
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', String(t === 'dark')); });
  }
  function setTheme(t, animate) {
    if (t === currentTheme()) return;
    if (!animate || reduce.matches) { paintTheme(t); return; }
    if (typeof document.startViewTransition === 'function') {
      document.startViewTransition(function () { paintTheme(t); });
      return;
    }
    html.classList.add('theme-fade');
    paintTheme(t);
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(function () { html.classList.remove('theme-fade'); }, 260);
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  // Sun: a disc with 8 rays. Moon: the disc grows and a masked circle slides in to cut a crescent.
  function themeIcon() {
    var id = 'tt-mask-' + (maskSeq++), rays = '';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      rays += '<line x1="' + r2(12 + 8.2 * c) + '" y1="' + r2(12 + 8.2 * s) + '" x2="' + r2(12 + 10.4 * c) + '" y2="' + r2(12 + 10.4 * s) + '"/>';
    }
    return '<svg class="tt" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32">' +
      '<rect x="-4" y="-4" width="32" height="32" fill="#fff"/><circle class="tt-cut" cx="31" cy="1" r="8" fill="#000"/></mask>' +
      '<g mask="url(#' + id + ')"><circle class="tt-core" cx="12" cy="12" r="5" fill="currentColor"/></g>' +
      '<g class="tt-rays" stroke="currentColor" stroke-width="2" stroke-linecap="round">' + rays + '</g></svg>';
  }
  function initTheme() {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.innerHTML = themeIcon();
      b.setAttribute('data-ui-i18n-attr', 'aria-label:theme.dark');
      b.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        saveTheme(next);
        setTheme(next, true);
      });
    });
    paintTheme(currentTheme());
    // Follow the system setting while the visitor has not picked a theme.
    var onSystem = function (e) { if (!savedTheme()) setTheme(e.matches ? 'dark' : 'light', true); };
    if (systemDark.addEventListener) systemDark.addEventListener('change', onSystem);
    else if (systemDark.addListener) systemDark.addListener(onSystem);
    // Another tab of the site changed the theme.
    window.addEventListener('storage', function (e) {
      if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) setTheme(e.newValue, true);
    });
  }

  /* ---------- Sticky header: hairline once the page is scrolled ---------- */
  function initHeader() {
    var header = document.querySelector('.site-header');
    if (!header || !('IntersectionObserver' in window)) return;
    var s = document.createElement('div');
    s.className = 'hdr-sentinel';
    s.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(s, document.body.firstChild);
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-scrolled', !entries[0].isIntersecting);
    }).observe(s);
  }

  /* ---------- Language switch without layout shift ----------
     1. Stable labels: controls whose width matters hold every language variant (and state texts such as
        "Joining") stacked in one grid cell, so the box always has the size of the longest variant.
        app.js keeps writing textContent/innerHTML; a MutationObserver rebuilds the stack and crossfades.
     2. Reserved heights: every other text block gets min-height = max(height in EN, height in UK),
        measured by swapping the texts in place inside one task (never painted). */
  var STACK_SEL = [
    '.site-header [data-i18n]', '.btn [data-i18n]', '.chip[data-i18n]', '.share-btn [data-i18n]',
    '.kicker[data-i18n]', '.join-label[data-i18n]', '.hero-art [data-i18n]', '.hero-art [data-i18n-html]'
  ].join(',');
  var MID_SEL = '.site-header, .btn, .chip, .share-btn, .kicker';
  var STATE_KEYS = { 'cta': ['cta.joined', 'form.sending'], 'thanks.copy': ['thanks.copied'] };
  var SKIP_SEL = '.sr-only';
  var hosts = new Map();
  var mo = null, anchor = null, lastTargets = [];
  var tpl = document.createElement('template');

  function keyOf(el) { return el.getAttribute('data-i18n-html') || el.getAttribute('data-i18n'); }
  function isHtml(el) { return el.hasAttribute('data-i18n-html'); }
  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function plain(s) { tpl.innerHTML = s; return norm(tpl.content.textContent); }

  function makeHost(el) {
    var key = keyOf(el);
    var h = { el: el, html: isHtml(el), vars: [], parts: null, wrap: null, active: -1 };
    [key].concat(STATE_KEYS[key] || []).forEach(function (k) {
      LANGS.forEach(function (l) {
        var v = I18N[l] && I18N[l][k];
        if (typeof v !== 'string' || h.vars.some(function (x) { return x.text === v; })) return;
        h.vars.push({ lang: l, text: v, plain: h.html ? plain(v) : norm(v) });
      });
    });
    // The CSS ghost (data-rsv in index.html) reserves the width before this script runs; the dictionary stays
    // the source of truth, so rewrite it from the same variants the stack is built from.
    if (el.hasAttribute('data-rsv')) el.setAttribute('data-rsv', h.vars.map(function (v) { return v.plain; }).join('\n'));
    h.inline = getComputedStyle(el).display === 'inline';
    h.mid = !!el.closest(MID_SEL);
    hosts.set(el, h);
    return h;
  }
  // Blocks whose height CSS reserves for both languages (data-rsv-en / data-rsv-uk): sync them from the dictionary.
  function syncReservedBlocks() {
    document.querySelectorAll('[data-rsv-en]').forEach(function (el) {
      var k = el.getAttribute('data-rsv-key') || keyOf(el);
      LANGS.forEach(function (l) {
        var v = I18N[l] && I18N[l][k];
        if (typeof v === 'string') el.setAttribute('data-rsv-' + l, isHtml(el) ? plain(v) : norm(v));
      });
    });
  }
  function matchVariant(h) {
    var now = norm(h.el.textContent);
    for (var i = 0; i < h.vars.length; i++) if (h.vars[i].plain === now) return i;
    // A text app.js produced that is not in the dictionary: keep it as one more variant.
    h.vars.push({ lang: lang(), text: h.html ? h.el.innerHTML : h.el.textContent, plain: now });
    return h.vars.length - 1;
  }
  function build(h, animate) {
    var idx = matchVariant(h);
    var from = animate && h.active >= 0 ? h.active : idx;
    var wrap = document.createElement('span');
    wrap.className = 'sl' + (h.inline ? ' sl-inline' : '') + (h.mid ? ' sl-mid' : '');
    h.parts = h.vars.map(function (v, i) {
      var s = document.createElement('span');
      s.className = 'sl-v' + (i === from ? '' : ' sl-off');
      s.lang = v.lang;
      if (h.html) s.innerHTML = v.text; else s.textContent = v.text;
      wrap.appendChild(s);
      return s;
    });
    h.el.textContent = '';
    h.el.appendChild(wrap);
    h.wrap = wrap;
    if (from !== idx) {
      getComputedStyle(h.parts[from]).opacity; // commit the old state so the change below transitions
      h.parts[from].classList.add('sl-off');
      h.parts[idx].classList.remove('sl-off');
    }
    h.active = idx;
  }

  function reserveTargets() {
    var list = [];
    document.querySelectorAll('[data-i18n], [data-i18n-html]').forEach(function (el) {
      if (hosts.has(el) || el.closest(SKIP_SEL)) return;
      var t = el;
      while (t && t !== document.body && getComputedStyle(t).display === 'inline') t = t.parentElement;
      if (t && t !== document.body && list.indexOf(t) < 0 && t.getClientRects().length) list.push(t);
    });
    return list;
  }
  function reserve() {
    if (!I18N) return;
    var targets = reserveTargets(), cur = lang(), other = cur === 'uk' ? 'en' : 'uk';
    var x = window.scrollX, y = window.scrollY, undo = [];
    targets.forEach(function (t) { t.style.minHeight = ''; });
    var hCur = targets.map(function (t) { return t.getBoundingClientRect().height; });
    document.querySelectorAll('[data-i18n], [data-i18n-html]').forEach(function (el) {
      if (hosts.has(el) || el.closest(SKIP_SEL)) return;
      var v = I18N[other][keyOf(el)];
      if (typeof v !== 'string') return;
      if (!isHtml(el) && el.childNodes.length === 1 && el.firstChild.nodeType === 3) {
        var node = el.firstChild, old = node.data;
        node.data = v;
        undo.push(function () { node.data = old; });
      } else {
        var frag = document.createDocumentFragment();
        while (el.firstChild) frag.appendChild(el.firstChild);
        if (isHtml(el)) el.innerHTML = v; else el.textContent = v;
        undo.push(function () { el.textContent = ''; el.appendChild(frag); });
      }
    });
    html.lang = other; // :lang() rules (the UK headline is set smaller) must apply while measuring
    var hOther = targets.map(function (t) { return t.getBoundingClientRect().height; });
    html.lang = cur;
    undo.forEach(function (f) { f(); });
    if (mo) mo.takeRecords();
    targets.forEach(function (t, i) {
      if (Math.abs(hOther[i] - hCur[i]) > 0.5) t.style.minHeight = Math.max(hOther[i], hCur[i]) + 'px';
    });
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
    lastTargets = targets;
  }

  // Fallback for text app.js renders on its own (counters, quiz): keep the first visible block in place.
  function pickAnchor() {
    var header = document.querySelector('.site-header');
    var top = header ? header.getBoundingClientRect().bottom : 0;
    var list = document.querySelectorAll('main h1, main h2, main h3, main p, main li, main summary, main .btn');
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.height && r.bottom > top) return { el: list[i], top: r.top };
    }
    return null;
  }
  function fadeIn() {
    if (reduce.matches || typeof Element.prototype.animate !== 'function') return;
    var vh = window.innerHeight;
    lastTargets.forEach(function (t) {
      if (!t.isConnected) return;
      var r = t.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      t.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 200, easing: EASE });
    });
  }
  function afterLang() {
    applyUi();
    if (anchor && anchor.el.isConnected) {
      var d = anchor.el.getBoundingClientRect().top - anchor.top;
      if (Math.abs(d) >= 1) window.scrollBy({ top: d, left: 0, behavior: 'instant' });
    }
    anchor = null;
    fadeIn();
  }
  function onMutations(records) {
    var langChanged = false, dirty = [];
    records.forEach(function (r) {
      if (r.target === html) { langChanged = true; return; }
      var n = r.target;
      while (n && !hosts.has(n)) n = n.parentNode;
      if (n && dirty.indexOf(n) < 0) dirty.push(n);
    });
    dirty.forEach(function (el) {
      var h = hosts.get(el);
      if (el.childNodes.length === 1 && el.firstChild === h.wrap) return; // our own rebuild
      build(h, !reduce.matches);
    });
    mo.takeRecords();
    if (langChanged) afterLang();
  }
  function onLangClick(e) {
    var b = e.target.closest ? e.target.closest('[data-lang]') : null;
    if (!b || b.getAttribute('data-lang') === lang()) return;
    reserve(); // also covers blocks shown since the last measure (thanks card, an open answer)
    anchor = pickAnchor();
  }
  function initLabels() {
    if (!I18N || !window.MutationObserver) return;
    syncReservedBlocks();
    document.querySelectorAll(STACK_SEL).forEach(function (el) {
      if (el.closest(SKIP_SEL) || hosts.has(el)) return;
      build(makeHost(el), false);
    });
    mo = new MutationObserver(onMutations);
    hosts.forEach(function (h, el) { mo.observe(el, { childList: true, characterData: true, subtree: true }); });
    mo.observe(html, { attributes: true, attributeFilter: ['lang'] });
    // Capture phase: runs before app.js switches the language on the same click.
    document.addEventListener('click', onLangClick, true);
    reserve();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);
    var lastW = window.innerWidth, timer = 0;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(reserve, 150);
    });
    document.addEventListener('toggle', function (e) {
      if (e.target.tagName === 'DETAILS') requestAnimationFrame(reserve);
    }, true);
  }

  initTheme();
  initHeader();
  initLabels();
  applyUi();
})();
