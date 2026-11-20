# Quizpen: правки текстів сторінки за результатами дослідження

Шість правок. Кожна підсилює один із розривів ринку (будь-який текст учителя, якісні неправильні варіанти й пояснення, добра українська, демо без реєстрації) або відповідає на головні заперечення (точність ключа, час на перевірку). Джерела: research/REFERENCES.md і research/ICP.md.

Де міняти: словники в web/app.js (EN у блоці `en`, UA у блоці `uk`) і запасний англійський текст того самого елемента в web/index.html (атрибут `data-i18n`), інакше до завантаження скрипта видно старий текст. Правки 1-5 описують те, що демо вже робить. Правка 6 стане чесною лише після зміни промпту, до того її не ставимо.

---

## 1. Підзаголовок першого екрана: «будь-який ваш текст»

Ключ `hero.sub` (app.js, index.html рядок 79).

- EN, зараз: Quizpen turns the text you teach from into a multiple-choice quiz with answers and a short explanation for each.
- EN, нове: Paste any text you teach from: a textbook page, your notes or an article. Quizpen writes a multiple-choice quiz from it, with an answer key and a short explanation for every question.
- UA, зараз: Quizpen перетворює текст, за яким ви ведете урок, на тест із варіантами відповідей і коротким поясненням до кожного питання.
- UA, нове: Вставте будь-який текст, за яким ви навчаєте: сторінку підручника, свій конспект чи статтю. Quizpen складе з нього тест із ключем відповідей і коротким поясненням до кожного питання.

Чому: «Мрія» робить тест за темою календарного плану, «На Урок» за темою чи абзацом підручника; «будь-який власний текст» є головною нішею (REFERENCES 3.1, 3.2, 6.2). На першому екрані це має бути видно одразу, а не лише в блоці переваг.

## 2. Картка «ключ відповідей»: точність і швидка перевірка

Ключі `f2.t` і `f2.d` (app.js, index.html рядки 214-215).

- EN, зараз: An answer key that explains itself / Each question has one correct answer and a one-sentence reason. You check the key at a glance, and students see why they got it wrong.
- EN, нове: An answer key you can check at a glance / Every question comes only from your text, and every answer has a one-sentence reason based on what the text says. The right answer moves between A, B, C and D, so students can't guess a pattern.
- UA, зараз: Ключ відповідей із поясненнями / Кожне питання має одну правильну відповідь і пояснення в одне речення. Ви перевіряєте ключ одним поглядом, а учні бачать, де помилилися.
- UA, нове: Ключ, який легко звірити / Кожне питання береться лише з вашого тексту, а до відповіді є пояснення в одне речення з опорою на те, що в ньому сказано. Правильна відповідь стоїть то під А, то під Г, тож учні не вгадають закономірність.

Чому: заперечення №1 і №2. 66% учителів ОЕСР вважають, що ШІ дає хибні рекомендації (ICP S01); 35% учителів Англії, які не користуються ШІ, кажуть, що перевірка з'їсть усю економію (S07); у перевірці ChatGPT лише 19 із 60 питань мали правильний ключ (S11); учень помітив, що в тесті Copilot правильні відповіді лише B або C (S12). Промпт уже вимагає брати факти тільки з тексту і міняти позицію правильної відповіді (backend/Code.gs, QUIZ_SYSTEM_PROMPT).

## 3. Порожній стан тесту: правдоподібні неправильні варіанти

Ключ `quiz.emptySub` (app.js, index.html рядок 188).

- EN, зараз: Five questions, four options each, with a one-line explanation for every answer.
- EN, нове: Five questions, four options each: one right answer, three plausible wrong ones, and a one-line reason for the right one.
- UA, зараз: П'ять питань, по чотири варіанти, і коротке пояснення до кожної відповіді.
- UA, нове: П'ять питань, по чотири варіанти: одна правильна відповідь, три правдоподібні неправильні й пояснення в одне речення, чому правильна саме вона.

