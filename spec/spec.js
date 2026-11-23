(function () {
  'use strict';
  var API = window.WAITLIST_API || '';
  var form = document.getElementById('form');
  var email = document.getElementById('email');
  var btn = document.getElementById('btn');
  var errorEl = document.getElementById('error');
  var thanks = document.getElementById('thanks');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // Landing variant (A worksheet, B textbook, C class boards): tags signups and events so the variants can be compared.
  var VARIANT = (document.body.getAttribute('data-variant') || 'a').toLowerCase();
  var SCRIPT_BASE = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : './';
  function track(name, props) { if (window.qpAnalytics) window.qpAnalytics.track(name, props); } // analytics hook (../analytics.js)
  var MESSAGES = {
    invalid_email: 'That email doesn\'t look right. Check it for typos.',
    rate_limited: 'Too many tries from this device. Wait a minute, then try again.'
  };

  // Anonymous client id used by the backend for rate limiting.
  function cid() {
    try {
      var v = localStorage.getItem('spec_cid');
      if (v) return v;
      v = crypto.randomUUID ? crypto.randomUUID() : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('spec_cid', v);
      return v;
    } catch (e) { return ''; }
  }

  function showError(msg) {
    errorEl.textContent = msg;
    email.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  // Every counter on the page (the hero line and the proof band) shows the same wording.
  function showCounter(total) {
    var text = total >= 10 ? total + ' teachers already joined' : 'Be one of the first teachers to try it';
    var els = document.querySelectorAll('[data-counter]');
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
  }

  // The thank-you text goes to the hero note and to the final block; html.is-joined swaps the final CTA for it.
  function showThanks(text) {
    var els = document.querySelectorAll('[data-thanks-text]');
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
    document.documentElement.classList.add('is-joined');
  }

  // The final "Join Waitlist" button scrolls back to the form and puts the cursor in the email field
  // (after signup, to the thank-you note). Without JS the link still jumps to #join.
  var jump = document.querySelector('[data-scroll-join]');
  if (jump) jump.addEventListener('click', function (e) {
    var target = form.hidden ? thanks : email;
    e.preventDefault();
    var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
  });

  function loadStats() {
    if (!API) return;
    fetch(API + (API.indexOf('?') < 0 ? '?' : '&') + 'action=stats')
      .then(function (r) { return r.json(); })
      .then(function (r) { if (r && r.ok && typeof r.total === 'number') showCounter(r.total); })
      .catch(function () { /* the counter is optional */ });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = email.value.trim();
    if (!EMAIL_RE.test(value)) { showError('That email doesn\'t look right. Check it for typos.'); email.focus(); return; }
    showError('');
    btn.disabled = true;
    track('signup_submitted', { variant: VARIANT, lang: 'en', has_ref: false }); // analytics
    btn.textContent = 'Joining…';
    var done = function () { btn.disabled = false; btn.textContent = 'Join Waitlist'; };
    if (!API) { done(); showError('Signup isn\'t open yet. Please try again later.'); return; }
    var payload = { action: 'join', email: value, lang: 'en', ref: null, utm: { source: '', medium: '', campaign: 'spec-' + VARIANT }, hp: document.getElementById('hp').value, cid: cid() };
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        clearTimeout(timer);
        if (r && r.ok) {
          track('signup_succeeded', { variant: VARIANT, already: !!r.already, has_ref: false }); // analytics
          form.hidden = true;
          thanks.hidden = false;
          showThanks(r.already ? "You're already on the list as #" + r.position + '.' : "You're #" + r.position + ' on the waitlist.');
          thanks.focus();
          if (typeof r.total === 'number') showCounter(r.total);
        } else {
          done();
          showError(MESSAGES[r && r.error] || 'Something went wrong. Please try again.');
        }
      })
      .catch(function () {
        clearTimeout(timer);
        done();
        showError('We couldn\'t reach the server. Check your connection and try again.');
      });
  });

  track('landing_viewed', { variant: VARIANT, lang: 'en', has_ref: false }); // analytics
  loadStats();

  // A thin strip at the top that switches between the three landing variants, for whoever chooses one.
  (function variantBar() {
    var items = [['a', 'A · Worksheet', ''], ['b', 'B · Textbook', 'b/'], ['c', 'C · Class boards', 'c/']];
    var bar = document.createElement('nav');
    bar.setAttribute('aria-label', 'Landing variants');
    bar.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:6px;align-items:center;padding:6px 12px;background:#fffdf8;color:#1f2a44;border-bottom:1px solid #1f2a44;font:600 12px/1.2 system-ui,-apple-system,Segoe UI,Arial,sans-serif';
    var label = document.createElement('span'); label.textContent = 'Variant:'; bar.appendChild(label);
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.href = SCRIPT_BASE + it[2]; a.textContent = it[1];
      a.style.cssText = 'color:inherit;padding:3px 6px;text-decoration:' + (it[0] === VARIANT ? 'none;background:#1f2a44;color:#fffdf8' : 'underline');
      if (it[0] === VARIANT) a.setAttribute('aria-current', 'page');
      bar.appendChild(a);
    });
    var full = document.createElement('a'); full.href = SCRIPT_BASE + '../'; full.textContent = 'Full product';
    full.style.cssText = 'color:inherit;padding:3px 6px;text-decoration:underline'; bar.appendChild(full);
    document.body.insertBefore(bar, document.body.firstChild);
  })();
})();
