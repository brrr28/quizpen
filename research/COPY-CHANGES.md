# Quizpen: правки текстів (20.11.2026)

Змінено лише значення рядків: розмітка, класи, ключі, логіка й CSS ті самі. Англійські рядки сторінки змінено у web/app.js (блок `en`) і так само в запасному тексті web/index.html. Правки 1-5 з research/COPY-TWEAKS.md внесено, правку 6 ні (спершу треба змінити промпт).

## Сторінка, EN (web/app.js `en` + web/index.html)

| Де | Було | Стало | Чому |
|---|---|---|---|
| meta.desc (+ meta description у index.html) | ...quiz with answers and explanations. | ...quiz with an answer key and a one-line explanation for each question. | точно: пояснення одне на питання |
| hero.sub | Quizpen turns the text you teach from into a multiple-choice quiz with answers and a short explanation for each. | Paste any text you teach from: a textbook page, your notes or an article. Quizpen writes a multiple-choice quiz from it, with an answer key and a short explanation for every question. | COPY-TWEAKS 1: будь-який текст видно на першому екрані |
| hero.try | Try it live on a lesson, no signup | Try it on your own text, no signup | «live on a lesson» читається як «під час уроку» |
| demo.sub | Paste a paragraph... in seconds. | ...in seconds. No signup, and we don't store your text. | COPY-TWEAKS 4: обидва факти правдиві (backend пише лише довжину тексту) |
| share.subject | Quizzes from our lesson texts in seconds | A quiz from any lesson text in seconds | «our lesson texts» звучить як переклад |
| demo.working | Writing your quiz, this takes a few seconds. | Writing your quiz. This takes a few seconds. | прибрано злиття двох речень через кому |
| demo.fallback | The live demo is busy, here is a sample quiz for this text. | The live demo is busy right now. Here is a ready-made quiz for this text. | те саме; «ready-made» точніше за «sample» |
| demo.fallbackOwn | The live demo is busy, here is a sample quiz on photosynthesis instead. | The live demo is busy right now. Here is a ready-made quiz on photosynthesis instead. | те саме |
| quiz.emptySub | ...with a one-line explanation for every answer. | Five questions, four options each: one correct answer, three plausible wrong ones, and a one-line reason for the correct one. | COPY-TWEAKS 3: «every answer» можна прочитати як пояснення до кожного варіанта, а демо пояснює лише правильний |
| quiz.noteLive | ...from the text you gave it. | ...from the text you pasted. | «gave it» незграбно |
| features.sub | Built around the way teachers already plan: start from the material, end with something students can answer. | Start with the material you already teach from and finish with questions your students can answer. | прибрано загальник і двокрапку-«розкриття» |
| f2.t | An answer key that explains itself | An answer key you can check at a glance | COPY-TWEAKS 2: заперечення «перевірка з'їсть час» |
| f2.d | Each question has one correct answer and a one-sentence reason. You check the key at a glance, and students see why they got it wrong. | Each correct answer comes with a one-sentence reason that points to what your text says. Its letter, A to D, is picked at random, so students can't guess a pattern. | COPY-TWEAKS 2; «тільки з вашого тексту» вже є у f1.d, тому не повторюємо; «at random» правдиве (перемішування в Code.gs) |
| proof.3 | practised | practiced | американський правопис |
| faq.a1 | We're letting teachers in small groups, in the order they joined. | We're opening access in small groups, in the order teachers joined. | «letting teachers in small groups» плутається |
| faq.a3 | Any subject you teach from text: science, history, literature, geography and more. The demo above works in English and Ukrainian. | Any subject you teach from text: history, biology, geography, literature and more. The demo writes the quiz in the language of this page, Ukrainian or English, even if your text is in the other one. | COPY-TWEAKS 5: предмети з ICP, правдиве (`quizLang = lang`) |
| faq.a4 | It's sent to an AI model only to write your quiz. Paste lesson material and leave out student names or other personal details. | It goes to an AI model only to write your quiz, and we don't store it. Paste lesson material and leave out student names and other personal details. | відповідь на питання «що з текстом» тепер повна |

## Сторінка, UA (web/app.js `uk`)

