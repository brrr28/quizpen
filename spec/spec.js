(function () {
  'use strict';
  var API = window.WAITLIST_API || '';
  var form = document.getElementById('form');
  var email = document.getElementById('email');
  var btn = document.getElementById('btn');
  var errorEl = document.getElementById('error');
  var thanks = document.getElementById('thanks');
  var counter = document.getElementById('counter');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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

  function showCounter(total) {
    counter.textContent = total >= 10 ? total + ' teachers already joined' : 'Be one of the first teachers to try it';
  }

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
    track('signup_submitted', { lang: 'en', has_ref: false }); // analytics
    btn.textContent = 'Joining…';
    var done = function () { btn.disabled = false; btn.textContent = 'Join Waitlist'; };
    if (!API) { done(); showError('Signup isn\'t open yet. Please try again later.'); return; }
    var payload = { action: 'join', email: value, lang: 'en', ref: null, utm: {}, hp: document.getElementById('hp').value, cid: cid() };
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        clearTimeout(timer);
        if (r && r.ok) {
          track('signup_succeeded', { already: !!r.already, has_ref: false }); // analytics
          form.hidden = true;
          thanks.hidden = false;
          thanks.textContent = r.already ? "You're already on the list as #" + r.position + '.' : "You're #" + r.position + ' on the waitlist';
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

  track('landing_viewed', { lang: 'en', has_ref: false }); // analytics
  loadStats();
})();
