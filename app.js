/* Quizpen waitlist page logic: i18n, waitlist signup, live quiz demo, confetti. */
(function () {
  'use strict';

  var API = String(window.WAITLIST_API || '').trim();
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MIN_CHARS = 200, MAX_CHARS = 3000, REFRESH_MS = 6 * 3600 * 1000;

  // localStorage wrapper: storage can be blocked or throw in private modes.
  var store = {
    get: function (k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  var I18N = {
    en: {
      'meta.title': 'Quizpen: turn lesson text into a quiz in seconds',
      'meta.desc': 'Paste a paragraph from your lesson and get a multiple-choice quiz with answers and explanations. Join the Quizpen waitlist for teachers.',
      'skip': 'Skip to content', 'nav.demo': 'Try the demo', 'nav.faq': 'Questions', 'lang.label': 'Language',
      'cta': 'Join Waitlist', 'cta.joined': 'You\'re on the list',
      'hero.kicker': 'An AI assistant for teachers',
      'hero.title': 'Paste a lesson. Get a <mark class="hl">quiz</mark> before the bell.',
      'hero.sub': 'Quizpen turns the text you teach from into a multiple-choice quiz with answers and a short explanation for each.',
      'form.label': 'Email for early access', 'form.placeholder': 'name@school.org',
      'form.note': 'One email when your access is ready. Unsubscribe in one click.',
      'form.sending': 'Joining',
      'err.empty': 'Enter your email so we can save your spot.',
      'err.invalid_email': 'That email doesn\'t look right. Check it for typos.',
      'err.rate_limited': 'Too many tries from this device. Wait a minute, then try again.',
      'err.server': 'We couldn\'t save your email just now. Please try again in a minute.',
      'err.offline': 'No connection. Check your internet and try again.',
      'counter': { one: '{n} teacher already joined', other: '{n} teachers already joined' },
      'counter.first': 'Be one of the first teachers to try it',
      'thanks.title': 'You\'re #{n} on the waitlist',
      'thanks.body': 'We\'ll email {email} when your access is ready.',
      'thanks.already': 'You were already on the list, so your spot is saved.',
      'thanks.share': 'Know a colleague who writes quizzes at night? Send them your link.',
      'thanks.linkLabel': 'Your invite link', 'thanks.copy': 'Copy link', 'thanks.copied': 'Copied',
      'thanks.copiedSr': 'Link copied to clipboard', 'thanks.reset': 'Use a different email',
      'thanks.refs': { one: '<strong>{n} colleague</strong> joined via your link', other: '<strong>{n} colleagues</strong> joined via your link' },
      'share.email': 'Email',
      'share.text': 'I joined the Quizpen waitlist. It turns lesson text into a quiz in seconds:',
      'share.subject': 'Quizzes from our lesson texts in seconds',
      'art.label': 'Your lesson text',
      'art.source': 'Chlorophyll absorbs red and blue light and <mark class="hl hl-art">reflects green light</mark>, which is why most leaves look green.',
      'art.progress': 'Question 2 of 5', 'art.q': 'Why do most leaves look green?',
      'art.a': 'They absorb green light', 'art.b': 'Chlorophyll reflects green light',
      'art.c': 'Their cells hold green water', 'art.d': 'Sunlight is mostly green',
      'art.explain': 'Chlorophyll reflects green, so green is what reaches our eyes.',
      'demo.title': 'Try it on your own lesson',
      'demo.sub': 'Paste a paragraph from your lesson and get a quiz in seconds.',
      'demo.label': 'Lesson text',
      'demo.placeholder': 'Paste 200 to 3000 characters: a textbook page, your notes or an article.',
      'demo.samples': 'No text at hand? Try a sample:',
      'demo.need': { one: '{n} more character needed', other: '{n} more characters needed' },
      'demo.ready': 'Ready to generate',
      'demo.generate': 'Generate quiz',
      'demo.steps': ['Reading your text', 'Picking the key facts', 'Writing answer options'],
      'demo.working': 'Writing your quiz, this takes a few seconds.',
      'demo.too_short': 'Add a bit more text: the demo needs at least 200 characters.',
      'demo.too_long': 'That\'s over 3000 characters. Trim it to one or two paragraphs.',
      'demo.fallback': 'The live demo is busy, here is a sample quiz for this text.',
      'demo.fallbackOwn': 'The live demo is busy, here is a sample quiz on photosynthesis instead.',
      'demo.failed': 'The live demo is busy right now. Please try again in a minute.',
      'sample.photosynthesis': 'Biology: photosynthesis', 'sample.printing': 'History: the printing press', 'sample.magi': 'Literature: The Gift of the Magi',
      'quiz.region': 'Your quiz', 'quiz.emptyTitle': 'Your quiz will appear here',
      'quiz.emptySub': 'Five questions, four options each, with a one-line explanation for every answer.',
      'quiz.progress': 'Question {i} of {n}', 'quiz.right': 'Correct.', 'quiz.wrong': 'Not quite. The answer is {a}.',
      'quiz.next': 'Next question', 'quiz.finish': 'See my score', 'quiz.score': '{s} of {n} correct',
      'quiz.perfect': 'Full marks.', 'quiz.good': 'Nice work.', 'quiz.low': 'A good start.',
      'quiz.noteLive': 'Every question, option and explanation was written from the text you gave it.',
      'quiz.noteSample': 'This sample quiz was written in advance from the sample text.',
      'quiz.again': 'Try another text', 'quiz.cta': 'Want this for your class? Join the waitlist',
      'quiz.ready': 'Quiz ready: {n} questions.',
      'features.title': 'What Quizpen does for you',
      'features.sub': 'Built around the way teachers already plan: start from the material, end with something students can answer.',
      'f1.t': 'Works from the text you already teach',
      'f1.d': 'Paste a textbook page, your own notes or an article. Every question comes from that text, so the quiz matches your lesson.',
      'f2.t': 'An answer key that explains itself',
      'f2.d': 'Each question has one correct answer and a one-sentence reason. You check the key at a glance, and students see why they got it wrong.',
      'f3.t': 'Ready for the board or for paper',
      'f3.d': 'Run the quiz on screen as a warm-up, or print it as a worksheet for the last ten minutes of class.',
      'proof.title': 'Why we\'re building this',
      'proof.1': '<strong>About 4 hours a week</strong> is how long a typical lower secondary teacher spends marking and correcting student work.',
      'proof.2': '<strong>5.9 hours a week</strong> is the time teachers who use AI tools at least weekly say they save.',
      'proof.3': '<strong>Quizzing beats re-reading.</strong> A week after studying a text, students who practised recalling it remembered more than students who read it again.',
      'src.1': '<a href="https://www.oecd.org/en/publications/talis-2018-results-volume-i_1d0bc92a-en.html" target="_blank" rel="noopener noreferrer">OECD, TALIS 2018 Results</a>, OECD average for lower secondary teachers, as summarised by <a href="https://rd.acer.org/article/snapshot-of-australian-teachers-and-principals" target="_blank" rel="noopener noreferrer">ACER</a>.',
      'src.2': '<a href="https://news.gallup.com/poll/691967/three-teachers-weekly-saving-six-weeks-year.aspx" target="_blank" rel="noopener noreferrer">Gallup and Walton Family Foundation, 2025</a>. Survey of 2,232 US public school teachers; time saved is self-reported.',
      'src.3': '<a href="https://doi.org/10.1111/j.1467-9280.2006.01693.x" target="_blank" rel="noopener noreferrer">Roediger and Karpicke, "Test-Enhanced Learning"</a>, Psychological Science, 2006.',
      'faq.title': 'Questions teachers ask',
      'faq.q1': 'When can I start using Quizpen?',
      'faq.a1': 'We\'re letting teachers in small groups, in the order they joined. We\'ll send one email when your spot opens.',
      'faq.q2': 'Will it cost anything?',
      'faq.a2': 'Early access is free for teachers on the waitlist. If we add paid plans later, you\'ll hear about it before anything changes.',
      'faq.q3': 'Which subjects and languages does it work for?',
      'faq.a3': 'Any subject you teach from text: science, history, literature, geography and more. The demo above works in English and Ukrainian.',
      'faq.q4': 'What happens to the text I paste?',
      'faq.a4': 'It\'s sent to an AI model only to write your quiz. Paste lesson material and leave out student names or other personal details.',
      'final.title': 'Get Quizpen before your next unit starts.',
      'footer.privacy': 'We use your email only to tell you about access.'
    },
    uk: {
      'meta.title': 'Quizpen: тест із тексту уроку за лічені секунди',
      'meta.desc': 'Вставте абзац із уроку й отримайте тест із варіантами відповідей і поясненнями. Приєднуйтеся до списку очікування Quizpen для вчителів.',
      'skip': 'Перейти до змісту', 'nav.demo': 'Спробувати демо', 'nav.faq': 'Питання', 'lang.label': 'Мова',
      'cta': 'Приєднатися до списку', 'cta.joined': 'Ви вже в списку',
      'hero.kicker': 'ШІ-помічник для вчителів',
      'hero.title': 'Вставте текст уроку. Отримайте <mark class="hl">тест</mark> ще до дзвінка.',
      'hero.sub': 'Quizpen перетворює текст, за яким ви ведете урок, на тест із варіантами відповідей і коротким поясненням до кожного питання.',
      'form.label': 'Пошта для раннього доступу', 'form.placeholder': 'imia@shkola.ua',
      'form.note': 'Один лист, коли доступ буде готовий. Відписатися можна одним кліком.',
      'form.sending': 'Додаємо',
      'err.empty': 'Введіть пошту, щоб ми зберегли ваше місце.',
      'err.invalid_email': 'Схоже, в адресі помилка. Перевірте її, будь ласка.',
      'err.rate_limited': 'Забагато спроб із цього пристрою. Зачекайте хвилину й спробуйте ще раз.',
      'err.server': 'Не вдалося зберегти пошту. Спробуйте ще раз за хвилину.',
      'err.offline': 'Немає з\'єднання. Перевірте інтернет і спробуйте ще раз.',
      'counter': { one: '{n} вчитель уже приєднався', few: '{n} вчителі вже приєдналися', many: '{n} вчителів уже приєдналися', other: '{n} вчителя вже приєдналися' },
      'counter.first': 'Станьте одним із перших учителів, які спробують Quizpen',
      'thanks.title': 'Ви №{n} у списку очікування',
      'thanks.body': 'Ми напишемо на {email}, щойно доступ буде готовий.',
      'thanks.already': 'Ви вже були в списку, тож ваше місце збережене.',
      'thanks.share': 'Знаєте колегу, який складає тести вечорами? Надішліть йому своє посилання.',
      'thanks.linkLabel': 'Ваше посилання-запрошення', 'thanks.copy': 'Копіювати', 'thanks.copied': 'Скопійовано',
      'thanks.copiedSr': 'Посилання скопійовано', 'thanks.reset': 'Записати іншу пошту',
      'thanks.refs': { one: '<strong>{n} колега</strong> приєднався за вашим посиланням', few: '<strong>{n} колеги</strong> приєдналися за вашим посиланням', many: '<strong>{n} колег</strong> приєдналися за вашим посиланням', other: '<strong>{n} колеги</strong> приєдналися за вашим посиланням' },
      'share.email': 'Пошта',
      'share.text': 'Я в списку очікування Quizpen. Він робить тест із тексту уроку за лічені секунди:',
      'share.subject': 'Тести з текстів наших уроків за секунди',
      'art.label': 'Текст вашого уроку',
      'art.source': 'Хлорофіл поглинає червоне й синє світло та <mark class="hl hl-art">відбиває зелене</mark>, тому більшість листків здаються зеленими.',
      'art.progress': 'Питання 2 з 5', 'art.q': 'Чому більшість листків здаються зеленими?',
      'art.a': 'Вони поглинають зелене світло', 'art.b': 'Хлорофіл відбиває зелене світло',
      'art.c': 'Їхні клітини містять зелену воду', 'art.d': 'Сонячне світло переважно зелене',
      'art.explain': 'Хлорофіл відбиває зелене світло, тому до наших очей доходить саме воно.',
      'demo.title': 'Спробуйте на своєму уроці',
      'demo.sub': 'Вставте абзац із уроку й отримайте тест за лічені секунди.',
      'demo.label': 'Текст уроку',
      'demo.placeholder': 'Вставте від 200 до 3000 символів: сторінку підручника, свій конспект або статтю.',
      'demo.samples': 'Немає тексту під рукою? Візьміть приклад:',
      'demo.need': { one: 'ще {n} символ', few: 'ще {n} символи', many: 'ще {n} символів', other: 'ще {n} символу' },
      'demo.ready': 'Можна створювати',
      'demo.generate': 'Створити тест',
      'demo.steps': ['Читаємо текст', 'Вибираємо головні факти', 'Пишемо варіанти відповідей'],
      'demo.working': 'Пишемо тест, це займе кілька секунд.',
      'demo.too_short': 'Додайте трохи тексту: демо потрібно щонайменше 200 символів.',
      'demo.too_long': 'Це понад 3000 символів. Скоротіть до одного-двох абзаців.',
      'demo.fallback': 'Живе демо зараз зайняте, ось готовий тест для цього тексту.',
      'demo.fallbackOwn': 'Живе демо зараз зайняте, ось готовий приклад тесту про фотосинтез.',
      'demo.failed': 'Живе демо зараз зайняте. Спробуйте ще раз за хвилину.',
      'sample.photosynthesis': 'Біологія: фотосинтез', 'sample.printing': 'Історія: друкарський верстат', 'sample.magi': 'Література: «Дари волхвів»',
      'quiz.region': 'Ваш тест', 'quiz.emptyTitle': 'Тут з\'явиться ваш тест',
      'quiz.emptySub': 'П\'ять питань, по чотири варіанти, і коротке пояснення до кожної відповіді.',
      'quiz.progress': 'Питання {i} з {n}', 'quiz.right': 'Правильно.', 'quiz.wrong': 'Не зовсім. Правильна відповідь: {a}.',
      'quiz.next': 'Наступне питання', 'quiz.finish': 'Мій результат', 'quiz.score': '{s} з {n} правильно',
      'quiz.perfect': 'Усе правильно.', 'quiz.good': 'Гарний результат.', 'quiz.low': 'Непоганий початок.',
      'quiz.noteLive': 'Кожне питання, варіант і пояснення створено з тексту, який ви дали.',
      'quiz.noteSample': 'Цей приклад тесту підготовлено заздалегідь із тексту прикладу.',
      'quiz.again': 'Спробувати інший текст', 'quiz.cta': 'Хочете такий тест для свого класу? Приєднуйтеся до списку',
      'quiz.ready': 'Тест готовий: питань {n}.',
      'features.title': 'Що Quizpen робить за вас',
      'features.sub': 'Усе побудовано так, як учителі вже готуються до уроків: від матеріалу до питань, на які учні можуть відповісти.',
      'f1.t': 'Працює з текстом, за яким ви вже навчаєте',
      'f1.d': 'Вставте сторінку підручника, свій конспект чи статтю. Кожне питання береться саме з цього тексту, тому тест відповідає вашому уроку.',
      'f2.t': 'Ключ відповідей із поясненнями',
      'f2.d': 'Кожне питання має одну правильну відповідь і пояснення в одне речення. Ви перевіряєте ключ одним поглядом, а учні бачать, де помилилися.',
      'f3.t': 'Готовий для дошки або для друку',
      'f3.d': 'Запустіть тест на екрані як розминку або роздрукуйте його як картку на останні десять хвилин уроку.',
      'proof.title': 'Чому ми це робимо',
      'proof.1': '<strong>Близько 4 годин на тиждень</strong> типовий учитель 5-9 класів витрачає на перевірку й виправлення учнівських робіт.',
      'proof.2': '<strong>5,9 години на тиждень</strong>, за власною оцінкою, заощаджують учителі, які користуються ШІ-інструментами щонайменше раз на тиждень.',
      'proof.3': '<strong>Тест працює краще за перечитування.</strong> Через тиждень після вивчення тексту учні, які пробували відтворити його з пам\'яті, пам\'ятали більше, ніж ті, хто просто перечитав.',
      'src.1': '<a href="https://www.oecd.org/en/publications/talis-2018-results-volume-i_1d0bc92a-en.html" target="_blank" rel="noopener noreferrer">ОЕСР, TALIS 2018</a>, середнє значення ОЕСР для вчителів 5-9 класів, за підсумком <a href="https://rd.acer.org/article/snapshot-of-australian-teachers-and-principals" target="_blank" rel="noopener noreferrer">ACER</a>.',
      'src.2': '<a href="https://news.gallup.com/poll/691967/three-teachers-weekly-saving-six-weeks-year.aspx" target="_blank" rel="noopener noreferrer">Gallup і Walton Family Foundation, 2025</a>. Опитування 2 232 учителів державних шкіл США; заощаджений час оцінили самі вчителі.',
      'src.3': '<a href="https://doi.org/10.1111/j.1467-9280.2006.01693.x" target="_blank" rel="noopener noreferrer">Roediger і Karpicke, "Test-Enhanced Learning"</a>, Psychological Science, 2006.',
      'faq.title': 'Що питають учителі',
      'faq.q1': 'Коли я зможу користуватися Quizpen?',
      'faq.a1': 'Ми відкриваємо доступ невеликими групами, у порядку реєстрації. Коли настане ваша черга, надішлемо один лист.',
      'faq.q2': 'Це платно?',
      'faq.a2': 'Ранній доступ безкоштовний для вчителів зі списку очікування. Якщо згодом з\'являться платні тарифи, ми попередимо заздалегідь.',
      'faq.q3': 'Для яких предметів і мов це працює?',
      'faq.a3': 'Для будь-якого предмета, де є текст: природничі науки, історія, література, географія та інші. Демо вище працює українською та англійською.',
      'faq.q4': 'Що відбувається з текстом, який я вставляю?',
      'faq.a4': 'Його надсилають моделі ШІ лише для того, щоб скласти тест. Вставляйте матеріал уроку без імен учнів та інших особистих даних.',
      'final.title': 'Отримайте Quizpen до початку наступної теми.',
      'footer.privacy': 'Вашу пошту використовуємо лише для листа про доступ.'
    }
  };

  /* ---------- i18n ---------- */
  var lang = pickLang();

  function pickLang() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'uk') return q;
    var saved = store.get('qp_lang');
    if (saved === 'en' || saved === 'uk') return saved;
    var langs = navigator.languages || [navigator.language || 'en'];
    return langs.some(function (l) { return /^uk\b/i.test(l); }) ? 'uk' : 'en';
  }
  function raw(key) { var v = I18N[lang][key]; return v === undefined ? I18N.en[key] : v; }
  function fill(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? vars[k] : m; });
  }
  function t(key, vars) { var v = raw(key); return v === undefined ? key : fill(v, vars); }
  function tp(key, n, vars) {
    var forms = raw(key), cat = new Intl.PluralRules(lang).select(n);
    var o = Object.assign({ n: fmt(n) }, vars);
    return fill(forms[cat] || forms.other, o);
  }
  function fmt(n) { return new Intl.NumberFormat(lang === 'uk' ? 'uk-UA' : 'en-US').format(n); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function applyI18n() {
    document.documentElement.lang = lang;
    document.title = t('meta.title');
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.desc'));
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':'); if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
    document.querySelectorAll('.lang [data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
  }

  function setLang(next) {
    if (next === lang) return;
    var prevSampleText = activeSample && samples ? sampleText(activeSample) : null;
    lang = next;
    store.set('qp_lang', lang);
    applyI18n();
    renderCounters();
    if (joined) renderThanks(joined, false);
    updateFinalCta();
    if (activeSample && lessonEl.value === prevSampleText) lessonEl.value = sampleText(activeSample);
    updateLessonMeta();
    if (quizState) renderQuiz();
  }

  /* ---------- API ---------- */
  function ApiError(code) { this.code = code; }

  function request(url, opts, timeoutMs) {
    if (!API) return Promise.reject(new ApiError('server'));
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs);
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return null; });
    }).then(function (data) {
      if (!data || typeof data !== 'object') throw new ApiError('server');
      return data;
    }).catch(function (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(navigator.onLine === false ? 'offline' : (e && e.name === 'AbortError' ? 'timeout' : 'network'));
    }).finally(function () { clearTimeout(timer); });
  }
  function apiGet(params, timeoutMs) {
    var qs = new URLSearchParams(params).toString();
    return request(API + (API.indexOf('?') === -1 ? '?' : '&') + qs, { method: 'GET' }, timeoutMs);
  }
  function apiPost(body, timeoutMs) {
    // text/plain keeps the request "simple", so Apps Script needs no CORS preflight.
    return request(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }, timeoutMs);
  }

  function getCid() {
    var cid = store.get('qp_cid');
    if (typeof cid === 'string' && cid.length >= 8) return cid;
    cid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    store.set('qp_cid', cid);
    return cid;
  }

  // First-touch attribution: ?ref= and utm_* from the URL, remembered for later visits.
  function readAttribution() {
    var p = new URLSearchParams(location.search);
    var ref = p.get('ref');
    var fromUrl = {
      ref: ref && /^[A-Za-z0-9_-]{1,40}$/.test(ref) ? ref : null,
      utm: { source: (p.get('utm_source') || '').slice(0, 100), medium: (p.get('utm_medium') || '').slice(0, 100), campaign: (p.get('utm_campaign') || '').slice(0, 100) }
    };
    var hasUrl = fromUrl.ref || fromUrl.utm.source || fromUrl.utm.medium || fromUrl.utm.campaign;
    if (hasUrl) { store.set('qp_attr', fromUrl); return fromUrl; }
    var saved = store.get('qp_attr');
    return saved && saved.utm ? saved : fromUrl;
  }

  /* ---------- Counters ---------- */
  var total = null;
  function renderCounters() {
    document.querySelectorAll('[data-counter]').forEach(function (el) {
      var span = el.querySelector('.counter-text');
      span.textContent = typeof total === 'number' && total >= 10 ? tp('counter', total) : t('counter.first');
      el.classList.add('is-ready');
    });
  }
  function countUp(to) {
    if (REDUCED || typeof to !== 'number' || to < 10) { total = to; renderCounters(); return; }
    var start = performance.now(), dur = 700;
    (function step(now) {
      var k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
      total = Math.round(to * e);
      renderCounters();
      if (k < 1) requestAnimationFrame(step); else { total = to; renderCounters(); }
    })(start);
  }
  function loadStats() {
    apiGet({ action: 'stats' }, 8000).then(function (r) {
      if (r.ok && typeof r.total === 'number') countUp(r.total); else renderCounters();
    }).catch(function () { renderCounters(); });
  }

  /* ---------- Signup ---------- */
  var form = document.getElementById('join-form');
  var emailEl = document.getElementById('email');
  var hpEl = document.getElementById('website');
  var joinBtn = document.getElementById('join-btn');
  var joinMsg = document.getElementById('join-msg');
  var thanksEl = document.getElementById('thanks');
  var joined = store.get('qp_joined');
  var busyJoin = false;
  var attribution = readAttribution();
  var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

  function setJoinError(code) {
    joinMsg.className = 'field-msg' + (code ? ' is-error' : '');
    joinMsg.textContent = code ? t(code === 'empty' ? 'err.empty' : 'err.' + (I18N.en['err.' + code] ? code : 'server')) : '';
    if (code) emailEl.setAttribute('aria-invalid', 'true'); else emailEl.removeAttribute('aria-invalid');
  }
  function validEmail(v) { return v.length <= 254 && EMAIL_RE.test(v); }

  emailEl.addEventListener('blur', function () {
    var v = emailEl.value.trim();
    if (v && !validEmail(v)) setJoinError('invalid_email');
  });
  emailEl.addEventListener('input', function () { if (emailEl.hasAttribute('aria-invalid')) setJoinError(null); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busyJoin) return;
    var email = emailEl.value.trim();
    if (!email) { setJoinError('empty'); emailEl.focus(); return; }
    if (!validEmail(email)) { setJoinError('invalid_email'); emailEl.focus(); return; }
    setJoinError(null);
    busyJoin = true;
    joinBtn.disabled = true; joinBtn.classList.add('is-busy'); joinBtn.setAttribute('aria-busy', 'true');
    joinBtn.querySelector('.btn-label').textContent = t('form.sending');
    apiPost({ action: 'join', email: email, lang: lang, ref: attribution.ref, utm: attribution.utm, hp: hpEl.value, cid: getCid() }, 15000)
      .then(function (r) {
        if (r.ok) {
          joined = { position: r.position, total: r.total, refCode: r.refCode, referrals: r.referrals || 0, already: !!r.already, email: email, ts: Date.now() };
          store.set('qp_joined', joined);
          if (typeof r.total === 'number') { total = r.total; renderCounters(); }
          renderThanks(joined, true);
        } else setJoinError(r.error || 'server');
      })
      .catch(function (err) { setJoinError(err.code === 'offline' ? 'offline' : 'server'); })
      .then(function () {
        busyJoin = false;
        joinBtn.disabled = false; joinBtn.classList.remove('is-busy'); joinBtn.removeAttribute('aria-busy');
        joinBtn.querySelector('.btn-label').textContent = t('cta');
      });
  });

  function refLink(code) {
    var base = location.origin && location.origin !== 'null' ? location.origin + location.pathname : location.href.split(/[?#]/)[0];
    return base + '?ref=' + encodeURIComponent(code || '');
  }

  function renderThanks(j, isNew) {
    var link = refLink(j.refCode);
    form.hidden = true;
    thanksEl.hidden = false;
    document.getElementById('thanks-title').textContent = t('thanks.title', { n: fmt(j.position || 1) });
    var body = j.already && isNew ? t('thanks.already') + ' ' : '';
    document.getElementById('thanks-body').textContent = body + t('thanks.body', { email: j.email || '' });
    document.getElementById('ref-link').value = link;
    document.querySelector('#ref-count span').innerHTML = tp('thanks.refs', j.referrals || 0);
    var msg = t('share.text');
    document.getElementById('share-tg').href = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(msg);
    document.getElementById('share-wa').href = 'https://wa.me/?text=' + encodeURIComponent(msg + ' ' + link);
    document.getElementById('share-mail').href = 'mailto:?subject=' + encodeURIComponent(t('share.subject')) + '&body=' + encodeURIComponent(msg + '\n\n' + link);
    updateFinalCta();
    if (isNew) {
      thanksEl.classList.remove('is-new'); void thanksEl.offsetWidth; thanksEl.classList.add('is-new');
      document.getElementById('thanks-title').focus({ preventScroll: true });
      confetti(document.querySelector('.thanks-badge'));
    }
  }

  function updateFinalCta() {
    var el = document.querySelector('[data-cta-final]');
    if (el) el.textContent = joined ? t('cta.joined') : t('cta');
  }

  document.getElementById('copy-btn').addEventListener('click', function () {
    var btn = this, input = document.getElementById('ref-link');
    var done = function () {
      btn.classList.add('is-done');
      btn.querySelector('span').textContent = t('thanks.copied');
      document.getElementById('copy-status').textContent = t('thanks.copiedSr');
      setTimeout(function () { btn.classList.remove('is-done'); btn.querySelector('span').textContent = t('thanks.copy'); }, 1800);
    };
    var legacy = function () { input.select(); try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ } };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(input.value).then(done, legacy); else legacy();
  });
  document.getElementById('ref-link').addEventListener('focus', function () { this.select(); });

  document.getElementById('reset-btn').addEventListener('click', function () {
    store.del('qp_joined');
    joined = null;
    thanksEl.hidden = true;
    form.hidden = false;
    emailEl.value = '';
    updateFinalCta();
    emailEl.focus();
  });

  // Returning visitor: show saved state, refresh it quietly (join is idempotent and answers "already").
  function restoreJoined() {
    if (!joined || !joined.refCode) { joined = null; return; }
    renderThanks(joined, false);
    if (API && joined.email && Date.now() - (joined.ts || 0) > REFRESH_MS) {
      apiPost({ action: 'join', email: joined.email, lang: lang, ref: null, utm: { source: '', medium: '', campaign: '' }, hp: '', cid: getCid() }, 15000)
        .then(function (r) {
          if (!r.ok || !joined) return;
          joined.position = r.position || joined.position;
          joined.referrals = r.referrals || 0;
          joined.ts = Date.now();
          store.set('qp_joined', joined);
          renderThanks(joined, false);
        }).catch(function () { /* keep saved state */ });
    }
  }

  function scrollToJoin() {
    var target = joined ? thanksEl : document.getElementById('join-slot');
    target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    var focusEl = joined ? document.getElementById('thanks-title') : emailEl;
    setTimeout(function () { focusEl.focus({ preventScroll: true }); }, REDUCED ? 0 : 450);
  }
  document.querySelectorAll('[data-scroll-join]').forEach(function (b) { b.addEventListener('click', scrollToJoin); });

  /* ---------- Demo ---------- */
  var demoForm = document.getElementById('demo-form');
  var lessonEl = document.getElementById('lesson');
  var genBtn = document.getElementById('gen-btn');
  var lessonErr = document.getElementById('lesson-error');
  var panel = document.getElementById('quiz-panel');
  var emptyEl = document.getElementById('quiz-empty');
  var bodyEl = document.getElementById('quiz-body');
  var statusEl = document.getElementById('quiz-status');
  var samples = null, activeSample = null, quizState = null, busyQuiz = false;

  var samplesReady = fetch('data/samples.json').then(function (r) { return r.json(); }).then(function (d) {
    samples = {};
    (d.samples || []).forEach(function (s) { samples[s.id] = s; });
  }).catch(function () { samples = null; document.getElementById('samples').hidden = true; });

  function sampleText(id) { return samples && samples[id] ? samples[id].text[lang] || samples[id].text.en : ''; }

  function setChips() {
    document.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-sample') === activeSample)); });
  }
  document.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      samplesReady.then(function () {
        if (!samples) return;
        activeSample = chip.getAttribute('data-sample');
        lessonEl.value = sampleText(activeSample);
        setChips();
        setLessonError(null);
        updateLessonMeta();
      });
    });
  });

  function updateLessonMeta() {
    var n = lessonEl.value.trim().length;
    document.getElementById('lesson-count').textContent = fmt(n) + ' / ' + fmt(MAX_CHARS);
    var need = document.getElementById('lesson-need');
    if (n === 0) { need.textContent = ''; need.className = ''; }
    else if (n < MIN_CHARS) { need.textContent = tp('demo.need', MIN_CHARS - n); need.className = ''; }
    else { need.textContent = t('demo.ready'); need.className = 'is-ok'; }
  }
  lessonEl.addEventListener('input', function () {
    if (activeSample && lessonEl.value !== sampleText(activeSample)) { activeSample = null; setChips(); }
    if (lessonEl.hasAttribute('aria-invalid')) setLessonError(null);
    updateLessonMeta();
  });
  function setLessonError(key) {
    lessonErr.textContent = key ? t(key) : '';
    if (key) lessonEl.setAttribute('aria-invalid', 'true'); else lessonEl.removeAttribute('aria-invalid');
  }

  function validQuiz(q) {
    return q && Array.isArray(q.questions) && q.questions.length > 0 && q.questions.every(function (x) {
      return x && typeof x.q === 'string' && Array.isArray(x.options) && x.options.length === 4 &&
        x.options.every(function (o) { return typeof o === 'string'; }) && Number.isInteger(x.answer) && x.answer >= 0 && x.answer <= 3;
    });
  }

  var stepTimer = null;
  function showLoading() {
    emptyEl.hidden = true; bodyEl.hidden = false;
    panel.setAttribute('aria-busy', 'true');
    var steps = raw('demo.steps');
    bodyEl.innerHTML = '<div class="skel"><ul class="skel-steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ul><div class="skel-bar q"></div><div class="skel-bar opt"></div><div class="skel-bar opt"></div><div class="skel-bar opt"></div><div class="skel-bar opt"></div></div>';
    var lis = bodyEl.querySelectorAll('.skel-steps li'), i = 0;
    var tick = function () {
      lis.forEach(function (li, k) { li.className = k < i ? 'is-done' : (k === i ? 'is-now' : ''); });
      if (i < lis.length - 1) i++;
    };
    tick();
    stepTimer = setInterval(tick, 1100);
    statusEl.textContent = t('demo.working');
  }
  function stopLoading() { clearInterval(stepTimer); panel.setAttribute('aria-busy', 'false'); }

  demoForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busyQuiz) return;
    var text = lessonEl.value.trim();
    if (text.length < MIN_CHARS) { setLessonError('demo.too_short'); lessonEl.focus(); return; }
    if (text.length > MAX_CHARS) { setLessonError('demo.too_long'); lessonEl.focus(); return; }
    setLessonError(null);
    busyQuiz = true;
    genBtn.disabled = true; genBtn.classList.add('is-busy'); genBtn.setAttribute('aria-busy', 'true');
    showLoading();
    if (window.innerWidth < 980) panel.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    var started = Date.now(), usedSample = activeSample, quizLang = lang;
    var minWait = function (v) { var left = 900 - (Date.now() - started); return left > 0 ? new Promise(function (r) { setTimeout(function () { r(v); }, left); }) : v; };

    apiPost({ action: 'quiz', text: text, lang: quizLang, count: 5, cid: getCid() }, 30000)
      .then(function (r) { return r; }, function (err) { return { ok: false, error: err.code }; })
      .then(minWait)
      .then(function (r) {
        if (r.ok && r.quiz && validQuiz(r.quiz)) return startQuiz(r.quiz, null, true);
        if (r.error === 'too_short' || r.error === 'too_long') { resetPanel(); setLessonError('demo.' + r.error); lessonEl.focus(); return; }
        return samplesReady.then(function () {
          var id = usedSample || 'photosynthesis';
          var q = samples && samples[id] && samples[id].quiz[quizLang];
          if (q) startQuiz(q, usedSample ? 'demo.fallback' : 'demo.fallbackOwn', false);
          else showPanelError();
        });
      })
      .then(function () {
        stopLoading();
        busyQuiz = false;
        genBtn.disabled = false; genBtn.classList.remove('is-busy'); genBtn.removeAttribute('aria-busy');
      });
  });

  function resetPanel() { stopLoading(); quizState = null; bodyEl.hidden = true; bodyEl.innerHTML = ''; emptyEl.hidden = false; }
  function showPanelError() {
    quizState = null;
    bodyEl.innerHTML = '<div class="quiz-error"><svg class="icon" aria-hidden="true"><use href="#i-info"/></svg><p>' + esc(t('demo.failed')) + '</p></div>';
    statusEl.textContent = t('demo.failed');
  }

  function startQuiz(quiz, noteKey, live) {
    stopLoading();
    quizState = { quiz: quiz, i: 0, picks: [], noteKey: noteKey, live: live };
    renderQuiz();
    statusEl.textContent = (noteKey ? t(noteKey) + ' ' : '') + t('quiz.ready', { n: quiz.questions.length });
  }

  var KEYS = ['A', 'B', 'C', 'D'];
  function icon(id, cls) { return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  function renderQuiz(focusSel) {
    var s = quizState, qs = s.quiz.questions, n = qs.length;
    var note = s.noteKey ? '<p class="quiz-note">' + icon('i-info') + '<span>' + esc(t(s.noteKey)) + '</span></p>' : '';
    var bars = qs.map(function (q, k) {
      var p = s.picks[k];
      return '<i class="' + (p === undefined ? (k === s.i ? 'now' : '') : (p === q.answer ? 'right' : 'wrong')) + '"></i>';
    }).join('');
    var head = note + '<div class="quiz-top"><p class="quiz-title">' + esc(s.quiz.title || '') + '</p>' +
      (s.i < n ? '<p class="quiz-progress">' + esc(t('quiz.progress', { i: s.i + 1, n: n })) + '</p>' : '') + '</div><div class="quiz-bars" aria-hidden="true">' + bars + '</div>';

    if (s.i >= n) { bodyEl.innerHTML = head + renderScore(); bindScore(); focusIn(focusSel || '.score-num'); return; }

    var q = qs[s.i], pick = s.picks[s.i], answered = pick !== undefined;
    var opts = q.options.map(function (o, k) {
      var cls = 'opt', mark = '';
      if (answered) {
        if (k === q.answer) { cls += ' is-right'; mark = icon('i-check', 'opt-mark'); }
        else if (k === pick) { cls += ' is-wrong'; mark = icon('i-x', 'opt-mark'); }
        else cls += ' is-dim';
      }
      return '<li><button type="button" class="' + cls + '" data-k="' + k + '"' + (answered ? ' disabled' : '') + '><span class="opt-key">' + KEYS[k] + '</span><span>' + esc(o) + '</span>' + mark + '</button></li>';
    }).join('');
    var fb = '';
    if (answered) {
      var ok = pick === q.answer;
      fb = '<div class="feedback ' + (ok ? 'is-right' : 'is-wrong') + '" role="status"><strong>' + esc(ok ? t('quiz.right') : t('quiz.wrong', { a: KEYS[q.answer] })) + '</strong>' + esc(q.explain || '') + '</div>' +
        '<div class="quiz-actions"><button type="button" class="btn btn-ink" data-next>' + esc(s.i === n - 1 ? t('quiz.finish') : t('quiz.next')) + icon('i-arrow') + '</button></div>';
    }
    bodyEl.innerHTML = head + '<p class="quiz-q" tabindex="-1">' + esc(q.q) + '</p><ul class="opts">' + opts + '</ul>' + fb;

    bodyEl.querySelectorAll('.opt').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        s.picks[s.i] = Number(b.getAttribute('data-k'));
        // Keyboard activation (detail 0) moves focus to the next step; mouse clicks keep focus calm.
        renderQuiz(ev.detail === 0 ? '[data-next]' : null);
      });
    });
    var next = bodyEl.querySelector('[data-next]');
    if (next) next.addEventListener('click', function () { s.i++; renderQuiz('.quiz-q'); });
    focusIn(focusSel);
  }
  function focusIn(sel) { if (!sel) return; var el = bodyEl.querySelector(sel); if (el) el.focus({ preventScroll: false }); }

  function renderScore() {
    var s = quizState, qs = s.quiz.questions, n = qs.length;
    var right = qs.reduce(function (a, q, k) { return a + (s.picks[k] === q.answer ? 1 : 0); }, 0);
    var verdict = right === n ? t('quiz.perfect') : (right >= Math.ceil(n * 0.6) ? t('quiz.good') : t('quiz.low'));
    var dots = qs.map(function (q, k) { return '<i class="' + (s.picks[k] === q.answer ? 'right' : '') + '"></i>'; }).join('');
    return '<div class="score"><p class="score-num" tabindex="-1">' + right + '/' + n + '</p><p class="score-label">' + esc(verdict + ' ' + t('quiz.score', { s: right, n: n })) + '</p>' +
      '<div class="score-dots" aria-hidden="true">' + dots + '</div><p class="score-note">' + esc(t(s.live ? 'quiz.noteLive' : 'quiz.noteSample')) + '</p>' +
      '<div class="quiz-actions"><button type="button" class="btn btn-accent btn-lg" data-join>' + esc(t('quiz.cta')) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-lg" data-again>' + icon('i-refresh') + esc(t('quiz.again')) + '</button></div></div>';
  }
  function bindScore() {
    bodyEl.querySelector('[data-join]').addEventListener('click', scrollToJoin);
    bodyEl.querySelector('[data-again]').addEventListener('click', function () {
      resetPanel();
      document.getElementById('demo').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      setTimeout(function () { lessonEl.focus({ preventScroll: true }); lessonEl.select(); }, REDUCED ? 0 : 400);
    });
  }

  /* ---------- Confetti (small self-written canvas burst) ---------- */
  function confetti(originEl) {
    if (REDUCED) return;
    var c = document.createElement('canvas'), ctx = c.getContext('2d');
    if (!ctx) return;
    c.className = 'confetti'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
    var r = originEl ? originEl.getBoundingClientRect() : { left: W / 2, top: H / 2, width: 0, height: 0 };
    var ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    var colors = ['#F2E14A', '#161B2E', '#156B42', '#E8836B', '#7A9CF0'];
    var parts = [];
    for (var i = 0; i < 110; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1, sp = 5 + Math.random() * 7;
      parts.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: 5 + Math.random() * 5, h: 3 + Math.random() * 4,
        rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.35, color: colors[i % colors.length], circle: i % 5 === 0 });
    }
    var start = performance.now(), DUR = 1700;
    (function frame(now) {
      var el = now - start, life = 1 - el / DUR;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.vy += 0.22; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, life * 1.6)); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        if (p.circle) { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.4, 0, 6.283); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (el < DUR) requestAnimationFrame(frame); else c.remove();
    })(start);
  }

  /* ---------- Init ---------- */
  document.querySelectorAll('.lang [data-lang]').forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });
  applyI18n();
  updateLessonMeta();
  restoreJoined();
  loadStats();
})();
