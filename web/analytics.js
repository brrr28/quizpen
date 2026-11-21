/* Quizpen product analytics.
   - PostHog: cookieless funnel events (memory persistence, no autocapture), loaded only when POSTHOG_KEY is set.
   - Microsoft Clarity: heatmaps and session replays, loaded only when CLARITY_ID is set AND the visitor allowed it.
   - Nothing loads when the IDs are empty or the browser sends Do Not Track, Global Privacy Control or prefers-reduced-data.
   Never pass emails, lesson text, quiz text, referral codes or any other personal data to track().
   Surfaces (data-surface on the script tag): landing (default), spec (PostHog only).
   The student player (web/play/) never loads this file: its page promises that answers are not sent anywhere.
   See ANALYTICS-SEO.md for setup. */
(function () {
  'use strict';

  var script = document.currentScript;
  var SURFACE = (script && script.getAttribute('data-surface')) || 'landing';
  var BASE_URL = script && script.src ? script.src : location.href;
  var KEY = String(window.POSTHOG_KEY || '').trim();
  var HOST = String(window.POSTHOG_HOST || '').trim().replace(/\/+$/, '') || 'https://eu.i.posthog.com';
  var CLARITY = String(window.CLARITY_ID || '').trim();
  var CONSENT_KEY = 'qp_consent', CONSENT_DAYS = 365;
  // Elements whose content must never reach session replays: email, lesson text, quiz text, referral and quiz links.
  var MASK = '#email, #ea-email, #lesson, input, textarea, #ref-link, #quiz-body, #thanks-body, .play-dialog';

  var api = { enabled: false, surface: SURFACE, track: function () { /* off */ } };
  window.qpAnalytics = api;

  /* ---------- SEO: the Ukrainian variant (?lang=uk) is its own canonical, as listed in hreflang ---------- */
  if (SURFACE === 'landing') {
    try {
      var canon = document.querySelector('link[rel="canonical"]');
      if (canon && new URLSearchParams(location.search).get('lang') === 'uk') canon.href = canon.href.split('?')[0] + '?lang=uk';
    } catch (e) { /* keep the static canonical */ }
  }

  function privacySignal() {
    try {
      var n = navigator;
      if (n.globalPrivacyControl === true) return true;
      var dnt = n.doNotTrack || window.doNotTrack || n.msDoNotTrack;
      if (dnt === '1' || dnt === 'yes') return true;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-data: reduce)').matches) return true;
    } catch (e) { /* treat as no signal */ }
    return false;
  }
  if (privacySignal()) return;
  // Only the teacher-facing pages are tracked; any other surface (and any page inside an iframe) stays off.
  if ((SURFACE !== 'landing' && SURFACE !== 'spec') || window.self !== window.top) return;

  // Props are limited to short primitives with snake_case keys; anything that looks like an email is dropped.
  function clean(props) {
    var out = {};
    if (!props || typeof props !== 'object') return out;
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(k) || v === undefined || v === null) return;
      if (typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) out[k] = v;
      else if (typeof v === 'string' && v.length <= 40 && v.indexOf('@') < 0) out[k] = v;
    });
    return out;
  }

  if (!KEY && !CLARITY) return;
  api.enabled = true;
  var hasRef = /[?&]ref=/.test(location.search);
  var clarityOn = false;

  /* ---------- PostHog (official loader snippet; the library comes from the PostHog assets host) ---------- */
  // Referral codes and fragments are removed from every URL property before an event leaves the page.
  function scrubUrl(v) {
    if (typeof v !== 'string' || !/^https?:\/\//.test(v)) return v;
    try {
      var u = new URL(v);
      u.hash = '';
      u.searchParams.delete('ref');
      return u.toString();
    } catch (e) { return v.split('#')[0]; }
  }
  function scrubEvent(ev) {
    if (!ev) return ev;
    [ev.properties, ev.$set, ev.$set_once].forEach(function (bag) {
      if (bag) Object.keys(bag).forEach(function (k) { bag[k] = scrubUrl(bag[k]); });
    });
    return ev;
  }

  if (KEY) {
    /* eslint-disable */
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    /* eslint-enable */
    window.posthog.init(KEY, {
      api_host: HOST,
      persistence: 'memory',            // cookieless: no cookies, no localStorage, a new anonymous id per page load
      person_profiles: 'identified_only', // we never identify, so every event stays anonymous
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,  // replays start only after the visitor allows analytics
      disable_surveys: true,
      session_recording: { maskAllInputs: true, maskTextSelector: MASK },
      before_send: scrubEvent
    });
    window.posthog.register({ surface: SURFACE, has_ref: hasRef });
  }

  api.track = function (name, props) {
    var p = clean(props);
    if (KEY && window.posthog) window.posthog.capture(String(name), p);
    if (clarityOn && window.clarity) window.clarity('event', String(name));
  };

  // theme_toggled: fires when another script changes <html data-theme> after the page has loaded.
  if (SURFACE === 'landing' && window.MutationObserver) {
    window.addEventListener('load', function () {
      new MutationObserver(function () {
        var theme = document.documentElement.getAttribute('data-theme');
        if (theme) api.track('theme_toggled', { theme: theme });
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    });
  }

  /* ---------- Consent (landing only): Clarity and PostHog replays wait for "Allow analytics" ---------- */
  if (SURFACE !== 'landing') return;

  function readConsent() {
    try {
      var v = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
      if (v && (v.choice === 'granted' || v.choice === 'denied') && Date.now() - v.ts < CONSENT_DAYS * 864e5) return v.choice;
    } catch (e) { /* storage blocked: ask again */ }
    return null;
  }
  function saveConsent(choice) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: choice, ts: Date.now() })); } catch (e) { /* ignore */ }
  }

  function markMasks() {
    document.querySelectorAll(MASK).forEach(function (el) { el.setAttribute('data-clarity-mask', 'True'); });
  }
  function loadClarity() {
    if (clarityOn || !CLARITY) return;
    clarityOn = true;
    markMasks();
    // Dialogs (share link, preview) are added later: mask them as they appear.
    if (window.MutationObserver) new MutationObserver(markMasks).observe(document.body, { childList: true });
    /* eslint-disable */
    (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",encodeURIComponent(CLARITY));
    /* eslint-enable */
    window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
    window.clarity('set', 'surface', SURFACE);
  }
  function grant() {
    loadClarity();
    if (KEY && window.posthog) window.posthog.startSessionRecording();
  }
  function deny() {
    if (clarityOn && window.clarity) {
      window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
      window.clarity('consent', false);
    }
    if (KEY && window.posthog) window.posthog.stopSessionRecording();
  }

  var TEXT = {
    en: {
      label: 'Analytics consent',
      body: 'We would like to use anonymous heatmaps and session replays{via} to improve this page. Your email and lesson text stay hidden in replays.',
      via: CLARITY ? ' via Microsoft Clarity' : ' via PostHog',
      yes: 'Allow analytics', no: 'No thanks', settings: 'Analytics settings'
    },
    uk: {
      label: 'Згода на аналітику',
      body: 'Ми хотіли б використовувати анонімні теплові карти й записи сесій{via}, щоб покращити сторінку. Вашу пошту й текст уроку в записах приховано.',
      via: CLARITY ? ' через Microsoft Clarity' : ' через PostHog',
      yes: 'Дозволити аналітику', no: 'Ні, дякую', settings: 'Налаштування аналітики'
    }
  };
  function tx(k) {
    var L = TEXT[document.documentElement.lang === 'uk' ? 'uk' : 'en'];
    return L[k].replace('{via}', L.via);
  }

  var bar = null, footerBtn = null, cssReady = null;
  function loadCss() {
    if (cssReady) return cssReady;
    cssReady = new Promise(function (ok) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('consent.css?v=20261121c', BASE_URL).href;
      link.onload = link.onerror = function () { ok(); };
      document.head.appendChild(link);
    });
    return cssReady;
  }
  function paint() {
    if (bar) {
      bar.setAttribute('aria-label', tx('label'));
      bar.querySelector('.qp-consent-text').textContent = tx('body');
      bar.querySelector('[data-consent="yes"]').textContent = tx('yes');
      bar.querySelector('[data-consent="no"]').textContent = tx('no');
    }
    if (footerBtn) footerBtn.textContent = tx('settings');
  }
  function choose(choice) {
    saveConsent(choice);
    api.track('consent_chosen', { choice: choice });
    if (choice === 'granted') grant(); else deny();
    hideBar();
  }
  function showBar() {
    loadCss().then(function () {
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'qp-consent';
        bar.setAttribute('role', 'region');
        bar.innerHTML = '<p class="qp-consent-text"></p><div class="qp-consent-actions">' +
          '<button type="button" class="qp-consent-btn is-primary" data-consent="yes"></button>' +
          '<button type="button" class="qp-consent-btn" data-consent="no"></button></div>';
        bar.querySelector('[data-consent="yes"]').addEventListener('click', function () { choose('granted'); });
        bar.querySelector('[data-consent="no"]').addEventListener('click', function () { choose('denied'); });
        document.body.appendChild(bar);
      }
      paint();
      bar.hidden = false;
      requestAnimationFrame(function () { bar.classList.add('is-on'); });
    });
  }
  function hideBar() {
    if (!bar) return;
    bar.classList.remove('is-on');
    bar.hidden = true;
  }
  // A small footer button reopens the choice, so consent can be withdrawn as easily as it was given.
  function addFooterButton() {
    var footer = document.querySelector('.site-footer .wrap, .site-footer');
    if (!footer) return;
    loadCss().then(function () {
      footerBtn = document.createElement('button');
      footerBtn.type = 'button';
      footerBtn.className = 'qp-consent-link';
      footerBtn.addEventListener('click', showBar);
      footer.appendChild(footerBtn);
      paint();
    });
  }

  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function () {
    var choice = readConsent();
    if (choice === 'granted') grant();
    else if (choice === null) setTimeout(showBar, 900);
    addFooterButton();
    // The page language can change after load (EN/UA switch): keep the texts in sync.
    if (window.MutationObserver) new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  });
})();