| Де | Було | Стало | Чому |
|---|---|---|---|
| meta.desc | ...тест із варіантами відповідей і поясненнями. | ...тест із ключем відповідей і коротким поясненням до кожного питання. | як в EN |
| hero.sub | Quizpen перетворює текст, за яким ви ведете урок, на тест... | Вставте будь-який текст, за яким ведете урок: параграф підручника, свій конспект чи статтю. Quizpen складе з нього тест із ключем відповідей і коротким поясненням до кожного питання. | COPY-TWEAKS 1; «параграф» і «ведете урок» замість «за яким навчаєте» |
| hero.try | Спробуйте наживо на своєму уроці, без реєстрації | Спробуйте на своєму тексті, без реєстрації | «наживо на уроці» означає під час уроку |
| share.subject | Тести з текстів наших уроків за секунди | Тест із тексту уроку за кілька секунд | калька, зайве «наших» |
| demo.sub | ...за лічені секунди. | ...за лічені секунди. Реєстрація не потрібна, і ваш текст ми не зберігаємо. | COPY-TWEAKS 4; «Без реєстрації, а ваш текст» граматично кульгає |
| demo.working | Пишемо тест, це займе кілька секунд. | Складаємо тест, зачекайте кілька секунд. | тест «складають» |
| demo.too_short | Додайте трохи тексту: демо потрібно щонайменше 200 символів. | Додайте ще тексту: для демо потрібно щонайменше 200 символів. | «демо потрібно» без прийменника неприродно |
| demo.fallback | Живе демо зараз зайняте, ось готовий тест для цього тексту. | Демо зараз перевантажене. Ось готовий тест до цього тексту. | «живе демо» і «демо зайняте» калька з live/busy |
| demo.fallbackOwn | Живе демо зараз зайняте, ось готовий приклад тесту про фотосинтез. | Демо зараз перевантажене. Ось натомість готовий тест про фотосинтез. | те саме |
| demo.failed | Живе демо зараз зайняте. Спробуйте... | Демо зараз перевантажене. Спробуйте... | те саме |
| quiz.emptySub | П'ять питань, по чотири варіанти, і коротке пояснення до кожної відповіді. | П'ять питань, по чотири варіанти: одна правильна відповідь, три правдоподібні неправильні й пояснення в одне речення, чому правильна саме вона. | COPY-TWEAKS 3 |
| quiz.noteLive | Кожне питання, варіант і пояснення створено з тексту, який ви дали. | Усі питання, варіанти й пояснення складено з тексту, який ви вставили. | узгодження і точне дієслово |
| quiz.noteSample | Цей приклад тесту підготовлено заздалегідь із тексту прикладу. | Цей тест підготовлено заздалегідь за текстом прикладу. | прибрано повтор «прикладу» |
| features.sub | Усе побудовано так, як учителі вже готуються до уроків: від матеріалу до питань... | Ви починаєте з матеріалу, за яким уже готуєтеся до уроку, і отримуєте питання, на які учні можуть відповісти. | загальник, як в EN |
| f1.t | Працює з текстом, за яким ви вже навчаєте | Працює з текстом, за яким ви вже ведете уроки | так кажуть учителі |
| f1.d | Вставте сторінку підручника... Кожне питання береться саме з цього тексту, тому тест відповідає вашому уроку. | Вставте параграф підручника... Усі питання беруться з цього тексту, тож тест збігається з вашим уроком. | шкільний термін, природніший порядок |
| f2.t | Ключ відповідей із поясненнями | Ключ, який легко звірити | COPY-TWEAKS 2 |
| f2.d | Кожне питання має одну правильну відповідь і пояснення в одне речення. Ви перевіряєте ключ одним поглядом, а учні бачать, де помилилися. | До кожної правильної відповіді є пояснення в одне речення з опорою на ваш текст. Її літеру, від А до Г, обрано випадково, тож учні не вгадають закономірність. | COPY-TWEAKS 2, як в EN |
| f3.d | ...роздрукуйте його як картку на останні десять хвилин уроку. | ...роздрукуйте для самостійної роботи на останні десять хвилин уроку. | «картка» тут калька з worksheet |
| src.3 | "Test-Enhanced Learning" | «Test-Enhanced Learning» | українські лапки |
| faq.a3 | Для будь-якого предмета, де є текст: природничі науки, історія... Демо вище працює українською та англійською. | Для будь-якого предмета, де працюють із текстом: історія, біологія, географія, література та інші. Демо складає тест мовою цієї сторінки, українською чи англійською, навіть якщо ваш текст іншою мовою. | COPY-TWEAKS 5 |
| faq.a4 | ...щоб скласти тест. Вставляйте... | ...щоб скласти тест, і ми його не зберігаємо. Вставляйте... | як в EN |

## Режим учня (web/play/play.js, web/play/share.js)

| Де | Було | Стало | Чому |
|---|---|---|---|
| play.js en.privacy | No sign-up. Nothing about you is collected: your answers are not saved or sent anywhere. | No sign-up, and nothing about you is collected. Your answers are not saved or sent anywhere. | два факти, два речення, без двокрапки |
| play.js en.hint | Tap the answer you think is right. You will see why straight away. | Tap the answer you think is correct. You'll see why right away. | американське «right away», розмовна форма |
| play.js en.right[2] | Yes, that is it. | Yes, that's it. | так кажуть уголос |
| play.js uk.stars3 | Чудова робота! | Відмінно! | калька з «Great work!» |
| play.js uk.e_broken | Можливо, частина посилання загубилася під час копіювання. Попроси учителя... | Можливо, під час копіювання частина посилання загубилася. Попроси вчителя... | милозвучність (у/в), природніший порядок |
| share.js uk.shareText | ...Без реєстрації, жодних даних про учнів ми не збираємо. | ...Реєструватися не треба, і жодних даних про учнів ми не збираємо. | два речення були злиті комою |
| share.js uk.big | Показати великим для проєктора | Показати великим на проєкторі | калька «for the projector» |

