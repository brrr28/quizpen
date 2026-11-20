/* Quizpen landing: "Preview as student" and "Share with class" under the demo quiz.
   app.js announces each shown quiz with the `quizpen:quiz` event; the link is built by
   web/play/codec.js and the QR code by web/vendor/qrcode.js (loaded on first use). */
(function () {
  'use strict';

  var Codec = window.QuizpenCodec;
  var panel = document.getElementById('quiz-panel');
  var body = document.getElementById('quiz-body');
  if (!Codec || !panel || !body) return;

  var PLAY = new URL('./', (document.currentScript && document.currentScript.src) || location.href).href;
  var QR_SRC = new URL('../vendor/qrcode.js', PLAY).href;
  var I18N = {
    en: {
      label: 'For your class', preview: 'Preview as student', share: 'Share with class', close: 'Close',
      previewTitle: 'Student view', newTab: 'Open in a new tab', shareTitle: 'Share with your class',
      shareText: 'Students scan the code or open the link on their phones. No sign-up, and nothing about students is collected.',
      linkLabel: 'Quiz link', copy: 'Copy link', copied: 'Link copied. Paste it into your class chat.',
      copyFail: 'Select the link above and copy it.', big: 'Show large for the projector', small: 'Back',
      send: 'Send to…', qrAlt: 'QR code with the quiz link', qrLong: 'This quiz is too long for a QR code. Share the link instead.'
    },
    uk: {
      label: 'Для вашого класу', preview: 'Переглянути як учень', share: 'Поділитися з класом', close: 'Закрити',
      previewTitle: 'Так бачить учень', newTab: 'Відкрити в новій вкладці', shareTitle: 'Поділіться з класом',
      shareText: 'Учні сканують код або відкривають посилання на телефоні. Реєструватися не треба, і жодних даних про учнів ми не збираємо.',
      linkLabel: 'Посилання на тест', copy: 'Копіювати', copied: 'Посилання скопійовано. Вставте його в чат класу.',
      copyFail: 'Виділіть посилання вище й скопіюйте його.', big: 'Показати великим на проєкторі', small: 'Назад',
      send: 'Надіслати…', qrAlt: 'QR-код з посиланням на тест', qrLong: 'Тест задовгий для QR-коду. Надішліть посилання.'
    }
  };
  function t(k) { return I18N[document.documentElement.lang === 'uk' ? 'uk' : 'en'][k]; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function btn(cls, key, onClick) {
    var b = el('button', 'btn ' + cls, t(key));
    b.type = 'button';
    b.setAttribute('data-t', key);
    b.addEventListener('click', onClick);
    return b;
  }

  /* ---------- Current quiz and its link ---------- */
  var current = null, linkValue = '', linkPromise = null;
  function linkFor(detail) {
    return Codec.encode(detail.quiz, detail.lang).then(function (token) {
      return PLAY + (detail.lang ? '?lang=' + detail.lang : '') + '#q=' + token;
    });
  }
  document.addEventListener('quizpen:quiz', function (e) {
    var detail = e.detail;
    current = detail && detail.quiz ? detail : null;
    linkValue = '';
    linkPromise = current ? linkFor(current) : null;
    if (linkPromise) {
      linkPromise.then(function (l) { if (current === detail) linkValue = l; }, function () { if (current === detail) current = null; sync(); });
    }
    sync();
  });

  /* ---------- Tools row under the quiz ---------- */
  var tools = el('div', 'play-tools');
  tools.hidden = true;
  var label = el('p', 'play-tools-label', t('label'));
  label.setAttribute('data-t', 'label');
  var row = el('div', 'play-tools-row');
  row.appendChild(btn('btn-ghost', 'preview', openPreview));
  row.appendChild(btn('btn-ink', 'share', openShare));
  tools.appendChild(label);
  tools.appendChild(row);
  panel.insertBefore(tools, body.nextSibling);

  // Show the tools only while a quiz (a question or the score) is on screen.
  function sync() { tools.hidden = !(current && !body.hidden && body.querySelector('.opts, .score')); }
  new MutationObserver(sync).observe(body, { childList: true, attributes: true, attributeFilter: ['hidden'] });
  // app.js switches <html lang>; follow it.
  new MutationObserver(function () {
    document.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = t(n.getAttribute('data-t')); });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  /* ---------- Dialog helpers ---------- */
  var lastFocus = null;
  function openDialog(d) {
    lastFocus = document.activeElement;
    document.body.appendChild(d);
    document.documentElement.classList.add('play-lock');
    d.addEventListener('close', function () {
      document.documentElement.classList.remove('play-lock');
      d.remove();
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function closeButton(d, cls) {
    var b = btn(cls || 'btn-ghost btn-sm', 'close', function () { d.close(); });
    b.setAttribute('data-play-close', '');
    return b;
  }

  /* ---------- Preview as student: the real player in an iframe ---------- */
  function openPreview() {
    if (!linkPromise) return;
    linkPromise.then(function (link) {
      var d = el('dialog', 'play-dialog play-preview');
      d.setAttribute('aria-label', t('previewTitle'));
      var bar = el('div', 'play-preview-bar');
      var title = el('p', 'play-preview-title', t('previewTitle'));
      var tab = el('a', 'play-preview-tab', t('newTab'));
      tab.href = link;
      tab.target = '_blank';
      tab.rel = 'noopener';
      var frame = el('iframe', 'play-frame');
      frame.title = t('previewTitle');
      frame.src = link;
      bar.appendChild(title);
      bar.appendChild(tab);
      bar.appendChild(closeButton(d));
      d.appendChild(bar);
      d.appendChild(frame);
      openDialog(d);
    });
  }

  /* ---------- Share with class: copy the link, show it as a QR code ---------- */
  var qrReady = null;
  function loadQr() {
    if (window.qrcode) return Promise.resolve();
    if (!qrReady) {
      qrReady = new Promise(function (ok, fail) {
        var s = document.createElement('script');
        s.src = QR_SRC;
        s.onload = ok;
        s.onerror = function () { qrReady = null; fail(new Error('qr_load')); };
        document.head.appendChild(s);
      });
    }
    return qrReady;
  }
  function qrSvg(text) {
    var qr = window.qrcode(0, 'L');
    qr.addData(text, 'Byte');
    qr.make();
    var n = qr.getModuleCount(), m = 4, size = n + m * 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('qrAlt'));
    var bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', String(size));
    bg.setAttribute('height', String(size));
    bg.setAttribute('fill', '#FFFFFF');
    var fg = document.createElementNS(NS, 'path');
    fg.setAttribute('d', d);
    fg.setAttribute('fill', '#161B2E');
    svg.appendChild(bg);
    svg.appendChild(fg);
    return svg;
  }
  function copyText(text, input) {
    var manual = function () {
      input.focus();
      input.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      return ok ? Promise.resolve() : Promise.reject(new Error('copy'));
    };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(manual);
    return manual();
  }

  function openShare() {
    if (!linkPromise) return;
    // Copy inside the click itself when the link is ready: some browsers allow clipboard only there.
    if (linkValue) buildShare(linkValue); else linkPromise.then(buildShare);
  }
  function buildShare(link) {
    var d = el('dialog', 'play-dialog play-share');
    d.setAttribute('aria-labelledby', 'play-share-title');
    var head = el('div', 'play-share-head');
    var h = el('h2', 'play-share-title', t('shareTitle'));
    h.id = 'play-share-title';
    head.appendChild(h);
    head.appendChild(closeButton(d));
    var qrBox = el('div', 'play-qr');
    var big = btn('btn-ghost btn-sm play-big', 'big', function () {
      var on = d.classList.toggle('is-big');
      big.textContent = t(on ? 'small' : 'big');
      big.setAttribute('data-t', on ? 'small' : 'big');
    });
    var lab = el('label', 'play-link-label', t('linkLabel'));
    lab.htmlFor = 'play-link';
    var input = el('input', 'play-link');
    input.id = 'play-link';
    input.readOnly = true;
    input.value = link;
    input.addEventListener('focus', function () { input.select(); });
    var status = el('p', 'play-share-status');
    status.setAttribute('role', 'status');
    var copy = function () {
      copyText(link, input).then(function () { status.textContent = t('copied'); }, function () { status.textContent = t('copyFail'); });
    };
    var linkRow = el('div', 'play-link-row');
    linkRow.appendChild(input);
    linkRow.appendChild(btn('btn-ink', 'copy', copy));
    [head, el('p', 'play-share-text', t('shareText')), qrBox, big, lab, linkRow, status].forEach(function (n) { d.appendChild(n); });
    if (navigator.share) {
      d.appendChild(btn('btn-ghost play-send', 'send', function () {
        navigator.share({ title: 'Quizpen', url: link }).catch(function () { /* the teacher closed the sheet */ });
      }));
    }
    openDialog(d);
    copy();
    loadQr().then(function () {
      try { qrBox.appendChild(qrSvg(link)); } catch (e) { qrBox.appendChild(el('p', 'play-qr-note', t('qrLong'))); big.hidden = true; }
    }, function () { qrBox.hidden = true; big.hidden = true; });
  }
})();
