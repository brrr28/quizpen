/* Quizpen waitlist page logic: i18n, waitlist signup, live quiz demo, confetti. */
(function () {
  'use strict';

  var API = String(window.WAITLIST_API || '').trim();
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MIN_CHARS = 200, MAX_CHARS = 3000, REFRESH_MS = 6 * 3600 * 1000;

  /* ---------- Analytics hook (web/analytics.js): a no-op until IDs are set in config.js ---------- */
  var demoT0 = 0;
  function track(name, props) { if (window.qpAnalytics) window.qpAnalytics.track(name, props); }
  /* ---------- end of analytics hook ---------- */

  // localStorage wrapper: storage can be blocked or throw in private modes.
  var store = {
    get: function (k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  var I18N = {
    en: {
      'meta.title': 'Quizpen: turn lesson text into a quiz in seconds',
      'meta.desc': 'Quizpen turns your lesson text into a multiple-choice quiz in the same language, with a one-sentence reason for each answer. Try a ready example and join the waitlist for teachers.',
      'skip': 'Skip to content', 'nav.demo': 'Try the demo', 'nav.faq': 'Questions', 'lang.label': 'Language',
      'cta': 'Join Waitlist', 'cta.joined': 'You\'re on the list',
      'hero.kicker': 'An AI assistant for teachers',
      'hero.title': 'Paste a lesson. Get a <mark class="hl">quiz</mark> before the bell.',
      'hero.sub': 'Paste any text you teach from: a textbook page, your notes or an article. Quizpen writes a multiple-choice quiz from it, with an answer key and a short explanation for every question.',
      'form.label': 'Email for early access', 'form.placeholder': 'name@school.org',
      'form.note': 'One email when your access is ready. Unsubscribe in one click.',
      'form.sending': 'Joining',
      'err.empty': 'Enter your email so we can save your spot.',
      'err.invalid_email': 'That email doesn\'t look right. Check it for typos.',
      'err.rate_limited': 'Too many tries from this device. Wait a minute, then try again.',
      'err.server': 'We couldn\'t save your email just now. Please try again in a minute.',
      'err.offline': 'No connection. Check your internet and try again.',
      'join.pending': 'No connection. We\'ll send your email as soon as you\'re back online.',
      'net.offline': 'You\'re offline. Ready examples still work.',
      'demo.slow': 'Slow connection. Still working on it.',
      'counter': { one: '{n} teacher already joined', other: '{n} teachers already joined' },
      'counter.first': 'Be one of the first teachers to try it',
      'hero.try': 'Try a ready example, no signup',
      'thanks.title': 'You\'re #{n} on the waitlist',
      'thanks.body': 'We\'ll email {email} when your access is ready.',
      'thanks.already': 'You were already on the list, so your spot is saved.',
      'thanks.share': 'Know a colleague who writes quizzes at night? Send them your link.',
      'thanks.linkLabel': 'Your invite link', 'thanks.copy': 'Copy link', 'thanks.copied': 'Copied',
      'thanks.copiedSr': 'Link copied to clipboard', 'thanks.reset': 'Use a different email',
      'thanks.refs': { one: '<strong>{n} colleague</strong> joined via your link', other: '<strong>{n} colleagues</strong> joined via your link' },
      'share.email': 'Email',
      'share.text': 'I joined the Quizpen waitlist. It turns lesson text into a quiz in seconds:',
      'share.subject': 'A quiz from any lesson text in seconds',
      'art.label': 'Your lesson text',
      'art.source': 'Chlorophyll absorbs red and blue light and <mark class="hl hl-art">reflects green light</mark>, which is why most leaves look green.',
      'art.progress': 'Question 2 of 5', 'art.q': 'Why do most leaves look green?',
      'art.a': 'They absorb green light', 'art.b': 'Chlorophyll reflects green light',
      'art.c': 'Their cells hold green water', 'art.d': 'Sunlight is mostly green',
      'art.explain': 'Chlorophyll reflects green, so green is what reaches our eyes.',
      'demo.title': 'See it on a real lesson',
      'demo.sub': 'Ready examples open at once and need no signup. Quizzes from your own text are in early access for now. We don\'t store your text.',
      'demo.label': 'Lesson text',
      'demo.placeholder': 'Paste 200 to 3000 characters: a textbook page, your notes or an article.',
      'demo.tabSamples': 'Ready examples', 'demo.tabOwn': 'Your text',
      'demo.langNote': 'The quiz comes out in the language of the text.',
      'demo.show': 'Show the quiz',
      'demo.stepsSample': ['Opening the example', 'Loading the ready quiz'],
      'demo.need': { one: '{n} more character needed', other: '{n} more characters needed' },
      'demo.ready': 'Ready to generate',
      'demo.generate': 'Generate quiz',
      'demo.steps': ['Reading your text', 'Picking the key facts', 'Writing answer options'],
      'demo.working': 'Writing your quiz. This takes a few seconds.',
      'demo.too_short': 'Add a bit more text: the demo needs at least 200 characters.',
      'demo.too_long': 'That\'s over 3000 characters. Trim it to one or two paragraphs.',
      'demo.busy': 'The live demo is busy right now. Try again in a minute or open a ready example.',
      'demo.retry': 'Try again',
      'ea.title': 'Quizzes from your own text open in early access',
      'ea.text': 'Leave your email and we\'ll send you access first.',
      'ea.already': 'You\'re already on the list. We\'ll email you first.',
      'ea.done': 'Done. We\'ll email you as soon as your own-text quizzes are ready.',
      'ea.meanwhile': 'Meanwhile, open a ready example',
      'quiz.region': 'Your quiz', 'quiz.emptyTitle': 'Your quiz will appear here',
      'quiz.emptySub': 'Five questions, four options each: one correct answer, three plausible wrong ones, and a one-line reason for the correct one.',
      'quiz.progress': 'Question {i} of {n}', 'quiz.right': 'Correct.', 'quiz.wrong': 'Not quite. The answer is {a}.',
      'quiz.next': 'Next question', 'quiz.finish': 'See my score', 'quiz.score': '{s} of {n} correct',
      'quiz.perfect': 'Full marks.', 'quiz.good': 'Nice work.', 'quiz.low': 'A good start.',
      'quiz.noteLive': 'Claude just wrote this quiz from your text.',
      'quiz.noteSample': 'Claude wrote this quiz from this text in advance. Want one from your own lesson? Open {link}.',
      'quiz.ownLink': '“Your text”',
      'quiz.again': 'Try another text', 'quiz.cta': 'Want this for your class? Join the waitlist',
      'quiz.copy': 'Copy quiz', 'quiz.copied': 'Quiz copied as plain text: questions, options and answer key',
      'quiz.copyTitle': 'Quiz', 'quiz.keyTitle': 'Answer key',
      'quiz.ready': 'Quiz ready: {n} questions.',
      'features.title': 'What Quizpen does for you',
      'features.sub': 'Start with the material you already teach from and finish with questions your students can answer.',
      'f1.t': 'From your text, in the same language',
      'f1.d': 'Paste a textbook page, your notes or an article. Every question comes from that text. If the text is in Spanish, the quiz is in Spanish too.',
      'f2.t': 'An answer key you can check at a glance',
      'f2.d': 'Each correct answer has a one-sentence reason from your text. The correct option sits under different letters, A to D, so students can\'t guess a pattern.',
      'f3.t': 'Students open it from a link',
      'f3.d': 'Send a link or show a QR code on the screen. Students take the quiz without accounts, and we collect no student data. Prefer paper? Copy the quiz in one click and print it as a worksheet.',
      'proof.title': 'Why we\'re building this',
      'proof.1': '<strong>About 1 in 3 teachers</strong> in OECD countries already use AI in their work. In Singapore and the UAE it is up to 75%.',
      'proof.2': '<strong>66% of teachers</strong> think AI can give wrong or inappropriate recommendations. That is why every correct answer in Quizpen comes with a reason you can check against your text.',
      'proof.3': '<strong>Quizzing beats re-reading.</strong> A week after studying a text, students who practiced recalling it remembered more than students who read it again.',
      'src.1': '<a href="https://www.oecd.org/en/publications/results-from-talis-2024_90df6235-en.html" target="_blank" rel="noopener noreferrer">OECD, Results from TALIS 2024</a>, the Teaching and Learning International Survey.',
      'src.2': '<a href="https://www.ei-ie.org/en/item/31815:using-artificial-intelligence-takeaways-from-talis-2024" target="_blank" rel="noopener noreferrer">Education International, "Using artificial intelligence: takeaways from TALIS 2024"</a>.',
      'src.3': '<a href="https://doi.org/10.1111/j.1467-9280.2006.01693.x" target="_blank" rel="noopener noreferrer">Roediger and Karpicke, "Test-Enhanced Learning"</a>, Psychological Science, 2006.',
      'faq.title': 'Questions teachers ask',
      'faq.q1': 'When can I start using Quizpen?',
      'faq.a1': 'We\'re opening access in small groups, in the order teachers joined. We\'ll send one email when your spot opens.',
      'faq.q2': 'Will it cost anything?',
      'faq.a2': 'Early access is free for teachers on the waitlist. If we add paid plans later, you\'ll hear about it before anything changes.',
      'faq.q3': 'Which subjects and languages does it work for?',
      'faq.a3': 'Any subject you teach from text: history, biology, geography, literature and more. The quiz comes out in the language of the text you paste. You can see it in the ready examples in Spanish and Polish.',
      'faq.q4': 'How is this different from ChatGPT or Gemini?',
      'faq.a4': 'No prompt to write: paste the text and get the quiz. Next to each correct answer is a reason from your text. Students take the quiz from a link and need no accounts. You can use Quizpen alongside them: the quiz copies in one click.',
      'faq.q5': 'Can I trust the answer key?',
      'faq.a5': 'AI can still make mistakes, so look the quiz over before class. The reason line makes this quick: it shows which part of your text each answer comes from.',
      'faq.q6': 'What happens to my text and my students\' data?',
      'faq.a6': 'Your text goes to an AI model only to write the quiz, and we don\'t store it. Students don\'t create accounts, and we collect no student data. Paste lesson material and leave out student names and other personal details.',
      'final.title': 'Get Quizpen before your next unit starts.',
      'footer.privacy': 'We use your email only to tell you about access.'
    },
    uk: {
      'meta.title': 'Quizpen: тест із тексту уроку за лічені секунди',
      'meta.desc': 'Quizpen складає з тексту вашого уроку тест із варіантами відповідей тією ж мовою, з поясненням в одне речення до кожної відповіді. Спробуйте готовий приклад і приєднуйтеся до списку очікування для вчителів.',
      'skip': 'Перейти до змісту', 'nav.demo': 'Спробувати демо', 'nav.faq': 'Питання', 'lang.label': 'Мова',
      'cta': 'Приєднатися до списку', 'cta.joined': 'Ви вже в списку',
      'hero.kicker': 'ШІ-помічник для вчителів',
      'hero.title': 'Вставте текст уроку. Отримайте <mark class="hl">тест</mark> ще до дзвінка.',
      'hero.sub': 'Вставте будь-який текст, за яким ведете урок: параграф підручника, свій конспект чи статтю. Quizpen складе з нього тест із ключем відповідей і коротким поясненням до кожного питання.',
      'form.label': 'Пошта для раннього доступу', 'form.placeholder': 'imia@shkola.ua',
      'form.note': 'Один лист, коли доступ буде готовий. Відписатися можна одним кліком.',
      'form.sending': 'Додаємо',
      'err.empty': 'Введіть пошту, щоб ми зберегли ваше місце.',
      'err.invalid_email': 'Схоже, в адресі помилка. Перевірте її, будь ласка.',
      'err.rate_limited': 'Забагато спроб із цього пристрою. Зачекайте хвилину й спробуйте ще раз.',
      'err.server': 'Не вдалося зберегти пошту. Спробуйте ще раз за хвилину.',
      'err.offline': 'Немає з\'єднання. Перевірте інтернет і спробуйте ще раз.',
      'join.pending': 'Немає з\'єднання. Надішлемо ваш email, щойно з\'явиться інтернет.',
      'net.offline': 'Ви офлайн. Готові приклади працюють і без інтернету.',
      'demo.slow': 'Повільне з\'єднання. Ще працюємо.',
      'counter': { one: '{n} вчитель уже приєднався', few: '{n} вчителі вже приєдналися', many: '{n} вчителів уже приєдналися', other: '{n} вчителя вже приєдналися' },
      'counter.first': 'Станьте одним із перших учителів, які спробують Quizpen',
      'hero.try': 'Спробуйте готовий приклад, без реєстрації',
      'thanks.title': 'Ви №{n} у списку очікування',
      'thanks.body': 'Ми напишемо на {email}, щойно доступ буде готовий.',
      'thanks.already': 'Ви вже були в списку, тож ваше місце збережене.',
      'thanks.share': 'Знаєте колегу, який складає тести вечорами? Надішліть йому своє посилання.',
      'thanks.linkLabel': 'Ваше посилання-запрошення', 'thanks.copy': 'Копіювати', 'thanks.copied': 'Скопійовано',
      'thanks.copiedSr': 'Посилання скопійовано', 'thanks.reset': 'Записати іншу пошту',
      'thanks.refs': { one: '<strong>{n} колега</strong> приєднався за вашим посиланням', few: '<strong>{n} колеги</strong> приєдналися за вашим посиланням', many: '<strong>{n} колег</strong> приєдналися за вашим посиланням', other: '<strong>{n} колеги</strong> приєдналися за вашим посиланням' },
      'share.email': 'Пошта',
      'share.text': 'Я в списку очікування Quizpen. Він робить тест із тексту уроку за лічені секунди:',
      'share.subject': 'Тест із тексту уроку за кілька секунд',
      'art.label': 'Текст вашого уроку',
      'art.source': 'Хлорофіл поглинає червоне й синє світло та <mark class="hl hl-art">відбиває зелене</mark>, тому більшість листків здаються зеленими.',
      'art.progress': 'Питання 2 з 5', 'art.q': 'Чому більшість листків здаються зеленими?',
      'art.a': 'Вони поглинають зелене світло', 'art.b': 'Хлорофіл відбиває зелене світло',
      'art.c': 'Їхні клітини містять зелену воду', 'art.d': 'Сонячне світло переважно зелене',
      'art.explain': 'Хлорофіл відбиває зелене світло, тому до наших очей доходить саме воно.',
      'demo.title': 'Подивіться на справжньому уроці',
      'demo.sub': 'Готові приклади відкриваються одразу й без реєстрації. Тести з вашого тексту поки що в ранньому доступі. Ваш текст ми не зберігаємо.',
      'demo.label': 'Текст уроку',
      'demo.placeholder': 'Вставте від 200 до 3000 символів: сторінку підручника, свій конспект або статтю.',
      'demo.tabSamples': 'Готові приклади', 'demo.tabOwn': 'Ваш текст',
      'demo.langNote': 'Тест виходить мовою тексту.',
      'demo.show': 'Показати тест',
      'demo.stepsSample': ['Відкриваємо приклад', 'Завантажуємо готовий тест'],
      'demo.need': { one: 'ще {n} символ', few: 'ще {n} символи', many: 'ще {n} символів', other: 'ще {n} символу' },
      'demo.ready': 'Можна створювати',
      'demo.generate': 'Створити тест',
      'demo.steps': ['Читаємо текст', 'Вибираємо головні факти', 'Пишемо варіанти відповідей'],
      'demo.working': 'Складаємо тест, зачекайте кілька секунд.',
      'demo.too_short': 'Додайте ще тексту: для демо потрібно щонайменше 200 символів.',
      'demo.too_long': 'Це понад 3000 символів. Скоротіть до одного-двох абзаців.',
      'demo.busy': 'Живе демо зараз перевантажене. Спробуйте за хвилину або відкрийте готовий приклад.',
      'demo.retry': 'Спробувати ще раз',
      'ea.title': 'Генерація з вашого тексту відкривається в ранньому доступі',
      'ea.text': 'Залиште email, і ми надішлемо доступ першим.',
      'ea.already': 'Ви вже в списку. Напишемо вам першим.',
      'ea.done': 'Готово. Напишемо вам, щойно тести з вашого тексту запрацюють.',
      'ea.meanwhile': 'Поки що відкрийте готовий приклад',
      'quiz.region': 'Ваш тест', 'quiz.emptyTitle': 'Тут з\'явиться ваш тест',
      'quiz.emptySub': 'П\'ять питань, по чотири варіанти: одна правильна відповідь, три правдоподібні неправильні й пояснення в одне речення, чому правильна саме вона.',
      'quiz.progress': 'Питання {i} з {n}', 'quiz.right': 'Правильно.', 'quiz.wrong': 'Не зовсім. Правильна відповідь: {a}.',
      'quiz.next': 'Наступне питання', 'quiz.finish': 'Мій результат', 'quiz.score': '{s} з {n} правильно',
      'quiz.perfect': 'Усе правильно.', 'quiz.good': 'Гарний результат.', 'quiz.low': 'Непоганий початок.',
      'quiz.noteLive': 'Claude щойно склав цей тест із вашого тексту.',
      'quiz.noteSample': 'Цей тест Claude склав із цього тексту заздалегідь. Хочете тест зі свого уроку? Відкрийте {link}.',
      'quiz.ownLink': '«Ваш текст»',
      'quiz.again': 'Спробувати інший текст', 'quiz.cta': 'Хочете такий тест для свого класу? Приєднуйтеся до списку',
      'quiz.copy': 'Копіювати тест', 'quiz.copied': 'Тест скопійовано як текст: питання, варіанти й відповіді',
      'quiz.copyTitle': 'Тест', 'quiz.keyTitle': 'Відповіді',
      'quiz.ready': 'Тест готовий: питань {n}.',
      'features.title': 'Що Quizpen робить за вас',
      'features.sub': 'Ви починаєте з матеріалу, за яким уже готуєтеся до уроку, і отримуєте питання, на які учні можуть відповісти.',
      'f1.t': 'З вашого тексту і тією ж мовою',
      'f1.d': 'Вставте параграф підручника, свій конспект чи статтю. Усі питання беруться з цього тексту. Якщо текст іспанською, тест теж буде іспанською.',
      'f2.t': 'Ключ, який легко звірити',
      'f2.d': 'До кожної правильної відповіді є пояснення в одне речення з вашого тексту. Правильний варіант стоїть під різними літерами, від A до D, тож учні не вгадають закономірність.',
      'f3.t': 'Учні відкривають тест за посиланням',
      'f3.d': 'Надішліть посилання або покажіть QR-код на екрані. Учні проходять тест без акаунтів, а ми не збираємо жодних даних про них. Зручніше на папері? Скопіюйте тест одним кліком і роздрукуйте для самостійної роботи.',
      'proof.title': 'Чому ми це робимо',
      'proof.1': '<strong>Приблизно кожен третій учитель</strong> у країнах ОЕСР уже використовує ШІ в роботі. У Сінгапурі та ОАЕ таких до 75%.',
      'proof.2': '<strong>66% учителів</strong> вважають, що ШІ може давати хибні або недоречні рекомендації. Тому кожна правильна відповідь у Quizpen має пояснення, яке легко звірити з вашим текстом.',
      'proof.3': '<strong>Тест працює краще за перечитування.</strong> Через тиждень після вивчення тексту учні, які пробували відтворити його з пам\'яті, пам\'ятали більше, ніж ті, хто просто перечитав.',
      'src.1': '<a href="https://www.oecd.org/en/publications/results-from-talis-2024_90df6235-en.html" target="_blank" rel="noopener noreferrer">ОЕСР, Results from TALIS 2024</a>, Міжнародне дослідження викладання та навчання.',
      'src.2': '<a href="https://www.ei-ie.org/en/item/31815:using-artificial-intelligence-takeaways-from-talis-2024" target="_blank" rel="noopener noreferrer">Education International, «Using artificial intelligence: takeaways from TALIS 2024»</a>.',
      'src.3': '<a href="https://doi.org/10.1111/j.1467-9280.2006.01693.x" target="_blank" rel="noopener noreferrer">Roediger і Karpicke, «Test-Enhanced Learning»</a>, Psychological Science, 2006.',
      'faq.title': 'Що питають учителі',
      'faq.q1': 'Коли я зможу користуватися Quizpen?',
      'faq.a1': 'Ми відкриваємо доступ невеликими групами, у порядку реєстрації. Коли настане ваша черга, надішлемо один лист.',
      'faq.q2': 'Це платно?',
      'faq.a2': 'Ранній доступ безкоштовний для вчителів зі списку очікування. Якщо згодом з\'являться платні тарифи, ми попередимо заздалегідь.',
      'faq.q3': 'Для яких предметів і мов це працює?',
      'faq.a3': 'Для будь-якого предмета, де працюють із текстом: історія, біологія, географія, література та інші. Тест виходить мовою тексту, який ви вставили. Це видно на готових прикладах іспанською та польською.',
      'faq.q4': 'Чим це відрізняється від ChatGPT чи Gemini?',
      'faq.a4': 'Запит писати не треба: вставте текст і отримайте тест. Біля кожної правильної відповіді є пояснення з вашого тексту. Учні проходять тест за посиланням і без акаунтів. Quizpen можна використовувати разом із ними: тест копіюється одним кліком.',
      'faq.q5': 'Чи можна довіряти ключу відповідей?',
      'faq.a5': 'ШІ все ще може помилятися, тому перегляньте тест перед уроком. Пояснення це прискорює: воно показує, з якого місця вашого тексту взято кожну відповідь.',
      'faq.q6': 'Що буде з моїм текстом і даними учнів?',
      'faq.a6': 'Текст надсилаємо моделі ШІ лише для того, щоб скласти тест, і ми його не зберігаємо. Учні не створюють акаунтів, і ми не збираємо їхніх даних. Вставляйте матеріал уроку без імен учнів та інших особистих даних.',
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
    track('lang_switched', { from: lang, to: next }); // analytics
    lang = next;
    store.set('qp_lang', lang);
    applyI18n();
    if (offlineEl && offlineEl.textContent) renderOffline();
    renderCounters();
    if (joined) renderThanks(joined, false);
    updateFinalCta();
    updateLessonMeta();
    demoLangChanged();
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

  // ctx = { emailEl, btn, msgEl, hpEl?, via?, quiet?, onOk? }: the hero form or the inline early-access form.
  var heroJoin = { emailEl: emailEl, btn: joinBtn, msgEl: joinMsg, hpEl: hpEl };
  function setJoinError(code, ctx) {
    ctx = ctx || heroJoin;
    ctx.msgEl.className = 'field-msg' + (code ? ' is-error' : '');
    ctx.msgEl.textContent = code ? t(code === 'empty' ? 'err.empty' : 'err.' + (I18N.en['err.' + code] ? code : 'server')) : '';
    if (code) ctx.emailEl.setAttribute('aria-invalid', 'true'); else ctx.emailEl.removeAttribute('aria-invalid');
  }
  function validEmail(v) { return v.length <= 254 && EMAIL_RE.test(v); }
  function bindEmailField(ctx) {
    ctx.emailEl.addEventListener('blur', function () {
      var v = ctx.emailEl.value.trim();
      if (v && !validEmail(v)) setJoinError('invalid_email', ctx);
    });
    ctx.emailEl.addEventListener('input', function () { if (ctx.emailEl.hasAttribute('aria-invalid')) setJoinError(null, ctx); });
  }
  bindEmailField(heroJoin);

  function joinWith(ctx) {
    if (busyJoin) return;
    var email = ctx.emailEl.value.trim();
    if (!email) { setJoinError('empty', ctx); ctx.emailEl.focus(); return; }
    if (!validEmail(email)) { setJoinError('invalid_email', ctx); ctx.emailEl.focus(); return; }
    setJoinError(null, ctx);
    busyJoin = true;
    var sp = { lang: lang, has_ref: !!attribution.ref };
    if (ctx.via) sp.via = ctx.via;
    track('signup_submitted', sp); // analytics
    var btn = ctx.btn;
    btn.disabled = true; btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true');
    btn.querySelector('.btn-label').textContent = t('form.sending');
    apiPost({ action: 'join', email: email, lang: lang, ref: attribution.ref, utm: attribution.utm, hp: ctx.hpEl ? ctx.hpEl.value : '', cid: getCid() }, 15000)
      .then(function (r) {
        if (r.ok) {
          joined = { position: r.position, total: r.total, refCode: r.refCode, referrals: r.referrals || 0, already: !!r.already, email: email, ts: Date.now() };
          track('signup_succeeded', { already: !!r.already, has_ref: !!attribution.ref, demo_used: demoT0 > 0 }); // analytics
          store.set('qp_joined', joined);
          if (typeof r.total === 'number') { total = r.total; renderCounters(); }
          renderThanks(joined, true, ctx.quiet);
          if (ctx.onOk) ctx.onOk(); else refreshEarly();
        } else setJoinError(r.error || 'server', ctx);
      })
      .catch(function (err) { setJoinError(err.code === 'offline' ? 'offline' : 'server', ctx); })
      .then(function () {
        busyJoin = false;
        btn.disabled = false; btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy');
        btn.querySelector('.btn-label').textContent = t('cta');
      });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); joinWith(heroJoin); });

  function refLink(code) {
    var base = location.origin && location.origin !== 'null' ? location.origin + location.pathname : location.href.split(/[?#]/)[0];
    return base + '?ref=' + encodeURIComponent(code || '');
  }

  // quiet: a signup from the demo panel updates the hero card without moving focus or confetti there.
  function renderThanks(j, isNew, quiet) {
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
    if (isNew && !quiet) {
      thanksEl.classList.remove('is-new'); void thanksEl.offsetWidth; thanksEl.classList.add('is-new');
      document.getElementById('thanks-title').focus({ preventScroll: true });
      confetti(document.querySelector('.thanks-badge'));
    }
  }

  function updateFinalCta() {
    var el = document.querySelector('[data-cta-final]');
    if (el) el.textContent = joined ? t('cta.joined') : t('cta');
  }

  // Clipboard with a fallback for old browsers and non-secure origins.
  function copyText(text) {
    var legacy = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
      return ok ? Promise.resolve() : Promise.reject(new Error('copy'));
    };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(legacy);
    return legacy();
  }

  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = icon('i-check') + '<span>' + esc(msg) + '</span>';
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  document.getElementById('copy-btn').addEventListener('click', function () {
    var btn = this;
    copyText(document.getElementById('ref-link').value).then(function () {
      btn.classList.add('is-done');
      btn.querySelector('span').textContent = t('thanks.copied');
      document.getElementById('copy-status').textContent = t('thanks.copiedSr');
      setTimeout(function () { btn.classList.remove('is-done'); btn.querySelector('span').textContent = t('thanks.copy'); }, 1800);
    }, function () { /* the field stays selectable for manual copy */ });
  });
  document.getElementById('ref-link').addEventListener('focus', function () { this.select(); });
  document.getElementById('copy-btn').addEventListener('click', function () { track('referral_link_copied'); }); // analytics
  ['tg', 'wa', 'mail'].forEach(function (c) { document.getElementById('share-' + c).addEventListener('click', function () { track('referral_shared', { channel: c }); }); }); // analytics

  document.getElementById('reset-btn').addEventListener('click', function () {
    store.del('qp_joined');
    joined = null;
    thanksEl.hidden = true;
    form.hidden = false;
    emailEl.value = '';
    updateFinalCta();
    refreshEarly();
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

  /* ---------- Demo: two modes, ready examples and the visitor's own text ---------- */
  var demoForm = document.getElementById('demo-form');
  var lessonEl = document.getElementById('lesson');
  var genBtn = document.getElementById('gen-btn');
  var showBtn = document.getElementById('show-btn');
  var lessonErr = document.getElementById('lesson-error');
  var chipsEl = document.getElementById('sample-chips');
  var sampleTextEl = document.getElementById('sample-text');
  var tabsEl = document.getElementById('demo-tabs');
  var tabEls = { samples: document.getElementById('tab-samples'), own: document.getElementById('tab-own') };
  var paneEls = { samples: document.getElementById('pane-samples'), own: document.getElementById('pane-own') };
  var MODES = ['samples', 'own'];
  var panel = document.getElementById('quiz-panel');
  var emptyEl = document.getElementById('quiz-empty');
  var bodyEl = document.getElementById('quiz-body');
  var statusEl = document.getElementById('quiz-status');
  var samples = null, sampleOrder = [], activeSample = null, quizState = null, busyQuiz = false;
  // What the panel shows in each mode: null (empty) | {kind:'quiz', state} | {kind:'early'} | {kind:'busy'} | {kind:'loading'}.
  var mode = 'samples', views = { samples: null, own: null };

  var samplesReady = fetch('data/samples.json').then(function (r) { return r.json(); }).then(function (d) {
    samples = {};
    (d.samples || []).forEach(function (s) { samples[s.id] = s; sampleOrder.push(s.id); });
    if (!sampleOrder.length) throw new Error('no samples');
    activeSample = sampleOrder[0]; // preselected silently, so no sample_viewed
    renderChips();
    renderSampleText();
  }).catch(function () {
    // Without examples only the own-text mode is left.
    samples = null;
    tabsEl.hidden = true;
    setMode('own');
    paneEls.samples.hidden = true;
  });

  function sampleLang(id) { return samples[id].lang || lang; }
  function sampleText(id) { var s = samples[id]; return s.text[sampleLang(id)] || s.text.en || ''; }
  function sampleQuiz(id) { var s = samples[id]; return s.quiz[sampleLang(id)] || s.quiz.en; }

  function renderChips() {
    var focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.chip') : null;
    var focusId = focused ? focused.getAttribute('data-sample') : null;
    chipsEl.innerHTML = sampleOrder.map(function (id) {
      var s = samples[id], label = s.label || {};
      var tag = s.lang ? '<span class="chip-tag" aria-hidden="true">' + esc(s.lang.toUpperCase()) + '</span>' : '';
      return '<button type="button" class="chip" data-sample="' + esc(id) + '" aria-pressed="' + (id === activeSample) + '">' +
        '<span data-rsv="' + esc((label.en || id) + '\n' + (label.uk || label.en || id)) + '">' + esc(label[lang] || label.en || id) + '</span>' + tag + '</button>';
    }).join('');
    if (focusId) { var c = chipsEl.querySelector('.chip[data-sample="' + focusId + '"]'); if (c) c.focus({ preventScroll: true }); }
  }
  function renderSampleText() {
    if (!samples || !activeSample) return;
    sampleTextEl.lang = sampleLang(activeSample);
    sampleTextEl.textContent = sampleText(activeSample);
    sampleTextEl.scrollTop = 0;
  }
  chipsEl.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip || !samples) return;
    var id = chip.getAttribute('data-sample');
    if (id === activeSample) return;
    activeSample = id;
    chipsEl.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
    renderSampleText();
    track('sample_viewed', { sample: id }); // analytics
    // The panel belongs to the example next to it: another example clears it.
    if (views.samples) { views.samples = null; if (mode === 'samples') renderView(); }
  });

  // Ready examples: the quiz was written in advance, so no API call; a short honest "opening" step only.
  showBtn.addEventListener('click', function () {
    samplesReady.then(function () {
      if (!samples || !activeSample) return;
      var id = activeSample, t0 = Date.now();
      demoT0 = t0; track('demo_started', { sample: id, lang: sampleLang(id) }); // analytics
      var loading = { kind: 'loading', key: 'demo.stepsSample', every: 150, finish: true, t0: t0 };
      views.samples = loading;
      var done = function () {
        if (views.samples === loading) startQuiz('samples', { quiz: sampleQuiz(id), i: 0, picks: [], source: 'sample', sample: id, t0: t0 }, true);
      };
      if (mode === 'samples') scrollToPanel();
      if (REDUCED) { done(); return; }
      if (mode === 'samples') renderView();
      setTimeout(done, 450);
    });
  });

  /* Tabs: roving tabindex, arrows/Home/End with automatic activation. */
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    MODES.forEach(function (k) {
      var on = k === m, tab = tabEls[k], pane = paneEls[k];
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      pane.classList.toggle('is-off', !on);
      if (on) { pane.removeAttribute('inert'); pane.removeAttribute('aria-hidden'); }
      else { pane.setAttribute('inert', ''); pane.setAttribute('aria-hidden', 'true'); }
      if (on && !REDUCED) { pane.classList.remove('is-in'); void pane.offsetWidth; pane.classList.add('is-in'); }
    });
    renderView();
  }
  MODES.forEach(function (k) { tabEls[k].addEventListener('click', function () { setMode(k); }); });
  tabsEl.addEventListener('keydown', function (e) {
    var i = MODES.indexOf(mode), n = MODES.length, next = null;
    if (e.key === 'ArrowRight') next = MODES[(i + 1) % n];
    else if (e.key === 'ArrowLeft') next = MODES[(i - 1 + n) % n];
    else if (e.key === 'Home') next = MODES[0];
    else if (e.key === 'End') next = MODES[n - 1];
    if (!next) return;
    e.preventDefault();
    setMode(next);
    tabEls[next].focus();
  });
  // Links inside the panel ("Your text", "Ready examples"): switch the mode and put focus where the work starts.
  function openMode(m) {
    setMode(m);
    var target = m === 'own' ? lessonEl : (chipsEl.querySelector('.chip[aria-pressed="true"]') || tabEls.samples);
    var narrow = window.innerWidth < 980;
    if (narrow) tabsEl.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: narrow });
  }
  function scrollToPanel() {
    if (window.innerWidth < 980) panel.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  }

  function updateLessonMeta() {
    var n = lessonEl.value.trim().length;
    document.getElementById('lesson-count').textContent = fmt(n) + ' / ' + fmt(MAX_CHARS);
    var need = document.getElementById('lesson-need');
    if (n === 0) { need.textContent = ''; need.className = ''; }
    else if (n < MIN_CHARS) { need.textContent = tp('demo.need', MIN_CHARS - n); need.className = ''; }
    else { need.textContent = t('demo.ready'); need.className = 'is-ok'; }
  }
  lessonEl.addEventListener('input', function () {
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
  // Length bucket for analytics: the text itself is never sent.
  function charsBucket(n) { return n < 500 ? '200-499' : n < 1000 ? '500-999' : n < 2000 ? '1000-1999' : '2000-3000'; }

  // Your text: a live call; "disabled" opens early access, any other failure says honestly that the demo is busy.
  demoForm.addEventListener('submit', function (e) { e.preventDefault(); submitOwn(); });
  function submitOwn() {
    if (busyQuiz) return;
    var text = lessonEl.value.trim();
    if (text.length < MIN_CHARS) { setLessonError('demo.too_short'); lessonEl.focus(); return; }
    if (text.length > MAX_CHARS) { setLessonError('demo.too_long'); lessonEl.focus(); return; }
    setLessonError(null);
    busyQuiz = true;
    genBtn.disabled = true; genBtn.classList.add('is-busy'); genBtn.setAttribute('aria-busy', 'true');
    var started = Date.now(), quizLang = lang;
    var loading = { kind: 'loading', key: 'demo.steps', every: 1100, t0: started };
    views.own = loading;
    if (mode === 'own') { renderView(); scrollToPanel(); statusEl.textContent = t('demo.working'); }
    demoT0 = started; track('demo_started', { sample: 'custom', lang: quizLang }); // analytics
    var minWait = function (v) { var left = 900 - (Date.now() - started); return left > 0 ? new Promise(function (r) { setTimeout(function () { r(v); }, left); }) : v; };

    apiPost({ action: 'quiz', text: text, lang: quizLang, count: 5, cid: getCid(), sample: 'custom' }, 30000)
      .then(function (r) { return r; }, function (err) { return { ok: false, error: err.code }; })
      .then(minWait)
      .then(function (r) {
        if (views.own !== loading) return;
        if (r.ok && r.quiz && validQuiz(r.quiz)) return startQuiz('own', { quiz: r.quiz, i: 0, picks: [], source: 'live', t0: started }, true);
        if (r.error === 'too_short' || r.error === 'too_long') {
          views.own = null;
          if (mode === 'own') renderView();
          setLessonError('demo.' + r.error);
          if (mode === 'own') lessonEl.focus();
          return;
        }
        if (r.error === 'disabled') {
          views.own = { kind: 'early' };
          track('early_access_shown', { chars: charsBucket(text.length) }); // analytics
        } else {
          views.own = { kind: 'busy' };
          track('quiz_generated', { ok: false, ms: Date.now() - started, source: 'live' }); // analytics
        }
        if (mode === 'own') { renderView(); statusEl.textContent = t(views.own.kind === 'early' ? 'ea.title' : 'demo.busy'); }
      })
      .then(function () {
        busyQuiz = false;
        genBtn.disabled = false; genBtn.classList.remove('is-busy'); genBtn.removeAttribute('aria-busy');
      });
  }

  function startQuiz(m, state, fresh) {
    views[m] = { kind: 'quiz', state: state };
    if (fresh) track('quiz_generated', { ok: true, ms: Date.now() - (state.t0 || demoT0), source: state.source }); // analytics
    if (m !== mode) return; // kept for this mode and shown when the visitor comes back
    renderView();
    statusEl.textContent = t('quiz.ready', { n: state.quiz.questions.length });
  }
  function announce(state) {
    /* ---------- Student play mode hook (web/play/share.js): announce the shown quiz ---------- */
    document.dispatchEvent(new CustomEvent('quizpen:quiz', { detail: { quiz: state.quiz, lang: lang } }));
    /* ---------- end of student play mode hook ---------- */
  }

  // Renders the view of the current mode (also after a tab switch or a language switch).
  var stepTimer = null;
  function renderView() {
    clearInterval(stepTimer);
    var v = views[mode];
    quizState = v && v.kind === 'quiz' ? v.state : null;
    panel.setAttribute('aria-busy', String(!!v && v.kind === 'loading'));
    if (!v) { bodyEl.hidden = true; bodyEl.innerHTML = ''; emptyEl.hidden = false; ratchet(); return; }
    emptyEl.hidden = true; bodyEl.hidden = false;
    if (v.kind === 'quiz') { announce(v.state); renderQuiz(); return; }
    if (v.kind === 'loading') renderLoading(v);
    else if (v.kind === 'early') renderEarly(v);
    else renderBusy();
    ratchet();
  }
  function renderLoading(v) {
    var steps = raw(v.key);
    bodyEl.innerHTML = '<div class="skel"><ul class="skel-steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '</ul><div class="skel-bar q"></div><div class="skel-bar opt"></div><div class="skel-bar opt"></div><div class="skel-bar opt"></div><div class="skel-bar opt"></div></div>';
    var lis = bodyEl.querySelectorAll('.skel-steps li'), max = v.finish ? lis.length : lis.length - 1;
    var at = function () { return Math.min(max, Math.floor((Date.now() - v.t0) / v.every)); };
    var tick = function () {
      var i = at();
      lis.forEach(function (li, k) { li.className = k < i ? 'is-done' : (k === i ? 'is-now' : ''); });
      if (i >= max) clearInterval(stepTimer);
    };
    tick();
    if (at() < max) stepTimer = setInterval(tick, v.every);
  }
  // A label for a button rendered after ui.js init: the data-rsv ghost holds every variant, so the width stays put.
  function labelSpan(keys, cls) {
    var vars = [];
    keys.forEach(function (k) { ['en', 'uk'].forEach(function (l) { var v = I18N[l][k]; if (typeof v === 'string' && vars.indexOf(v) < 0) vars.push(v); }); });
    return '<span class="' + cls + '" data-rsv="' + esc(vars.join('\n')) + '">' + esc(t(keys[0])) + '</span>';
  }
  function renderEarly(v) {
    var prev = document.getElementById('ea-email'), typed = prev ? prev.value : '';
    var inner;
    if (v.done) inner = '<p class="ea-done" tabindex="-1">' + icon('i-check') + '<span>' + esc(t('ea.done')) + '</span></p>';
    else if (joined) inner = '<p class="ea-done">' + icon('i-check') + '<span>' + esc(t('ea.already')) + '</span></p>';
    else {
      inner = '<p class="ea-text">' + esc(t('ea.text')) + '</p><form class="ea-form" id="ea-form" novalidate>' +
        '<label for="ea-email" class="sr-only">' + esc(t('form.label')) + '</label><div class="join-row">' +
        '<input id="ea-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="254" required placeholder="' + esc(t('form.placeholder')) + '" aria-describedby="ea-msg">' +
        '<button type="submit" class="btn btn-accent btn-lg join-btn" id="ea-btn">' + labelSpan(['cta', 'form.sending'], 'btn-label') + '<span class="spinner" aria-hidden="true"></span></button></div>' +
        '<p id="ea-msg" class="field-msg" aria-live="polite"></p></form>';
    }
    bodyEl.innerHTML = '<div class="ea"><p class="ea-title">' + esc(t('ea.title')) + '</p>' + inner +
      '<button type="button" class="link-btn" data-open-samples>' + esc(t('ea.meanwhile')) + '</button></div>';
    var f = document.getElementById('ea-form');
    if (!f) return;
    var ctx = {
      emailEl: document.getElementById('ea-email'), btn: document.getElementById('ea-btn'), msgEl: document.getElementById('ea-msg'),
      via: 'early_access', quiet: true,
      onOk: function () {
        v.done = true;
        if (views.own !== v || mode !== 'own') return;
        renderView();
        var d = bodyEl.querySelector('.ea-done');
        if (d) d.focus({ preventScroll: true });
      }
    };
    ctx.emailEl.value = typed;
    bindEmailField(ctx);
    f.addEventListener('submit', function (e) { e.preventDefault(); joinWith(ctx); });
  }
  // The hero form changed `joined` (signup or "Use a different email"): keep the early-access view in step.
  function refreshEarly() {
    var v = views.own;
    if (!v || v.kind !== 'early') return;
    if (!joined) v.done = false;
    if (mode === 'own') renderView();
  }
  function renderBusy() {
    bodyEl.innerHTML = '<div class="quiz-error demo-busy">' + icon('i-info') + '<p>' + esc(t('demo.busy')) + '</p>' +
      '<div class="quiz-actions"><button type="button" class="btn btn-ink" data-retry>' + icon('i-refresh') + labelSpan(['demo.retry'], 'btn-text') + '</button>' +
      '<button type="button" class="btn btn-ghost" data-open-samples>' + labelSpan(['demo.tabSamples'], 'btn-text') + '</button></div></div>';
  }
  bodyEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open-own], [data-open-samples], [data-retry]');
    if (!b) return;
    if (b.hasAttribute('data-retry')) submitOwn();
    else openMode(b.hasAttribute('data-open-own') ? 'own' : 'samples');
  });

  // Language switch: chips, the example text and a ready quiz follow it (answer keys match across en/uk).
  function demoLangChanged() {
    if (samples) {
      renderChips();
      renderSampleText();
      var v = views.samples;
      if (v && v.kind === 'quiz' && !samples[v.state.sample].lang) v.state.quiz = sampleQuiz(v.state.sample);
    }
    renderView();
  }

  // No layout shift between views: while the width stays the same the panel never shrinks.
  var ratchetW = 0, ratchetH = 0;
  function ratchetReset() { ratchetW = panel.clientWidth; ratchetH = 0; panel.style.minHeight = ''; }
  function ratchet() {
    if (panel.clientWidth !== ratchetW) ratchetReset();
    var h = panel.offsetHeight;
    if (h > ratchetH) { ratchetH = h; panel.style.minHeight = h + 'px'; }
  }
  window.addEventListener('resize', function () { if (panel.clientWidth !== ratchetW) ratchetReset(); });

  var KEYS = ['A', 'B', 'C', 'D'];
  function icon(id, cls) { return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  // The note sits under the quiz: where this quiz came from, said plainly.
  function noteHtml(s) {
    var body;
    if (s.source === 'live') body = esc(t('quiz.noteLive'));
    else {
      var parts = t('quiz.noteSample').split('{link}');
      body = esc(parts[0]) + '<button type="button" class="link-btn" data-open-own>' + esc(t('quiz.ownLink')) + '</button>' + esc(parts[1] || '');
    }
    return '<p class="quiz-note">' + icon('i-info') + '<span>' + body + '</span></p>';
  }

  function renderQuiz(focusSel) {
    var s = quizState, qs = s.quiz.questions, n = qs.length;
    var note = noteHtml(s);
    var bars = qs.map(function (q, k) {
      var p = s.picks[k];
      return '<i class="' + (p === undefined ? (k === s.i ? 'now' : '') : (p === q.answer ? 'right' : 'wrong')) + '"></i>';
    }).join('');
    var head = '<div class="quiz-top"><p class="quiz-title">' + esc(s.quiz.title || '') + '</p>' +
      (s.i < n ? '<p class="quiz-progress">' + esc(t('quiz.progress', { i: s.i + 1, n: n })) + '</p>' : '') + '</div><div class="quiz-bars" aria-hidden="true">' + bars + '</div>';

    if (s.i >= n) { bodyEl.innerHTML = head + renderScore() + note; bindScore(); ratchet(); focusIn(focusSel || '.score-num'); return; }

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
    bodyEl.innerHTML = head + '<p class="quiz-q" tabindex="-1">' + esc(q.q) + '</p><ul class="opts">' + opts + '</ul>' + fb + note;

    bodyEl.querySelectorAll('.opt').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        s.picks[s.i] = Number(b.getAttribute('data-k'));
        track('quiz_answered', { index: s.i, correct: s.picks[s.i] === q.answer }); // analytics
        // Keyboard activation (detail 0) moves focus to the next step; mouse clicks keep focus calm.
        renderQuiz(ev.detail === 0 ? '[data-next]' : null);
      });
    });
    var next = bodyEl.querySelector('[data-next]');
    if (next) next.addEventListener('click', function () { s.i++; renderQuiz('.quiz-q'); });
    if (next && s.i === n - 1) next.addEventListener('click', function () { track('quiz_completed', { score: qs.filter(function (x, k) { return s.picks[k] === x.answer; }).length, questions: n }); }); // analytics
    ratchet();
    focusIn(focusSel);
  }
  function focusIn(sel) { if (!sel) return; var el = bodyEl.querySelector(sel); if (el) el.focus({ preventScroll: false }); }

  function renderScore() {
    var s = quizState, qs = s.quiz.questions, n = qs.length;
    var right = qs.reduce(function (a, q, k) { return a + (s.picks[k] === q.answer ? 1 : 0); }, 0);
    var verdict = right === n ? t('quiz.perfect') : (right >= Math.ceil(n * 0.6) ? t('quiz.good') : t('quiz.low'));
    var dots = qs.map(function (q, k) { return '<i class="' + (s.picks[k] === q.answer ? 'right' : '') + '"></i>'; }).join('');
    return '<div class="score"><p class="score-num" tabindex="-1">' + right + '/' + n + '</p><p class="score-label">' + esc(verdict + ' ' + t('quiz.score', { s: right, n: n })) + '</p>' +
      '<div class="score-dots" aria-hidden="true">' + dots + '</div>' +
      '<div class="quiz-actions"><button type="button" class="btn btn-accent btn-lg" data-join>' + esc(t('quiz.cta')) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-lg" data-copy-quiz>' + icon('i-copy') + esc(t('quiz.copy')) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-lg" data-again>' + icon('i-refresh') + esc(t('quiz.again')) + '</button></div></div>';
  }
  // Plain text for Google Forms, Kahoot or a printed worksheet: questions, options, answer key.
  function quizAsText(quiz) {
    var NL = "\n", qs = quiz.questions;
    var body = qs.map(function (q, k) {
      return (k + 1) + '. ' + q.q + NL + q.options.map(function (o, j) { return KEYS[j] + ') ' + o; }).join(NL);
    }).join(NL + NL);
    var key = qs.map(function (q, k) { return (k + 1) + '. ' + KEYS[q.answer] + (q.explain ? ' (' + q.explain + ')' : ''); }).join(NL);
    return (quiz.title || t('quiz.copyTitle')) + NL + NL + body + NL + NL + t('quiz.keyTitle') + NL + key + NL;
  }
  function bindScore() {
    bodyEl.querySelector('[data-join]').addEventListener('click', scrollToJoin);
    bodyEl.querySelector('[data-copy-quiz]').addEventListener('click', function () {
      copyText(quizAsText(quizState.quiz)).then(function () { toast(t('quiz.copied')); }, function () { /* ignore */ });
    });
    bodyEl.querySelector('[data-copy-quiz]').addEventListener('click', function () { track('quiz_copied'); }); // analytics
    bodyEl.querySelector('[data-again]').addEventListener('click', function () {
      views[mode] = null;
      renderView();
      document.getElementById('demo').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      var target = mode === 'own' ? lessonEl : (chipsEl.querySelector('.chip[aria-pressed="true"]') || tabEls.samples);
      setTimeout(function () { target.focus({ preventScroll: true }); if (target === lessonEl) lessonEl.select(); }, REDUCED ? 0 : 400);
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
    var colors = (getComputedStyle(document.documentElement).getPropertyValue('--confetti') || '').split(',').map(function (c) { return c.trim(); }).filter(Boolean);
    if (!colors.length) colors = ['#F2E14A', '#161B2E', '#156B42', '#E8836B', '#7A9CF0'];
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

  // One anonymous visit ping per browser session for the experiment funnel (fire-and-forget).
  function sendVisit() {
    try { if (sessionStorage.getItem('qp_visit')) return; sessionStorage.setItem('qp_visit', '1'); } catch (e) { return; }
    if (!API) return;
    apiPost({ action: 'visit', cid: getCid(), lang: lang, utm: attribution.utm, ref: attribution.ref }, 8000).catch(function () { /* ignore */ });
  }

  /* ---------- Offline banner ---------- */
  // A fixed polite live region: present from the start, text only while the browser is offline.
  var offlineEl = document.createElement('div');
  offlineEl.className = 'offline-bar';
  offlineEl.id = 'offline-bar';
  offlineEl.setAttribute('role', 'status');
  offlineEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(offlineEl);
  function renderOffline() {
    var off = navigator.onLine === false;
    offlineEl.classList.toggle('is-on', off);
    offlineEl.textContent = off ? t('net.offline') : '';
  }
  window.addEventListener('offline', renderOffline);
  window.addEventListener('online', renderOffline);

  // Service worker (web/sw.js): offline shell and ready examples after the first visit.
  // Only on https or the 127.0.0.1 dev stand; ?nosw=1 skips it and removes an installed one.
  function registerSw() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== '127.0.0.1') return;
    if (/[?&]nosw=1(?:&|$)/.test(location.search)) {
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }).catch(function () { /* ignore */ });
      return;
    }
    var go = function () { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { /* unsupported or blocked */ }); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  }

  /* ---------- Init ---------- */
  window.QP_I18N = I18N; // web/ui.js builds language-stable labels from both dictionaries
  document.querySelectorAll('.lang [data-lang]').forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });
  applyI18n();
  updateLessonMeta();
  restoreJoined();
  loadStats();
  track('landing_viewed', { lang: lang, has_ref: !!attribution.ref }); // analytics
  sendVisit();
  renderOffline();
  registerSw();
})();