## Коротка сторінка (web/spec)

| Де | Було | Стало | Чому |
|---|---|---|---|
| spec/index.html lede | ...a short reason for each answer. | ...a short reason for each question. | пояснення одне на питання |
| spec/index.html features[2] | Every answer has a one-sentence explanation. | Every correct answer has a one-sentence explanation. | демо пояснює лише правильний варіант |
| spec.js invalid_email (2 місця) | Please enter a valid email address. | That email doesn't look right. Check it for typos. | як на основній сторінці, людською мовою |
| spec.js кнопка під час запису | Sending... | Joining… | як на основній сторінці |

## Приклади тестів (web/data/samples.json)

| Де | Було | Стало | Чому |
|---|---|---|---|
| printing, en, питання 3, варіант Г | Monks preferred its colour | Monks preferred its color | американський правопис |
| magi, text.en | a small, cheap flat in New York | a small, cheap apartment in New York | американське слово |
| printing, uk, питання 4 | Скільки приблизно примірників Біблії Гутенберга, на думку істориків, надрукували? | Скільки приблизно примірників Біблії Гутенберга надрукували, на думку істориків? | природний порядок слів |

## Пости (research/POSTS.md)

| Де | Було | Стало | Чому |
|---|---|---|---|
| вступ | Що обіцяємо в постах, тільки те, що демо вже робить: | У постах обіцяємо лише те, що демо вже робить: | рівне речення |
| пост 1 | Ідея проста: вставляєте абзац... | Вставляєте абзац... | рекламна двокрапка-«розкриття» |
| пост 3 | Я саме над цим працюю: Quizpen робить... | Над цим я зараз і працюю. Quizpen робить... | одне речення замість двох через двокрапку |
| пост 4 (r/Teachers) | It's early. What I'd like to know: could you hand this quiz to your class as it is? What would you fix first? | It's an early version. Two questions for you: could you hand this quiz to your class as is, and what would you fix first? | рівніший ритм, «as is» |

## Дослідження (research/QUIZPEN-RESEARCH-text.md і PDF)

| Де | Було | Стало | Чому |
|---|---|---|---|
| 1, «Чому зараз» | ...щотижня, заощаджують 5,9 год на тиждень [4] | ...щотижня, за власною оцінкою заощаджують 5,9 год на тиждень [4] | джерело [4]: час оцінили самі вчителі |
| 1, «Чим відрізняємось» | пояснення до відповіді | пояснення до правильної відповіді | точність: інші варіанти не пояснюються |
| 2, після таблиці | Згенерувати тест за темою вже можна безкоштовно. Розрив у трьох місцях: | Тест за темою вже можна отримати безкоштовно. Незайнятими лишаються три речі: | «розрив» калька з gap |
| 2, «Будь-який власний текст» | у глобальних продуктів українська не підтверджена в жодного | жоден глобальний продукт не підтверджує підтримку української | подвійне заперечення |
| 3, основний профіль | Учитель вирішує й платить сам: припущення. | Те, що вчитель вирішує й платить сам, поки лише припущення. | ціле речення |
| 3, заперечення 3 | Стоїмо поруч із «Мрією», а не проти неї | Обидва інструменти можна використовувати разом | конструкція «не X, а Y» |
| 4, «Варіанти, які не соромно дати класу» | ...пояснення показує, де в тексті правильна. | ...а пояснення вказує на місце в тексті, яке підтверджує правильну. | обірване речення |
| 5, пороги | Пороги: наша пропозиція для двотижневого тесту...: у двох дослідженнях орієнтирів немає. | Пороги ми задали самі для двотижневого тесту..., бо у двох дослідженнях орієнтирів конверсії немає. | дві двокрапки поспіль |
| 5, «Провал за обома конверсіями» | шукаємо в інтерв'ю справжню роботу, зокрема в репетиторів НМТ | в інтерв'ю, зокрема з репетиторами НМТ, з'ясовуємо, яку задачу люди насправді хочуть розв'язати | «справжня робота» калька з JTBD |
| 7, «Експорт у Google Forms» | Google Forms і друк: ключові формати для України, а питання 4 інтерв'ю покаже, куди ще. | Google Forms і друк вважаємо головними форматами для України; куди ще вчителі викладають тести, покаже питання 4 інтерв'ю. | без джерела, тому «вважаємо» |

PDF перезібрано з оновленого тексту, без логотипа emilus на обкладинці.
