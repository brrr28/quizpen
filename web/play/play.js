/* Quizpen student player: one question per screen, instant feedback, stars at the end.
   The quiz comes only from the URL fragment. No network calls, answers are never stored or sent.
   ES2017 syntax on purpose: old phones must still parse it to show a friendly error. */
(function () {
  'use strict';

  var Codec = window.QuizpenCodec;
  var app = document.getElementById('app');
  var I18N = {
    en: {
      keys: ['A', 'B', 'C', 'D'], loading: 'Loading the quiz…',
      privacy: 'No sign-up, and nothing about you is collected. Your answers are not saved or sent anywhere.',
      meta: '{n} questions · about {m} min', start: 'Start', hint: 'Tap the answer you think is correct. You\'ll see why right away.',
      progress: 'Question {i} of {n}', streak: 'Streak', streakLabel: '{n} in a row',
      right: ['Right!', 'Correct!', 'Yes, that\'s it.'], wrong: 'Not quite. The answer is {a}.', inRow: '{n} in a row!',
      next: 'Next question', finish: 'See my result',
      stars3: 'Excellent work!', stars2: 'Good job! Almost there.', stars1: 'Good start. Look at the answers and try again.',
      score: 'You got {s} of {n} right', starsLabel: '{s} of 3 stars', best: 'Best streak: {n} in a row',
      review: 'Review answers', again: 'Play again', back: 'Back to result', yours: 'Your answer', correct: 'Correct answer',
      made: 'Made with Quizpen', home: 'Go to Quizpen',
      e_missing: ['There is no quiz in this link', 'Ask your teacher for the quiz link, or make your own quiz on Quizpen.'],
      e_broken: ['This quiz link looks broken', 'Part of the link may have been lost when it was copied. Ask your teacher to send it again.'],
      e_unsupported: ['This browser cannot open the quiz', 'Update your browser or open the link in Chrome, Safari or Firefox.']
    },
    uk: {
      keys: ['А', 'Б', 'В', 'Г'], loading: 'Завантажуємо тест…',
      privacy: 'Без реєстрації. Ми не збираємо жодних даних про тебе: відповіді не зберігаються й нікуди не надсилаються.',
      meta: '{n} {qw} · приблизно {m} хв', start: 'Почати',
      hint: 'Натисни відповідь, яку вважаєш правильною. Пояснення побачиш одразу.',
      progress: 'Питання {i} з {n}', streak: 'Серія', streakLabel: '{n} поспіль',
      right: ['Правильно!', 'Так, саме так.', 'Влучно!'],
      wrong: 'Не зовсім. Правильна відповідь: {a}.', inRow: '{n} поспіль!',
      next: 'Далі', finish: 'Мій результат',
      stars3: 'Відмінно!', stars2: 'Добре! Ще трохи, і буде ідеально.',
      stars1: 'Гарний початок. Переглянь відповіді й спробуй ще раз.',
      score: 'Правильно {s} з {n}', starsLabel: '{s} з 3 зірок', best: 'Найкраща серія: {n} поспіль',
      review: 'Переглянути відповіді', again: 'Пройти ще раз', back: 'До результату',
      yours: 'Твоя відповідь', correct: 'Правильна відповідь',
      made: 'Зроблено в Quizpen', home: 'Перейти до Quizpen',
      e_missing: ['У цьому посиланні немає тесту', 'Попроси в учителя посилання на тест або створи власний у Quizpen.'],
      e_broken: ['Схоже, посилання пошкоджене', 'Можливо, під час копіювання частина посилання загубилася. Попроси вчителя надіслати його ще раз.'],
      e_unsupported: ['Цей браузер не може відкрити тест', 'Онови браузер або відкрий посилання в Chrome, Safari чи Firefox.']
    }
  };

  var lang = langFromUrl() || langFromStore();
  var state = null;

  function langFromUrl() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'ua') q = 'uk';
    return q === 'en' || q === 'uk' ? q : null;
  }
  // The landing saves the language as a JSON string under qp_lang (same origin).
  function langFromStore() {
    try { var v = JSON.parse(localStorage.getItem('qp_lang') || 'null'); return v === 'en' || v === 'uk' ? v : null; } catch (e) { return null; }
  }
  function langFromBrowser() {
    var langs = navigator.languages || [navigator.language || 'en'];
    return langs.some(function (l) { return /^uk\b/i.test(l); }) ? 'uk' : 'en';
  }
  function t(key, vars) {
    var v = I18N[lang][key];
    if (typeof v !== 'string') return v;
    return v.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? String(vars[k]) : m; });
  }
  function qWord(n) {
    if (lang !== 'uk') return '';
    var c = new Intl.PluralRules('uk').select(n);
    return c === 'one' ? 'питання' : (c === 'few' ? 'питання' : 'питань');
  }

  /* ---------- DOM helpers: text goes in through textContent only ---------- */
  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }
  function add(parent) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }
  function button(cls, label, onClick, iconName) {
    var b = h('button', 'btn ' + cls);
    b.type = 'button';
    add(b, h('span', null, label), iconName ? icon(iconName) : null);
    b.addEventListener('click', onClick);
    return b;
  }
  var PATHS = {
    check: ['M5 12l5 5l10 -10'],
    x: ['M18 6l-12 12', 'M6 6l12 12'],
    arrow: ['M5 12h14', 'M13 18l6 -6', 'M13 6l6 6'],
    refresh: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
    list: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M5 6v.01', 'M5 12v.01', 'M5 18v.01'],
    bolt: ['M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11'],
    star: ['M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z'],
    info: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 9h.01', 'M11 12h1v4h1']
  };
  function icon(name, cls) {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    PATHS[name].forEach(function (d) { var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.appendChild(p); });
    return svg;
  }
  function show(screen, focusEl) {
    app.textContent = '';
    app.appendChild(screen);
    window.scrollTo(0, 0);
    if (focusEl) focusEl.focus({ preventScroll: true });
  }
  function privacy() { return h('p', 'privacy', t('privacy')); }
  function brand() {
    var a = h('a', 'brand', t('made'));
    a.href = '../';
    a.target = '_top';
    return a;
  }

  /* ---------- Screens ---------- */
  function renderStart() {
    var qs = state.quiz.questions, s = h('main', 'screen screen-start');
    var title = h('h1', 'start-title', state.quiz.title || 'Quizpen');
    title.tabIndex = -1;
    add(s,
      h('p', 'eyebrow', 'Quizpen'),
      title,
      h('p', 'start-meta', t('meta', { n: qs.length, qw: qWord(qs.length), m: Math.max(1, Math.round(qs.length * 0.4)) })),
      h('p', 'start-hint', t('hint')),
      add(h('div', 'actions'), button('btn-primary', t('start'), function () { begin(); }, 'arrow')),
      privacy());
    show(s, title);
  }

  function begin() {
    state.i = 0; state.picks = []; state.streak = 0; state.best = 0;
    renderQuestion();
  }

  function dots() {
    var wrap = h('div', 'dots');
    wrap.setAttribute('aria-hidden', 'true');
    state.quiz.questions.forEach(function (q, k) {
      var p = state.picks[k];
      wrap.appendChild(h('i', p === undefined ? (k === state.i ? 'is-now' : '') : (p === q.answer ? 'is-right' : 'is-wrong')));
    });
    return wrap;
  }
  function streakChip() {
    var c = h('p', 'streak' + (state.streak >= 2 ? ' is-hot' : ''));
    c.setAttribute('aria-label', t('streak') + ': ' + t('streakLabel', { n: state.streak }));
    add(c, icon('bolt'), h('span', 'streak-n', String(state.streak)));
    return c;
  }

  function renderQuestion() {
    var qs = state.quiz.questions, q = qs[state.i], keys = t('keys');
    var s = h('main', 'screen screen-q');
    var top = add(h('header', 'bar'), dots(), h('p', 'count', (state.i + 1) + '/' + qs.length), streakChip());
    var qText = h('h1', 'q', q.q);
    qText.tabIndex = -1;
    var sr = h('p', 'sr-only', t('progress', { i: state.i + 1, n: qs.length }));
    var list = h('ul', 'opts');
    var feedback = h('div', 'feedback');
    feedback.setAttribute('role', 'status');
    var foot = h('div', 'foot');
    q.options.forEach(function (o, k) {
      var b = h('button', 'opt');
      b.type = 'button';
      b.setAttribute('data-k', String(k));
      add(b, h('span', 'opt-key', keys[k]), h('span', 'opt-text', o));
      b.addEventListener('click', function () { pick(k, list, feedback, foot, top); });
      add(list, add(h('li'), b));
    });
    add(s, top, sr, qText, list, feedback, foot);
    show(s, qText);
  }

  function pick(k, list, feedback, foot, top) {
    if (state.picks[state.i] !== undefined) return;
    var qs = state.quiz.questions, q = qs[state.i], ok = k === q.answer, keys = t('keys');
    state.picks[state.i] = k;
    state.streak = ok ? state.streak + 1 : 0;
    state.best = Math.max(state.best, state.streak);

    list.querySelectorAll('.opt').forEach(function (b, j) {
      b.disabled = true;
      if (j === q.answer) { b.classList.add('is-right'); b.appendChild(icon('check', 'opt-mark')); }
      else if (j === k) { b.classList.add('is-wrong'); b.appendChild(icon('x', 'opt-mark')); }
      else b.classList.add('is-dim');
      if (j === k) b.classList.add('is-picked');
    });
    top.replaceChild(dots(), top.firstChild);
    var chip = streakChip();
    if (ok && state.streak > 0) chip.classList.add('is-bump');
    top.replaceChild(chip, top.lastChild);

    var head = ok ? t('right')[state.i % 3] : t('wrong', { a: keys[q.answer] });
    if (ok && state.streak >= 3) head += ' ' + t('inRow', { n: state.streak });
    feedback.className = 'feedback is-on ' + (ok ? 'is-right' : 'is-wrong');
    add(feedback, h('strong', null, head), q.explain ? h('p', null, q.explain) : null);

    var last = state.i === qs.length - 1;
    var next = button('btn-primary', last ? t('finish') : t('next'), function () {
      state.i++;
      if (last) renderFinal(); else renderQuestion();
    }, 'arrow');
    next.setAttribute('data-next', '');
    add(foot, next);
    foot.classList.add('is-on');
    next.focus({ preventScroll: true });
    // Keep the explanation in view on short screens.
    feedback.scrollIntoView({ block: 'nearest' });
  }

  function result() {
    var qs = state.quiz.questions, right = 0;
    qs.forEach(function (q, k) { if (state.picks[k] === q.answer) right++; });
    var ratio = right / qs.length;
    return { right: right, n: qs.length, stars: ratio >= 0.8 ? 3 : (ratio >= 0.5 ? 2 : 1) };
  }

  function renderFinal() {
    var r = result(), s = h('main', 'screen screen-final');
    var stars = h('div', 'stars');
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', t('starsLabel', { s: r.stars }));
    for (var k = 0; k < 3; k++) stars.appendChild(icon('star', k < r.stars ? 'star is-on' : 'star'));
    var msg = h('h1', 'final-msg', t('stars' + r.stars));
    msg.tabIndex = -1;
    add(s,
      stars,
      msg,
      h('p', 'final-score', r.right + '/' + r.n),
      h('p', 'final-sub', t('score', { s: r.right, n: r.n })),
      state.best >= 2 ? add(h('p', 'final-best'), icon('bolt'), h('span', null, t('best', { n: state.best }))) : null,
      add(h('div', 'actions'),
        button('btn-primary', t('again'), function () { begin(); }, 'refresh'),
        button('btn-ghost', t('review'), function () { renderReview(); }, 'list')),
      privacy(),
      brand());
    show(s, msg);
  }

  function renderReview() {
    var keys = t('keys'), s = h('main', 'screen screen-review');
    var title = h('h1', 'review-title', t('review'));
    title.tabIndex = -1;
    var list = h('ol', 'review-list');
    state.quiz.questions.forEach(function (q, k) {
      var p = state.picks[k], ok = p === q.answer;
      var item = h('li', 'review-item ' + (ok ? 'is-right' : 'is-wrong'));
      var mark = add(h('span', 'review-mark'), icon(ok ? 'check' : 'x'));
      add(item,
        add(h('p', 'review-q'), mark, h('span', null, (k + 1) + '. ' + q.q)),
        h('p', 'review-line', t('yours') + ': ' + keys[p] + ') ' + q.options[p]),
        ok ? null : h('p', 'review-line is-correct', t('correct') + ': ' + keys[q.answer] + ') ' + q.options[q.answer]),
        q.explain ? h('p', 'review-explain', q.explain) : null);
      list.appendChild(item);
    });
    add(s, title, list,
      add(h('div', 'actions'),
        button('btn-primary', t('again'), function () { begin(); }, 'refresh'),
        button('btn-ghost', t('back'), function () { renderFinal(); })),
      privacy());
    show(s, title);
  }

  function renderError(code) {
    var copy = t('e_' + code) || t('e_broken'), s = h('main', 'screen screen-center screen-error');
    var title = h('h1', 'error-title', copy[0]);
    title.tabIndex = -1;
    var home = h('a', 'btn btn-ghost', t('home'));
    home.href = '../';
    home.target = '_top';
    add(s, add(h('span', 'error-icon'), icon('info')), title, h('p', 'error-text', copy[1]), add(h('div', 'actions'), home), privacy());
    show(s, title);
  }

  /* ---------- Keyboard: 1-4 or A-D pick an answer ---------- */
  document.addEventListener('keydown', function (e) {
    if (!state || e.altKey || e.ctrlKey || e.metaKey) return;
    var k = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (k < 0) k = ['KeyA', 'KeyB', 'KeyC', 'KeyD'].indexOf(e.code);
    if (k < 0) return;
    var b = app.querySelector('.opt[data-k="' + k + '"]:not(:disabled)');
    if (b) { e.preventDefault(); b.click(); }
  });

  /* ---------- Boot ---------- */
  function setLang(next) {
    lang = next;
    document.documentElement.lang = lang;
  }
  function boot() {
    setLang(lang || langFromBrowser());
    var bootEl = app.querySelector('.boot');
    if (bootEl) bootEl.textContent = t('loading');
    if (!Codec) { renderError('unsupported'); return; }
    Codec.decode(Codec.tokenFromHash(location.hash)).then(function (r) {
      if (!r.ok) { renderError(r.error); return; }
      if (!langFromUrl() && !langFromStore() && r.lang) setLang(r.lang);
      state = { quiz: r.quiz, i: 0, picks: [], streak: 0, best: 0 };
      document.title = (r.quiz.title ? r.quiz.title + ' · ' : '') + 'Quizpen';
      renderStart();
    }, function () { renderError('broken'); });
  }
  // A new link pasted into the same tab only changes the fragment: start over with it.
  window.addEventListener('hashchange', function () { state = null; boot(); });
  boot();
})();
