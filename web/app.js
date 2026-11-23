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
      'meta.title': 'Quizpen: a quiz from your lesson, every right answer explained',
      'meta.desc': 'Paste a textbook page or your notes. Quizpen writes a 5-question quiz from that text, in its language, with a reason for each right answer. Join the waitlist.',
      'skip': 'Skip to content', 'nav.demo': 'Try the demo', 'nav.faq': 'Questions', 'lang.label': 'Language',
      'cta': 'Join Waitlist', 'cta.joined': 'You\'re on the list',
      'hero.kicker': 'Early access for teachers',
      'hero.title': '<span class="h1-line">Quizzes from your own lesson.</span> <span class="h1-line">Every right answer explained.</span>',
      'hero.sub': 'Paste a textbook page, your notes or an article, and Quizpen turns that text into a quiz with a one-line reason next to every right answer.',
      'form.label': 'Your email for early access', 'form.placeholder': 'name@school.org',
      'form.note': 'We\'ll write once, when your access opens. Unsubscribe in one click.',
      'form.sending': 'Joining',
      'err.empty': 'Enter your email so we can save your spot.',
      'err.invalid_email': 'That email doesn\'t look right. Check it for typos.',
      'err.rate_limited': 'Too many tries from this device. Wait a minute, then try again.',
      'err.server': 'We couldn\'t save your email just now. Please try again in a minute.',
      'err.offline': 'No connection. Check your internet and try again.',
      'join.pending': 'No connection. We\'ll send your email as soon as you\'re back online.',
      'net.offline': 'You\'re offline. Ready examples still work.',
      'demo.slow': 'Slow connection. Still working on it.',
      'counter': { one: '{n} teacher has joined', other: '{n} teachers have joined' },
      'counter.first': 'Be among the first teachers to try it',
      'hero.try': 'No sign-up needed. Open a ready example',
      'thanks.title': 'You\'re #{n} on the waitlist',
      'thanks.body': 'We\'ll email {email} when your access is ready.',
      'thanks.already': 'You\'re already on the list. Your spot is saved.',
      'thanks.share': 'Know a colleague who writes quizzes at night? Send them your link.',
      'thanks.linkLabel': 'Your invite link', 'thanks.copy': 'Copy link', 'thanks.copied': 'Copied',
      'thanks.copiedSr': 'Link copied to clipboard', 'thanks.reset': 'Use a different email',
      'thanks.refs': { one: '<strong>{n} colleague</strong> joined via your link', other: '<strong>{n} colleagues</strong> joined via your link' },
      'share.email': 'Email',
      'share.text': 'I joined the Quizpen waitlist. It makes a quiz from your own lesson text, with every right answer explained:',
      'share.subject': 'A quiz from your own lesson, every right answer explained',
      'art.q': 'Why do most leaves look green?',
      'art.a': 'They absorb green light', 'art.b': 'Chlorophyll reflects green light',
      'art.c': 'Their cells hold green water', 'art.d': 'Sunlight is mostly green',
      'art.explain': 'Chlorophyll reflects green, so green is what reaches our eyes.',
      'art.note': 'the right answer,<br>explained in one line',
      'sheet.name': 'Name', 'sheet.class': 'Class', 'sheet.date': 'Date', 'sheet.score': 'Score',
      'sheet.label': 'Sample output · question 1 of 5',
      'demo.title': 'Try it on a ready example',
      'demo.sub': 'Pick a subject and the quiz opens at once. Claude wrote these example quizzes in advance. Quizzes from your own text are in early access, and we don\'t store the text you paste.',
      'demo.label': 'Lesson text',
      'demo.placeholder': 'Paste 200 to 3,000 characters from a textbook page, your notes or an article.',
      'demo.tabSamples': 'Ready examples', 'demo.tabOwn': 'Your text',
      'demo.langNote': 'The quiz comes out in the same language as the text.',
      'demo.show': 'Show the quiz',
      'demo.stepsSample': ['Opening the example', 'Loading the ready quiz'],
      'demo.need': { one: '{n} more character needed', other: '{n} more characters needed' },
      'demo.ready': 'Ready to generate',
      'demo.generate': 'Generate quiz',
      'demo.steps': ['Reading your text', 'Picking the key facts', 'Writing answer options'],
      'demo.working': 'Writing your quiz. This takes a few seconds.',
      'demo.too_short': 'Add a bit more text. The demo needs at least 200 characters.',
      'demo.too_long': 'That\'s over 3,000 characters. Trim it to one or two paragraphs.',
      'demo.busy': 'The live demo is busy right now. Try again in a minute or open a ready example.',
      'demo.retry': 'Try again',
      'ea.title': 'Quizzes from your own text are in early access',
      'ea.text': 'Leave your email and we\'ll let you know when your access opens.',
      'ea.already': 'You\'re already on the list. We\'ll email you when your access opens.',
      'ea.done': 'Done. We\'ll email you when you can make quizzes from your own text.',
      'ea.meanwhile': 'In the meantime, try a ready example',
      'quiz.region': 'Your quiz', 'quiz.emptyTitle': 'Your quiz will appear here',
      'quiz.emptySub': 'Five questions with four options each. Three options are plausible but wrong. The right one comes with a one-line reason.',
      'quiz.progress': 'Question {i} of {n}', 'quiz.right': 'Correct.', 'quiz.wrong': 'Not quite. The answer is {a}.',
      'quiz.next': 'Next question', 'quiz.finish': 'See my score', 'quiz.score': '{s} of {n} correct',
      'quiz.perfect': 'Full marks.', 'quiz.good': 'Nice work.', 'quiz.low': 'A good start.',
      'quiz.noteLive': 'Claude just wrote this quiz from your text.',
      'quiz.noteSample': 'Claude wrote this quiz from the example text ahead of time. Want one from your own lesson? Open {link}.',
      'quiz.ownLink': '“Your text”',
      'quiz.again': 'Try another text', 'quiz.cta': 'Want this for your class? Join the waitlist',
      'quiz.copy': 'Copy quiz', 'quiz.copied': 'Quiz copied as plain text: questions, options and answer key',
      'quiz.copyTitle': 'Quiz', 'quiz.keyTitle': 'Answer key',
      'quiz.ready': 'Quiz ready: {n} questions.',
      'how.title': 'How it works',
      'how.1.t': 'Paste your text',
      'how.1.d': 'Any text you teach from, 200 to 3,000 characters.',
      'how.2.t': 'Check the key',
      'how.2.d': 'Five questions with four options each and a one-line reason next to every right answer.',
      'how.3.t': 'Share it with your class',
      'how.3.d': 'Show the QR code or send the link. You can also copy the quiz or print it.',
      'how.note': 'Ready examples work now. Quizzes from your own text open in early access.',
      'vs.title': 'Why not just ChatGPT?',
      'vs.sub': 'Many teachers already make quizzes in ChatGPT, Gemini, Quizizz or Kahoot, and these tools do a lot well. Here is where Quizpen differs and what it can\'t do yet.',
      'vs.col.qp': 'Quizpen',
      'vs.col.bot': 'ChatGPT, Gemini',
      'vs.col.quiz': 'Quizizz (Wayground), Kahoot',
      'vs.yes': 'Yes',
      'vs.no': 'No',
      'vs.partly': 'Partly',
      'vs.r1': 'A quiz from the text you paste, with no prompt to write',
      'vs.r1.bot': 'you write the prompt',
      'vs.r1.quiz': 'from a file or PDF, in Kahoot in paid plans',
      'vs.r2': 'A reason next to each right answer',
      'vs.r2.bot': 'if you ask for it',
      'vs.r3': 'The quiz in the language of your text',
      'vs.r3.quiz': 'Quizizz translates activities, language list not published',
      'vs.r4': 'Students play it as a game on their phones',
      'vs.r4.bot': 'copy and paste only',
      'vs.r5': 'Free to use today',
      'vs.r5.qp': 'ready examples now, your text in early access',
      'vs.r5.bot': 'ChatGPT for Teachers for US K-12; Gemini with Google Workspace for Education',
      'vs.r5.quiz': 'Quizizz Basic with limits; Kahoot! Go without AI',
      'vs.r6': 'Grades sent to Google Classroom, Canvas and similar',
      'vs.r6.qp': 'copy or print for now',
      'vs.r6.quiz': 'Quizizz',
      'vs.foot': 'Based on the vendors\' public pages, November 2026.',
      'students.title': 'What your students see',
      'students.sub': 'They open the quiz on their phones from your link or QR code.',
      'students.1': 'No account or sign-up',
      'students.2': 'A short explanation after every answer',
      'students.3': 'A streak for right answers in a row',
      'students.4': 'A final score at the end',
      'students.5': 'A review of their answers',
      'students.6': 'We collect no data about them',
      'features.title': 'What you get from one text',
      'features.sub': 'Use the text you already teach from. Quizpen turns it into five questions for your class.',
      'f1.t': 'Questions only from your text',
      'f1.d': 'Quizpen asks only about what is in the text you paste, so the quiz covers what you taught. A text in Spanish gives you a quiz in Spanish.',
      'f2.t': 'A key you can check quickly',
      'f2.d': 'Each right answer has a one-sentence reason that points to your text. Right answers fall on different letters from A to D, and wrong options are about as long as the right one. Students can\'t pick the answer by its letter or its length.',
      'f3.t': 'On phones or on paper',
      'f3.d': 'Students open the quiz from a link or a QR code on the board. For a paper version, copy the quiz in one click or print it.',
      'proof.title': 'What the research says',
      'proof.1': '<strong>About 1 in 3 teachers</strong> in OECD countries already use AI at work. In Singapore and the UAE, up to 75% do.',
      'proof.2': '<strong>66% of teachers</strong> think AI can give wrong or inappropriate recommendations. So every right answer in Quizpen comes with a reason you can check against your text.',
      'proof.3': '<strong>Practice quizzes help students remember.</strong> A week after studying a text, students who practiced recalling it remembered more than students who reread it.',
      'src.1': '<a href="https://www.oecd.org/en/publications/results-from-talis-2024_90df6235-en.html" target="_blank" rel="noopener noreferrer">OECD, Results from TALIS 2024</a>, the Teaching and Learning International Survey.',
      'src.2': '<a href="https://www.ei-ie.org/en/item/31815:using-artificial-intelligence-takeaways-from-talis-2024" target="_blank" rel="noopener noreferrer">Education International, "Using artificial intelligence: takeaways from TALIS 2024"</a>.',
      'src.3': '<a href="https://doi.org/10.1111/j.1467-9280.2006.01693.x" target="_blank" rel="noopener noreferrer">Roediger and Karpicke, "Test-Enhanced Learning"</a>, Psychological Science, 2006.',
      'faq.title': 'Questions teachers ask',
      'faq.q1': 'When can I start using Quizpen?',
      'faq.a1': 'We open access in small groups, in the order teachers joined. You\'ll get one email when it\'s your turn. Ready examples work right now.',
      'faq.q2': 'Will it cost anything?',
      'faq.a2': 'Early access is free for teachers on the waitlist. If we add paid plans later, we\'ll tell you before anything changes.',
      'faq.q3': 'Which subjects and languages does it work for?',
      'faq.a3': 'Any subject you teach from text, such as history, science, geography or literature. The quiz comes out in the language of the text you paste. Open the Spanish and Polish examples in the demo to see it.',
      'faq.q4': 'How is this different from ChatGPT or Gemini?',
      'faq.a4': 'In a chatbot you write the prompt and set the format yourself. In Quizpen you paste the text and get five questions with a reason next to each right answer, ready for students to play from a link. The quiz copies in one click, so you can keep using the tools you have.',
      'faq.q5': 'Can I trust the answer key?',
      'faq.a5': 'AI can still make mistakes, so look the quiz over before class. Each reason shows which part of your text the answer comes from, so you can check every answer against the text.',
      'faq.q6': 'What happens to my text and my students\' data?',
      'faq.a6': 'Your text goes to an AI model only to write the quiz, and we don\'t store it. Students don\'t create accounts, and we collect no data about them. Paste lesson material only, without student names or other personal details.',
      'final.title': 'Your next quiz can come from your own lesson.',
      'final.sub': 'Join the waitlist, and we\'ll email you once, when you can paste your own text.',
      'footer.privacy': 'We use your email only to tell you about access.'
    },
    uk: {
      'meta.title': 'Quizpen: тест із вашого уроку з поясненням до кожної відповіді',
      'meta.desc': 'Вставте параграф підручника чи конспект. Quizpen складе з цього тексту тест на п’ять питань тією ж мовою, з поясненням до кожної правильної відповіді.',
      'skip': 'Перейти до змісту', 'nav.demo': 'Спробувати демо', 'nav.faq': 'Питання', 'lang.label': 'Мова',
      'cta': 'Приєднатися до списку', 'cta.joined': 'Ви вже в списку',
      'hero.kicker': 'Ранній доступ для вчителів',
      'hero.title': '<span class="h1-line">Тест із вашого уроку.</span> <span class="h1-line">З поясненням до кожної правильної відповіді.</span>',
      'hero.sub': 'Вставте параграф підручника, конспект чи статтю, і Quizpen перетворить цей текст на тест з поясненням в один рядок до кожної правильної відповіді.',
      'form.label': 'Ваша пошта для раннього доступу', 'form.placeholder': 'imia@shkola.ua',
      'form.note': 'Напишемо один раз, коли відкриємо вам доступ. Відписатися можна одним кліком.',
      'form.sending': 'Додаємо',
      'err.empty': 'Введіть пошту, щоб ми зберегли ваше місце.',
      'err.invalid_email': 'Схоже, в адресі помилка. Перевірте її, будь ласка.',
      'err.rate_limited': 'Забагато спроб із цього пристрою. Зачекайте хвилину й спробуйте ще раз.',
      'err.server': 'Не вдалося зберегти пошту. Спробуйте ще раз за хвилину.',
      'err.offline': 'Немає з’єднання. Перевірте інтернет і спробуйте ще раз.',
      'join.pending': 'Немає з’єднання. Надішлемо вашу адресу, щойно з’явиться інтернет.',
      'net.offline': 'Немає інтернету. Готові приклади працюють і без нього.',
      'demo.slow': 'Повільне з’єднання. Ще працюємо.',
      'counter': { one: '{n} вчитель уже приєднався', few: '{n} вчителі вже приєдналися', many: '{n} вчителів уже приєдналися', other: '{n} вчителя вже приєдналися' },
      'counter.first': 'Станьте одним із перших учителів, які спробують Quizpen',
      'hero.try': 'Без реєстрації. Відкрийте готовий приклад',
      'thanks.title': 'Ви №{n} у списку очікування',
      'thanks.body': 'Ми напишемо на {email}, щойно доступ буде готовий.',
      'thanks.already': 'Ви вже в списку. Ваше місце збережено.',
      'thanks.share': 'Знаєте колегу, який складає тести вечорами? Надішліть йому своє посилання.',
      'thanks.linkLabel': 'Ваше посилання-запрошення', 'thanks.copy': 'Копіювати', 'thanks.copied': 'Скопійовано',
      'thanks.copiedSr': 'Посилання скопійовано', 'thanks.reset': 'Вказати іншу пошту',
      'thanks.refs': { one: '<strong>{n} колега</strong> приєднався за вашим посиланням', few: '<strong>{n} колеги</strong> приєдналися за вашим посиланням', many: '<strong>{n} колег</strong> приєдналися за вашим посиланням', other: '<strong>{n} колеги</strong> приєдналися за вашим посиланням' },
      'share.email': 'Пошта',
      'share.text': 'Я в списку очікування Quizpen. Він складає тест із тексту вашого уроку з поясненням до кожної правильної відповіді:',
      'share.subject': 'Тест із вашого уроку з поясненням до кожної відповіді',
      'art.q': 'Чому більшість листків здаються зеленими?',
      'art.a': 'Вони поглинають зелене світло', 'art.b': 'Хлорофіл відбиває зелене світло',
      'art.c': 'Їхні клітини містять зелену воду', 'art.d': 'Сонячне світло переважно зелене',
      'art.explain': 'Хлорофіл відбиває зелене світло, тому до наших очей доходить саме воно.',
      'art.note': 'правильна відповідь<br>і пояснення в один рядок',
      'sheet.name': 'Ім’я', 'sheet.class': 'Клас', 'sheet.date': 'Дата', 'sheet.score': 'Бали',
      'sheet.label': 'Приклад результату · питання 1 з 5',
      'demo.title': 'Спробуйте на готовому прикладі',
      'demo.sub': 'Оберіть предмет, і тест відкриється одразу. Ці тести Claude склав заздалегідь. Тести з вашого тексту поки в ранньому доступі, а вставлений текст ми не зберігаємо.',
      'demo.label': 'Текст уроку',
      'demo.placeholder': 'Вставте від 200 до 3000 символів з підручника, конспекту чи статті.',
      'demo.tabSamples': 'Готові приклади', 'demo.tabOwn': 'Ваш текст',
      'demo.langNote': 'Тест буде тією ж мовою, що й текст.',
      'demo.show': 'Показати тест',
      'demo.stepsSample': ['Відкриваємо приклад', 'Завантажуємо готовий тест'],
      'demo.need': { one: 'ще {n} символ', few: 'ще {n} символи', many: 'ще {n} символів', other: 'ще {n} символу' },
      'demo.ready': 'Можна створювати тест',
      'demo.generate': 'Створити тест',
      'demo.steps': ['Читаємо текст', 'Вибираємо головні факти', 'Пишемо варіанти відповідей'],
      'demo.working': 'Складаємо тест. Це займе кілька секунд.',
      'demo.too_short': 'Додайте ще трохи тексту. Для демо потрібно щонайменше 200 символів.',
      'demo.too_long': 'Це понад 3000 символів. Скоротіть до одного-двох абзаців.',
      'demo.busy': 'Демо зараз перевантажене. Спробуйте за хвилину або відкрийте готовий приклад.',
      'demo.retry': 'Спробувати ще раз',
      'ea.title': 'Тести з вашого тексту поки в ранньому доступі',
      'ea.text': 'Залиште пошту, і ми напишемо, щойно доступ відкриється для вас.',
      'ea.already': 'Ви вже в списку. Напишемо, щойно доступ відкриється для вас.',
      'ea.done': 'Готово. Напишемо, щойно ви зможете складати тести зі свого тексту.',
      'ea.meanwhile': 'А поки спробуйте готовий приклад',
      'quiz.region': 'Ваш тест', 'quiz.emptyTitle': 'Тут з’явиться ваш тест',
      'quiz.emptySub': 'П’ять питань, у кожному чотири варіанти. Три з них правдоподібні, але неправильні. Правильний має пояснення в одне речення.',
      'quiz.progress': 'Питання {i} з {n}', 'quiz.right': 'Правильно.', 'quiz.wrong': 'Не зовсім. Правильна відповідь: {a}.',
      'quiz.next': 'Наступне питання', 'quiz.finish': 'Мій результат', 'quiz.score': '{s} з {n} правильно',
      'quiz.perfect': 'Усе правильно.', 'quiz.good': 'Гарний результат.', 'quiz.low': 'Непоганий початок.',
      'quiz.noteLive': 'Claude щойно склав цей тест із вашого тексту.',
      'quiz.noteSample': 'Цей тест Claude склав заздалегідь із тексту прикладу. Хочете тест зі свого уроку? Відкрийте {link}.',
      'quiz.ownLink': '«Ваш текст»',
      'quiz.again': 'Спробувати інший текст', 'quiz.cta': 'Хочете такий тест для свого класу? Приєднуйтеся до списку',
      'quiz.copy': 'Копіювати тест', 'quiz.copied': 'Тест скопійовано як текст: питання, варіанти й ключ відповідей',
      'quiz.copyTitle': 'Тест', 'quiz.keyTitle': 'Ключ відповідей',
      'quiz.ready': 'Тест готовий: питань {n}.',
      'how.title': 'Як це працює',
      'how.1.t': 'Вставте текст',
      'how.1.d': 'Будь-який текст, за яким ви ведете урок, від 200 до 3000 символів.',
      'how.2.t': 'Перевірте ключ',
      'how.2.d': 'П’ять питань по чотири варіанти, і біля кожної правильної відповіді пояснення в один рядок.',
      'how.3.t': 'Покажіть класу',
      'how.3.d': 'Виведіть QR-код на екран або надішліть посилання. Тест можна й скопіювати чи роздрукувати.',
      'how.note': 'Готові приклади працюють уже зараз. Тести з вашого тексту відкриваються в ранньому доступі.',
      'vs.title': 'А чому не просто ChatGPT?',
      'vs.sub': 'Багато вчителів уже складають тести в ChatGPT, Gemini, Quizizz чи Kahoot, і ці інструменти багато що роблять добре. Ось чим відрізняється Quizpen і чого він поки не вміє.',
      'vs.col.qp': 'Quizpen',
      'vs.col.bot': 'ChatGPT, Gemini',
      'vs.col.quiz': 'Quizizz (Wayground), Kahoot',
      'vs.yes': 'Так',
      'vs.no': 'Ні',
      'vs.partly': 'Частково',
      'vs.r1': 'Тест із вставленого тексту без запиту',
      'vs.r1.bot': 'запит пишете ви',
      'vs.r1.quiz': 'із файлу чи PDF, у Kahoot у платних планах',
      'vs.r2': 'Пояснення біля кожної правильної відповіді',
      'vs.r2.bot': 'якщо попросити',
      'vs.r3': 'Тест мовою вашого тексту',
      'vs.r3.quiz': 'Quizizz перекладає, списку мов немає',
      'vs.r4': 'Учні проходять тест як гру з телефона',
      'vs.r4.bot': 'лише копіювати',
      'vs.r5': 'Можна користуватися безкоштовно вже сьогодні',
      'vs.r5.qp': 'приклади вже, свій текст у ранньому доступі',
      'vs.r5.bot': 'ChatGPT for Teachers для шкіл США; Gemini у Workspace for Education',
      'vs.r5.quiz': 'Quizizz Basic з лімітами; Kahoot! Go без ШІ',
      'vs.r6': 'Оцінки одразу в Google Classroom, Canvas тощо',
      'vs.r6.qp': 'поки копіювання й друк',
      'vs.r6.quiz': 'Quizizz',
      'vs.foot': 'За публічними сторінками сервісів, листопад 2026.',
      'students.title': 'Що бачать учні',
      'students.sub': 'Учні відкривають тест на телефоні за вашим посиланням або QR-кодом.',
      'students.1': 'Без акаунта й реєстрації',
      'students.2': 'Коротке пояснення після кожної відповіді',
      'students.3': 'Серія правильних відповідей поспіль',
      'students.4': 'Підсумковий бал наприкінці',
      'students.5': 'Перегляд своїх відповідей',
      'students.6': 'Ми не збираємо про них жодних даних',
      'features.title': 'Що ви отримуєте з одного тексту',
      'features.sub': 'Візьміть текст, за яким уже ведете урок. Quizpen зробить із нього п’ять питань для класу.',
      'f1.t': 'Питання лише з вашого тексту',
      'f1.d': 'Quizpen питає лише про те, що є у вставленому тексті, тож тест не виходить за межі пройденого. Текст іспанською дасть тест іспанською.',
      'f2.t': 'Ключ, який легко перевірити',
      'f2.d': 'Біля кожної правильної відповіді є пояснення в одне речення, яке вказує на ваш текст. Правильні відповіді стоять під різними літерами від A до D, а неправильні варіанти приблизно такої ж довжини. Тож угадати відповідь за літерою чи довжиною не вийде.',
      'f3.t': 'На телефоні або на папері',
      'f3.d': 'Учні відкривають тест за посиланням або QR-кодом на екрані. Для паперового варіанта скопіюйте тест одним кліком або роздрукуйте його.',
      'proof.title': 'Що кажуть дослідження',
      'proof.1': '<strong>Приблизно кожен третій учитель</strong> у країнах ОЕСР уже користується ШІ в роботі. У Сінгапурі та ОАЕ таких до 75%.',
      'proof.2': '<strong>66% учителів</strong> вважають, що ШІ може давати хибні чи недоречні рекомендації. Тому кожна правильна відповідь у Quizpen має пояснення, яке легко звірити з вашим текстом.',
      'proof.3': '<strong>Тести допомагають запам’ятати.</strong> Через тиждень після вивчення тексту учні, які відтворювали його з пам’яті, пригадали більше за тих, хто його перечитував.',
      'src.1': '<a href="https://www.oecd.org/en/publications/results-from-talis-2024_90df6235-en.html" target="_blank" rel="noopener noreferrer">ОЕСР, Results from TALIS 2024</a>, Міжнародне дослідження викладання та навчання.',
      'src.2': '<a href="https://www.ei-ie.org/en/item/31815:using-artificial-intelligence-takeaways-from-talis-2024" target="_blank" rel="noopener noreferrer">Education International, «Using artificial intelligence: takeaways from TALIS 2024»</a>.',
      'src.3': '<a href="https://doi.org/10.1111/j.1467-9280.2006.01693.x" target="_blank" rel="noopener noreferrer">Roediger і Karpicke, «Test-Enhanced Learning»</a>, Psychological Science, 2006.',
      'faq.title': 'Що питають учителі',
      'faq.q1': 'Коли я зможу користуватися Quizpen?',
      'faq.a1': 'Ми відкриваємо доступ невеликими групами, у порядку запису. Коли настане ваша черга, надішлемо один лист. Готові приклади можна відкрити вже зараз.',
      'faq.q2': 'Це платно?',
      'faq.a2': 'Ранній доступ безкоштовний для вчителів зі списку. Якщо згодом з’являться платні тарифи, ми попередимо заздалегідь.',
      'faq.q3': 'Для яких предметів і мов це підходить?',
      'faq.a3': 'Для будь-якого предмета, де ви працюєте з текстом: історія, природничі науки, географія, література. Тест виходить мовою вставленого тексту. Відкрийте в демо приклади іспанською та польською, і ви це побачите.',
      'faq.q4': 'Чим це відрізняється від ChatGPT чи Gemini?',
      'faq.a4': 'У чат-боті запит і формат ви задаєте самі. У Quizpen ви вставляєте текст і отримуєте п’ять питань із поясненням біля кожної правильної відповіді, а учні проходять тест за посиланням. Тест копіюється одним кліком, тож можна й далі працювати у звичних інструментах.',
      'faq.q5': 'Чи можна довіряти ключу відповідей?',
      'faq.a5': 'ШІ все ще може помилятися, тому перегляньте тест перед уроком. Кожне пояснення показує, з якого місця вашого тексту взято відповідь, тож кожну відповідь можна звірити з текстом.',
      'faq.q6': 'Що буде з моїм текстом і даними учнів?',
      'faq.a6': 'Ваш текст надсилаємо моделі ШІ лише для того, щоб скласти тест, і не зберігаємо його. Учні не створюють акаунтів, і ми не збираємо про них жодних даних. Вставляйте лише матеріал уроку, без імен учнів та інших особистих даних.',
      'final.title': 'Наступний тест може бути з вашого власного уроку.',
      'final.sub': 'Приєднуйтеся до списку, і ми напишемо один раз, коли ви зможете вставити свій текст.',
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
    var sp = { lang: lang, has_ref: !!attribution.ref };
    if (ctx.via) sp.via = ctx.via;
    track('signup_submitted', sp); // analytics
    sendJoin(ctx, { email: email, lang: lang, hp: ctx.hpEl ? ctx.hpEl.value : '' });
  }

  // p = { email, lang, hp }. A dropped connection (offline/network) keeps p as a pending signup,
  // sent once when the browser is back online or on the next visit.
  function sendJoin(ctx, p) {
    busyJoin = true;
    var btn = ctx.btn;
    btn.disabled = true; btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true');
    btn.querySelector('.btn-label').textContent = t('form.sending');
    apiPost({ action: 'join', email: p.email, lang: p.lang, ref: attribution.ref, utm: attribution.utm, hp: p.hp || '', cid: getCid() }, 15000)
      .then(function (r) {
        if (r.ok) {
          joined = { position: r.position, total: r.total, refCode: r.refCode, referrals: r.referrals || 0, already: !!r.already, email: p.email, ts: Date.now() };
          track('signup_succeeded', { already: !!r.already, has_ref: !!attribution.ref, demo_used: demoT0 > 0 }); // analytics
          store.set('qp_joined', joined);
          if (typeof r.total === 'number') { total = r.total; renderCounters(); }
          renderThanks(joined, true, ctx.quiet);
          if (ctx.onOk) ctx.onOk(); else refreshEarly();
        } else setJoinError(r.error || 'server', ctx);
      })
      .catch(function (err) {
        if (err.code === 'offline' || err.code === 'network') {
          store.set(PENDING_KEY, p);
          pendingCtx = ctx;
          setJoinPending(ctx);
        } else setJoinError('server', ctx);
      })
      .then(function () {
        busyJoin = false;
        btn.disabled = false; btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy');
        btn.querySelector('.btn-label').textContent = t('cta');
      });
  }

  /* ---------- Pending signup (dropped connection) ---------- */
  var PENDING_KEY = 'qp_join_pending';
  var pendingCtx = null; // the form that queued it in this page life; the inline form may be re-rendered since
  function setJoinPending(ctx) {
    ctx.msgEl.className = 'field-msg is-pending';
    ctx.msgEl.textContent = t('join.pending');
    ctx.emailEl.removeAttribute('aria-invalid');
  }
  // Sends the pending signup once: it is cleared before the request and stored again only on a network failure.
  function flushPendingJoin() {
    var p = store.get(PENDING_KEY);
    if (!p) return;
    if (joined || typeof p.email !== 'string' || !validEmail(p.email)) { store.del(PENDING_KEY); return; }
    if (busyJoin || navigator.onLine === false) return;
    var ctx = pendingCtx && document.body.contains(pendingCtx.emailEl) ? pendingCtx : heroJoin;
    pendingCtx = null;
    store.del(PENDING_KEY);
    if (!ctx.emailEl.value.trim()) ctx.emailEl.value = p.email;
    setJoinError(null, ctx);
    sendJoin(ctx, p);
  }
  // On load: send it now, or (still offline) show it in the hero form until the 'online' event.
  function restorePendingJoin() {
    var p = store.get(PENDING_KEY);
    if (!p) return;
    if (navigator.onLine !== false || joined) { flushPendingJoin(); return; }
    if (typeof p.email === 'string' && !emailEl.value.trim()) emailEl.value = p.email;
    pendingCtx = heroJoin;
    setJoinPending(heroJoin);
  }
  window.addEventListener('online', flushPendingJoin);
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

  var samplesReady = fetch('data/samples.json?v=20261121e').then(function (r) { return r.json(); }).then(function (d) {
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
    // A table-of-contents row: "Biology" in small caps, then the topic; the label is split at its first ": ".
    var split = function (str) { var i = str.indexOf(': '); return i < 0 ? ['', str] : [str.slice(0, i), str.slice(i + 2)]; };
    var upper = function (str) { return str.charAt(0).toUpperCase() + str.slice(1); };
    chipsEl.innerHTML = sampleOrder.map(function (id) {
      var s = samples[id], label = s.label || {};
      var cur = split(label[lang] || label.en || id), en = split(label.en || id), uk = split(label.uk || label.en || id);
      var tag = s.lang ? '<span class="chip-tag" aria-hidden="true">' + esc(s.lang.toUpperCase()) + '</span>' : '';
      return '<button type="button" class="chip" data-sample="' + esc(id) + '" aria-pressed="' + (id === activeSample) + '">' +
        '<span class="chip-subj" data-rsv="' + esc(en[0] + '\n' + uk[0]) + '">' + esc(cur[0]) + '</span>' +
        (cur[0] ? '<span class="sr-only">: </span>' : '') +
        // The topic box holds both languages' ghosts (data-rsv-en/uk), so a topic that wraps in one language
        // keeps the same height in the other and the sections below do not move on a language switch.
        '<span class="chip-topic' + (tag ? ' has-tag' : '') + '" data-rsv-en="' + esc(upper(en[1])) + '" data-rsv-uk="' + esc(upper(uk[1])) + '">' +
        '<span class="chip-topic-text">' + esc(upper(cur[1])) + tag + '</span></span></button>';
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
    var loading = { kind: 'loading', key: 'demo.steps', every: 1100, t0: started, slowAfter: SLOW_MS };
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
  var stepTimer = null, slowTimer = null;
  var SLOW_MS = 8000; // a live quiz still loading after this gets the "slow connection" line
  function renderView() {
    clearInterval(stepTimer);
    clearTimeout(slowTimer);
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
      '</ul>' + (v.slowAfter ? '<p class="skel-slow" hidden>' + esc(t('demo.slow')) + '</p>' : '') + '<div class="skel-bar q"></div><div class="skel-bar opt"></div><div class="skel-bar opt"></div><div class="skel-bar opt"></div><div class="skel-bar opt"></div></div>';
    var lis = bodyEl.querySelectorAll('.skel-steps li'), max = v.finish ? lis.length : lis.length - 1;
    var at = function () { return Math.min(max, Math.floor((Date.now() - v.t0) / v.every)); };
    var tick = function () {
      var i = at();
      lis.forEach(function (li, k) { li.className = k < i ? 'is-done' : (k === i ? 'is-now' : ''); });
      if (i >= max) clearInterval(stepTimer);
    };
    tick();
    if (at() < max) stepTimer = setInterval(tick, v.every);
    if (!v.slowAfter) return;
    // Slow connection: one calm line under the steps, announced once through the status region.
    var slowEl = bodyEl.querySelector('.skel-slow'), left = v.slowAfter - (Date.now() - v.t0);
    if (left <= 0) { slowEl.hidden = false; return; }
    slowTimer = setTimeout(function () {
      slowEl.hidden = false;
      if (views[mode] === v) statusEl.textContent = t('demo.slow');
    }, left);
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
    if (v.done) inner = '<p class="ea-done" tabindex="-1">' + penTick('ea-tick') + '<span>' + esc(t('ea.done')) + '</span></p>';
    else if (joined) inner = '<p class="ea-done">' + penTick('ea-tick') + '<span>' + esc(t('ea.already')) + '</span></p>';
    else {
      inner = '<p class="ea-text">' + esc(t('ea.text')) + '</p><form class="ea-form" id="ea-form" novalidate>' +
        '<label for="ea-email" class="sr-only">' + esc(t('form.label')) + '</label><div class="join-row">' +
        '<input id="ea-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="254" required placeholder="' + esc(t('form.placeholder')) + '" aria-describedby="ea-msg">' +
        '<button type="submit" class="btn btn-ink btn-lg join-btn" id="ea-btn">' + labelSpan(['cta', 'form.sending'], 'btn-label') + '<span class="spinner" aria-hidden="true"></span></button></div>' +
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
    bodyEl.innerHTML = '<div class="quiz-error demo-busy"><p>' + esc(t('demo.busy')) + '</p>' +
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
  // Red pen marks drawn by hand (the hero's loop and tick paths); pathLength 1 lets CSS draw them in.
  function penSvg(cls, box, width, inner) {
    return '<svg class="' + cls + '" viewBox="' + box + '" fill="none" stroke="currentColor" stroke-width="' + width +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  function penTick(cls) { return penSvg(cls, '0 0 34 28', 3, '<path pathLength="1" d="M3 15 C6 17 9 20.5 11.5 25 C15.5 16 21.5 8 31 2"/>'); }
  var PEN_LOOP = penSvg('opt-loop', '0 0 46 40', 2.2, '<path pathLength="1" d="M27 4.5 C14 2 3.5 9 4.5 20 C5.5 31 19 37.5 31 34 C41 31 44.5 21 40 12.5 C36.5 6 28 3 19 5.5 C15 6.6 12 8.5 10.5 11"/>');
  var SCORE_LOOP = penSvg('score-loop', '0 0 168 108', 2.5, '<path pathLength="1" d="M99 12 C51 5 13 24 16 54 C20 84 69 101 113 92 C150 84 162 57 146 34 C133 16 102 8 69 15 C55 18 44 23 38 30"/>');
  var SCISSORS = penSvg('quiz-key-cut', '0 0 30 18', 1.5, '<circle cx="5.5" cy="4.5" r="3.5"/><circle cx="5.5" cy="13.5" r="3.5"/><path d="M8.5 6.5 L27 14"/><path d="M8.5 11.5 L27 4"/>');

  // The note sits under the quiz: where this quiz came from, said plainly.
  function noteHtml(s) {
    var body;
    if (s.source === 'live') body = esc(t('quiz.noteLive'));
    else {
      var parts = t('quiz.noteSample').split('{link}');
      body = esc(parts[0]) + '<button type="button" class="link-btn" data-open-own>' + esc(t('quiz.ownLink')) + '</button>' + esc(parts[1] || '');
    }
    return '<p class="quiz-note">' + body + '</p>';
  }

  // The answer key: a tear-off strip that fills in as the visitor answers; it is also the progress
  // (the checks count `.quiz-bars i` to know the number of questions).
  function keyHtml(s) {
    return '<div class="quiz-key quiz-bars" aria-hidden="true">' + SCISSORS + '<span class="quiz-key-label">' + esc(t('quiz.keyTitle')) + '</span>' +
      s.quiz.questions.map(function (q, k) {
        var p = s.picks[k], cls = p === undefined ? (k === s.i ? 'now' : '') : (p === q.answer ? 'right' : 'wrong');
        return '<i' + (cls ? ' class="' + cls + '"' : '') + '>' + (k + 1) + '&nbsp;' + (p === undefined ? '<span class="key-blank"></span>' : KEYS[q.answer]) + '</i>';
      }).join('') + '</div>';
  }

  function renderQuiz(focusSel) {
    var s = quizState, qs = s.quiz.questions, n = qs.length;
    var note = noteHtml(s);
    var head = '<p class="quiz-sheet" aria-hidden="true"><span>' + esc(t('sheet.name')) + '</span><i></i></p>' +
      '<div class="quiz-top"><p class="quiz-title">' + esc(s.quiz.title || '') + '</p>' +
      (s.i < n ? '<p class="quiz-progress">' + esc(t('quiz.progress', { i: s.i + 1, n: n })) + '</p>' : '') + '</div>';

    if (s.i >= n) { bodyEl.innerHTML = head + renderScore() + keyHtml(s) + note; bindScore(); ratchet(); focusIn(focusSel || '.score-num'); return; }

    var q = qs[s.i], pick = s.picks[s.i], answered = pick !== undefined;
    // After the answer the right letter is circled and ticked in red pen, a wrong pick is struck out.
    var opts = q.options.map(function (o, k) {
      var cls = 'opt', right = answered && k === q.answer;
      if (answered) cls += right ? ' is-right' : (k === pick ? ' is-wrong' : ' is-dim');
      return '<li><button type="button" class="' + cls + '" data-k="' + k + '"' + (answered ? ' disabled' : '') + '><span class="opt-key">' + KEYS[k] + (right ? PEN_LOOP : '') + '</span>' +
        '<span class="opt-text">' + esc(o) + '</span>' + (right ? penTick('opt-tick') : '') + '</button></li>';
    }).join('');
    var fb = '', actions = '';
    if (answered) {
      var ok = pick === q.answer;
      fb = '<div class="feedback ' + (ok ? 'is-right' : 'is-wrong') + '" role="status"><strong>' + esc(ok ? t('quiz.right') : t('quiz.wrong', { a: KEYS[q.answer] })) + '</strong> ' + esc(q.explain || '') + '</div>';
      actions = '<div class="quiz-actions"><button type="button" class="btn btn-ink" data-next>' + esc(s.i === n - 1 ? t('quiz.finish') : t('quiz.next')) + icon('i-arrow') + '</button></div>';
    }
    bodyEl.innerHTML = head + '<div class="quiz-item"><p class="quiz-q" tabindex="-1"><span class="quiz-num" aria-hidden="true">' + (s.i + 1) + '.</span>' + esc(q.q) + '</p>' +
      '<ul class="opts">' + opts + '</ul>' + fb + '</div>' + actions + keyHtml(s) + note;

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
    // The mark circled in red pen, like a teacher's mark on the sheet.
    return '<div class="score"><div class="score-mark">' + SCORE_LOOP + '<p class="score-num" tabindex="-1">' + right + '/' + n + '</p></div>' +
      '<p class="score-label">' + esc(verdict + ' ' + t('quiz.score', { s: right, n: n })) + '</p>' +
      '<div class="quiz-actions"><button type="button" class="btn btn-ink btn-lg" data-join>' + esc(t('quiz.cta')) + '</button>' +
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
    if (!colors.length) colors = ['#C8312B', '#1F2A44', '#1D6B3A', '#7A9CF0', '#E58A8A'];
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
    // A page that was already controlled by an older worker reloads once when the new release takes over,
    // so a returning visitor never stays on a mix of old and new files.
    var hadController = !!navigator.serviceWorker.controller, loadedAt = Date.now();
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || Date.now() - loadedAt > 15000) return;
      try { if (sessionStorage.getItem('qp_sw_reloaded')) return; sessionStorage.setItem('qp_sw_reloaded', '1'); } catch (e) { return; }
      location.reload();
    });
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  }

  /* ---------- Init ---------- */
  window.QP_I18N = I18N; // web/ui.js builds language-stable labels from both dictionaries
  document.querySelectorAll('.lang [data-lang]').forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });
  applyI18n();
  updateLessonMeta();
  restoreJoined();
  restorePendingJoin();
  loadStats();
  track('landing_viewed', { lang: lang, has_ref: !!attribution.ref }); // analytics
  sendVisit();
  renderOffline();
  registerSw();
  // Init done: ends the loading bar (styles.css, html.js:not(.is-ready)::before).
  document.documentElement.classList.add('is-ready');
})();
