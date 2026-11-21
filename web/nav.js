/* Quizpen landing navigation: smooth in-page links, a section rail (>= 1024 px), a mobile drawer,
   one scrollspy for both, section reveal on scroll and a counter tick when a counter first appears.
   Loaded with defer BEFORE app.js and ui.js: the drawer's language buttons and theme toggle must exist
   when those files bind their controls. */
(function () {
  'use strict';

  var html = document.documentElement;
  var header = document.querySelector('.site-header');
  var main = document.getElementById('main');
  if (!header || !main) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wide = window.matchMedia('(min-width: 1024px)');
  var hasIO = 'IntersectionObserver' in window;

  /* Strings for the UI this file adds (app.js does not know them). */
  var T = {
    en: {
      menu: 'Open menu', close: 'Close menu', title: 'Menu', sections: 'Sections', lang: 'Language', theme: 'Dark theme',
      top: 'Start', how: 'How it works', vs: 'Comparison', students: 'Students', demo: 'Demo', features: 'Features', why: 'Research', faq: 'Questions', final: 'Join'
    },
    uk: {
      menu: 'Відкрити меню', close: 'Закрити меню', title: 'Меню', sections: 'Розділи', lang: 'Мова', theme: 'Темна тема',
      top: 'Початок', how: 'Як це працює', vs: 'Порівняння', students: 'Учні', demo: 'Демо', features: 'Можливості', why: 'Дослідження', faq: 'Питання', final: 'Приєднатися'
    }
  };
  function lang() { return html.lang === 'uk' ? 'uk' : 'en'; }
  function t(key) { return T[lang()][key] || T.en[key] || ''; }
  var appliedLang = null;
  function applyText() {
    if (appliedLang === lang()) return;
    appliedLang = lang();
    document.querySelectorAll('[data-nav-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-nav-i18n')); });
    document.querySelectorAll('[data-nav-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-nav-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':'); if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
  }

  function track(name, props) { if (window.qpAnalytics) window.qpAnalytics.track(name, props); }

  var SECTIONS = Array.prototype.filter.call(main.children, function (el) { return el.tagName === 'SECTION' && el.id; });
  function labelKey(s) { return T.en[s.id] ? s.id : null; }
  function sectionLink(s, cls, withNum, i) {
    var a = document.createElement('a');
    a.className = cls;
    a.href = '#' + s.id;
    a.setAttribute('data-nav-target', s.id);
    var key = labelKey(s), heading = s.querySelector('h1, h2');
    var label = '<span class="' + cls + '-label"' + (key ? ' data-nav-i18n="' + key + '"' : '') + '>' +
      (key ? '' : (heading ? heading.textContent.trim() : s.id)) + '</span>';
    a.innerHTML = withNum
      ? '<span class="' + cls + '-num" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>' + label
      : label + '<span class="' + cls + '-dot" aria-hidden="true"></span>';
    return a;
  }
  function list(cls, withNum) {
    var ol = document.createElement('ol');
    ol.className = cls + 's';
    SECTIONS.forEach(function (s, i) {
      var li = document.createElement('li');
      li.appendChild(sectionLink(s, cls, withNum, i));
      ol.appendChild(li);
    });
    return ol;
  }

  /* ---------- Section rail (desktop) ---------- */
  var rail = document.createElement('nav');
  rail.className = 'nav-rail';
  rail.setAttribute('data-nav-i18n-attr', 'aria-label:sections');
  rail.appendChild(list('nav-rail-link', false));
  document.body.appendChild(rail);

  /* ---------- Drawer (mobile and tablet) ---------- */
  var burger = header.querySelector('.nav-burger');
  var drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'nav-drawer';
  drawer.setAttribute('inert', '');
  drawer.innerHTML =
    '<div class="nav-drawer-overlay" data-nav-close></div>' +
    '<div class="nav-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="nav-drawer-title">' +
      '<div class="nav-drawer-head">' +
        '<p class="nav-drawer-title" id="nav-drawer-title" data-nav-i18n="title"></p>' +
        '<button type="button" class="nav-drawer-close" data-nav-close data-nav-i18n-attr="aria-label:close">' +
          '<svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>' +
      '</div>' +
      '<nav class="nav-drawer-nav" data-nav-i18n-attr="aria-label:sections"></nav>' +
      '<div class="nav-drawer-settings">' +
        '<div class="nav-drawer-row nav-drawer-row-lang"><span class="nav-drawer-row-label" data-nav-i18n="lang"></span></div>' +
        '<div class="nav-drawer-row nav-drawer-row-theme"><span class="nav-drawer-row-label" id="nav-theme-label" data-nav-i18n="theme"></span></div>' +
      '</div>' +
    '</div>';
  drawer.querySelector('.nav-drawer-nav').appendChild(list('nav-drawer-link', true));
  // Clones of the header controls: app.js and ui.js (loaded after this file) bind every copy.
  var langGroup = header.querySelector('.lang');
  var themeBtn = header.querySelector('[data-theme-toggle]');
  if (langGroup) drawer.querySelector('.nav-drawer-row-lang').appendChild(langGroup.cloneNode(true));
  else drawer.querySelector('.nav-drawer-row-lang').remove();
  if (themeBtn) drawer.querySelector('.nav-drawer-row-theme').appendChild(themeBtn.cloneNode(true));
  else drawer.querySelector('.nav-drawer-row-theme').remove();
  document.body.appendChild(drawer);
  var panel = drawer.querySelector('.nav-drawer-panel');

  var isOpen = false, inerted = [];
  function focusables() {
    return Array.prototype.filter.call(panel.querySelectorAll('a[href], button:not([disabled])'), function (el) {
      return el.getClientRects().length > 0;
    });
  }
  function openDrawer() {
    if (isOpen) return;
    isOpen = true;
    drawer.removeAttribute('inert');
    drawer.classList.add('is-open');
    if (burger) burger.setAttribute('aria-expanded', 'true');
    html.classList.add('nav-lock');
    // Everything outside the drawer is inert while it is open: a real modal for keyboard and screen readers.
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === drawer || /^(SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName) || el.hasAttribute('inert')) return;
      el.setAttribute('inert', '');
      inerted.push(el);
    });
    var f = focusables();
    if (f.length) f[0].focus({ preventScroll: true });
    document.addEventListener('keydown', onDrawerKey, true);
  }
  function closeDrawer(returnFocus) {
    if (!isOpen) return;
    isOpen = false;
    drawer.classList.remove('is-open');
    drawer.setAttribute('inert', '');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    inerted.forEach(function (el) { el.removeAttribute('inert'); });
    inerted = [];
    html.classList.remove('nav-lock');
    document.removeEventListener('keydown', onDrawerKey, true);
    if (returnFocus && burger) burger.focus({ preventScroll: true });
  }
  function onDrawerKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(true); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], cur = document.activeElement;
    if (e.shiftKey && (cur === first || !panel.contains(cur))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (cur === last || !panel.contains(cur))) { e.preventDefault(); first.focus(); }
  }
  if (burger) burger.addEventListener('click', function () { if (isOpen) closeDrawer(true); else openDrawer(); });
  drawer.addEventListener('click', function (e) { if (e.target.closest('[data-nav-close]')) closeDrawer(true); });
  function onWide() { if (wide.matches) closeDrawer(false); }
  if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);

  /* ---------- Smooth in-page links ---------- */
  var pinned = null;
  function focusTarget(target) {
    var el = target;
    if (/^(SECTION|MAIN)$/.test(target.tagName)) {
      var by = target.getAttribute('aria-labelledby');
      el = (by && document.getElementById(by)) || target.querySelector('h1, h2, h3') || target;
    }
    if (!el.matches('a[href], button, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  function goTo(id) {
    var target = document.getElementById(id);
    if (!target) return false;
    var behavior = reduce.matches ? 'auto' : 'smooth';
    if (target === SECTIONS[0]) window.scrollTo({ top: 0, behavior: behavior });
    else target.scrollIntoView({ behavior: behavior, block: 'start' });
    if (SECTIONS.indexOf(target) >= 0) { pinned = id; setActive(id); }
    focusTarget(target);
    try { history.replaceState(history.state, '', '#' + id); } catch (e) { /* file:// or sandboxed frame */ }
    track('nav_click', { target: id });
    return true;
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.target === '_blank') return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    if (drawer.contains(a)) closeDrawer(false);
    goTo(id);
  });

  /* ---------- Scrollspy: the section under a line at 30% below the header is active ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav-target], .site-header .nav a[href^="#"]'));
  var active = null, atBottom = false, spy = null, spyKey = '';
  function linkId(a) { return a.getAttribute('data-nav-target') || a.getAttribute('href').slice(1); }
  function setActive(id) {
    if (id === active) return;
    active = id;
    links.forEach(function (a) {
      if (linkId(a) === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }
  function lineY() { var h = header.getBoundingClientRect().bottom; return h + (window.innerHeight - h) * 0.3; }
  function compute() {
    if (pinned) return pinned;
    if (atBottom) return SECTIONS[SECTIONS.length - 1].id;
    var y = lineY(), id = SECTIONS[0].id;
    SECTIONS.forEach(function (s) { if (s.getBoundingClientRect().top <= y) id = s.id; });
    return id;
  }
  function update() { setActive(compute()); }
  function observeSpy() {
    var y = Math.round(lineY()), key = y + ':' + window.innerHeight;
    if (key === spyKey) return;
    spyKey = key;
    if (spy) spy.disconnect();
    // A 1 px band at the line: a callback fires exactly when a section edge crosses it.
    spy = new IntersectionObserver(update, { rootMargin: -y + 'px 0px ' + -(window.innerHeight - y - 1) + 'px 0px' });
    SECTIONS.forEach(function (s) { spy.observe(s); });
  }
  function unpin() { if (pinned) { pinned = null; update(); } }
  if (hasIO && SECTIONS.length) {
    observeSpy();
    var end = document.createElement('div');
    end.className = 'nav-end';
    end.setAttribute('aria-hidden', 'true');
    document.body.appendChild(end);
    new IntersectionObserver(function (entries) {
      atBottom = entries[entries.length - 1].isIntersecting;
      update();
    }, { rootMargin: '0px 0px 2px 0px' }).observe(end);
    // A click on a nav link pins its section until the visitor scrolls on their own.
    ['wheel', 'touchstart', 'mousedown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, unpin, { passive: true }); });
    var rz = 0;
    window.addEventListener('resize', function () {
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(function () { observeSpy(); update(); });
    });
    update();
  }

  /* ---------- Reveal on scroll: sections below the first screen fade and rise in once ---------- */
  function initReveal() {
    if (reduce.matches || !hasIO) return;
    var vh = window.innerHeight, items = [];
    SECTIONS.forEach(function (s, si) {
      if (si === 0 || s.getBoundingClientRect().top < vh) return; // on screen or above: leave as is
      var wrap = s.querySelector('.wrap') || s;
      Array.prototype.forEach.call(wrap.children, function (el, i) {
        el.classList.add('nav-reveal');
        el.style.setProperty('--nav-reveal-i', String(Math.min(i, 3)));
        items.push(el);
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }
  initReveal();

  /* ---------- Counter tick: a counter that was off screen counts up when it first appears ---------- */
  // app.js counts up on load; a counter below the fold would finish unseen. The start value keeps the
  // digit count, so with tabular figures the text keeps its width and nothing moves.
  function tick(span) {
    var text = span.textContent, m = text.match(/\d{1,3}(?:[,   ]\d{3})+|\d+/);
    if (!m) return;
    var to = parseInt(m[0].replace(/\D/g, ''), 10);
    if (!(to >= 10)) return;
    var from = Math.max(Math.pow(10, String(to).length - 1), Math.round(to * 0.4));
    if (from >= to) return;
    var nf = new Intl.NumberFormat(lang() === 'uk' ? 'uk-UA' : 'en-US');
    var before = text.slice(0, m.index), after = text.slice(m.index + m[0].length);
    var start = performance.now(), dur = 700, last = null;
    (function step(now) {
      if (last !== null && span.textContent !== last) return; // app.js re-rendered it (language switch)
      var k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
      last = before + nf.format(Math.round(from + (to - from) * e)) + after;
      span.textContent = last;
      if (k < 1) requestAnimationFrame(step);
    })(start);
  }
  function initTick() {
    if (reduce.matches || !hasIO) return;
    document.querySelectorAll('[data-counter]').forEach(function (el) {
      var first = true;
      var io = new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        // Visible at first sight, or not ready yet: app.js's own count-up is what the visitor sees.
        if (first) { first = false; if (e.isIntersecting) { io.disconnect(); return; } }
        if (!e.isIntersecting) return;
        io.disconnect();
        var span = el.querySelector('.counter-text');
        if (span && el.classList.contains('is-ready')) tick(span);
      }, { rootMargin: '0px 0px -10% 0px' });
      io.observe(el);
    });
  }
  initTick();

  /* ---------- Language: follow app.js (it sets <html lang>) ---------- */
  applyText();
  if ('MutationObserver' in window) new MutationObserver(applyText).observe(html, { attributes: true, attributeFilter: ['lang'] });
})();