Чому: дослідження Oak (311 питань, 20 учителів) показує, що слабкі неправильні варіанти лишаються головною вадою ШІ-тестів (REFERENCES 4, 6.1). Обіцянка «правдоподібні» відрізняє нас від «ключа відповідей» у Brisk. Заодно прибирається двозначність: «пояснення до кожної відповіді» можна прочитати як пояснення до кожного варіанта, а демо зараз пояснює лише правильний.

## 4. Підзаголовок демо: без реєстрації й без збереження тексту

Ключ `demo.sub` (app.js, index.html рядок 157).

- EN, зараз: Paste a paragraph from your lesson and get a quiz in seconds.
- EN, нове: Paste a paragraph from your lesson and get a quiz in seconds. No signup, and we don't store your text.
- UA, зараз: Вставте абзац із уроку й отримайте тест за лічені секунди.
- UA, нове: Вставте абзац із уроку й отримайте тест за лічені секунди. Без реєстрації, а ваш текст ми не зберігаємо.

Чому: у Wayground, MagicSchool, Brisk, Diffit і Conker на головній немає демо, «Мрія» доступна лише школам в екосистемі (REFERENCES 6.3). Захист даних хвилює 24% учителів Англії, які не користуються ШІ (ICP S07). Обидва факти правдиві для поточного демо: backend записує лише довжину тексту.

## 5. Питання про мови: добра українська з будь-якого тексту

Ключ `faq.a3` (app.js, index.html рядок 262).

- EN, зараз: Any subject you teach from text: science, history, literature, geography and more. The demo above works in English and Ukrainian.
- EN, нове: Any subject you teach from text: history, biology, geography, literature and more. The demo writes the quiz in the language of this page, Ukrainian or English, even if your text is in the other one.
- UA, зараз: Для будь-якого предмета, де є текст: природничі науки, історія, література, географія та інші. Демо вище працює українською та англійською.
- UA, нове: Для будь-якого предмета, де є текст: історія, біологія, географія, література та інші. Демо пише тест мовою цієї сторінки, українською чи англійською, навіть якщо ваш текст іншою мовою.

Чому: жоден глобальний продукт не підтверджує українську (REFERENCES 3.7), а якість української в генераторах ніхто публічно не оцінює. Предмети в новому тексті збігаються з основним ICP (ICP 4.1). Твердження правдиве: мова тесту береться з мови сторінки (web/app.js, `quizLang = lang`). «Кращу українську, ніж у ChatGPT» не пишемо до порівняння на 10 абзацах.

## 6. Після зміни промпту: варіанти з типових помилок і пояснення до кожного

Ті самі ключі `quiz.emptySub` і `f2.d`, другий етап після правки 3.

- EN, нове `quiz.emptySub`: Five questions, four options each. Wrong options come from mistakes students typically make, and every option has its own one-line explanation.
- UA, нове `quiz.emptySub`: П'ять питань, по чотири варіанти. Неправильні варіанти побудовані на типових помилках учнів, і до кожного варіанта є своє пояснення в одне речення.
- EN, нове `f2.d`: Every question comes only from your text. Each option has a one-line reason, so you check the key at a glance and students see why their choice was wrong.
- UA, нове `f2.d`: Кожне питання береться лише з вашого тексту. До кожного варіанта є пояснення в одне речення: ви звіряєте ключ одним поглядом, а учні бачать, чому їхній вибір хибний.

Передумова: у backend/Code.gs змінити QUIZ_SYSTEM_PROMPT (правило про неправильні варіанти: будувати їх на типових помилках учнів; поле explain: пояснення до кожного варіанта), схему відповіді і показ пояснень у web/app.js, потім перевірити на 50 питаннях за рубрикою Oak. До цього лишаються правки 2 і 3.

Чому: це найсильніший розрив на ринку. Хороші дистрактори в дослідженні Oak «incorporated common misconceptions» (my.chartered.college/?p=37752); жоден знайдений лендинг прямо не обіцяє пояснення до кожного неправильного варіанта, Brisk обіцяє лише ключ, Microsoft лише розв'язок до правильної відповіді (REFERENCES 6.1).
