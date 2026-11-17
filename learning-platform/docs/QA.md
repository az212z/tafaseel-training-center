# نتائج التحقق — 17 نوفمبر 2026

هذه نتائج على بيانات مصطنعة وقواعد مؤقتة مستقلة، وليست نتائج على قاعدة طلاب المركز أو استضافة Hostinger الفعلية.

| الفحص | النتيجة |
|---|---|
| TypeScript وبناء Vite للإنتاج | ناجح |
| صياغة ملفات PHP | ناجحة |
| تكامل وصلاحيات على SQLite | 51 ناجح، 0 فشل |
| الاختبارات نفسها على MariaDB محلية معزولة | 51 ناجح، 0 فشل |
| تدقيق اعتماديات npm | 0 ثغرات مبلغ عنها |
| مراجعة متصفح نسخة الإنتاج | 12 قسمًا إدارياً دون أخطاء console أو صور مكسورة أو تمرير أفقي |
| الجوال 390 × 844 | 14 صفحة دون تمرير أفقي خارج الحاويات المخصصة للجداول |

## المسارات المجربة من الواجهة

- دخول الإدارة، إنشاء دورة جديدة، العثور عليها بالبحث، فتحها، وإضافة درس نصّي وحفظه.
- دخول الطالب، بدء اختبار، اختيار إجابتين، التسليم، وظهور النتيجة 2/2 من الخادم.
- تسجيل خروج من صفحة داخلية ثم دخول بحساب مختلف؛ أُصلح انتقال المسار ليعود إلى لوحة الحساب الصحيحة.
- دخول ولي الأمر وظهور طفلين مرتبطين فقط.
- مراجعة صفحات الدورات والطلاب والواجبات والاختبارات والجدول والحضور والملفات والشهادات والتقارير والإعلانات والحسابات والإعدادات والدعم.
- عرض نسخة الإنتاج بترويسات CSP دون unsafe-inline للسكربتات ودون أخطاء JavaScript. ظهرت تحذيرات React أثناء إعادة تحميل التطوير بعد تنسيق الملفات؛ فحص نسخة الإنتاج الجديدة أعاد صفر أخطاء وتحذيرات.

أدلة المتصفح: [browser-qa.json](browser-qa.json)، [لوحة الإدارة](screenshots/dashboard.jpg)، [الجوال](screenshots/mobile.jpg). اللقطات تتضمن بيانات مصطنعة فقط.

## حالات التكامل والصلاحيات

- Unauthenticated data denied
- Demo entry disabled outside demo configuration
- CSRF required before login
- Foreign Origin rejected
- Session cookie is HttpOnly
- Session cookie is SameSite Strict
- Guardian data mandatory for minors
- Student creation accepts Arabic phone digits
- Linked guardian may read own child
- Guardian cannot read unrelated student
- Unassigned instructor cannot read child
- Duplicate enrollment denied
- Instructor cannot modify unassigned course
- Student cannot create or escalate accounts
- Instructor response excludes private identity and guardian contacts
- Lesson completion is idempotent
- Assignment submission and bounded grading; no edits after grade
- Students cannot access quiz answer key
- Resuming quiz does not create another attempt or restart timer
- Active attempt strips correct answers
- Quiz is graded on server and ignores client score
- Submitted attempt cannot be regraded by client
- Attempt quota enforced
- Attendance correction requires an audit reason
- Student cannot self-award attendance
- Certificate issued only after passing course requirements
- Incomplete learner cannot receive certificate
- Identity file accessible only to linked child or guardian and admin
- Enrolled student can download course resource
- Executable and SVG uploads rejected
- Identity and guardian phone encrypted at rest
- Uploaded files encrypted outside public root
- Guardian data endpoint excludes unrelated learners
- Private administration data omitted for guardian
- TOTP enrollment requires password and valid code
- Password alone cannot bypass enabled TOTP
- TOTP enrollment code cannot be replayed as login code
- Disabling user invalidates existing session immediately
- Logout invalidates session
- Expired quiz cannot receive client-claimed credit
- Attendance cannot be recorded early for future classes
- Capacity cannot be lowered below existing enrollments
- Learner cannot create lessons
- Video URLs require HTTPS, allowed host, and valid media ID
- Legacy dry-run leaves target unchanged
- Legacy import is idempotent
- Legacy cohorts remain separate courses
- Imported learner remains disabled until data review
- Imported minor cannot activate without birth date and consent review
- Legacy source snapshot remains byte-for-byte unchanged
- Login brute-force rate limit enforced

## حدود التحقق

- MariaDB المختبرة محليًا 13.0.2، وPHP 8.5.4. توافق الاستعلامات مع بيئة Hostinger الفعلية، SSL وLiteSpeed وإعدادات الرفع، يحتاج اختبار نشر منفصل.
- لم يُجر اختبار اختراق خارجي مستقل أو اختبار حمل متعدد المستخدمين أو فحص فيروسات للمرفقات.
- إصدار الشهادة واكتمال متطلباتها اختُبرا عبر API. تصميم الشهادة يدعم طباعة المتصفح؛ لم تُفحص طابعة فعلية أو شهادة اعتماد خارجية.
- لا تُرسل الاختبارات بريدًا أو SMS، ولا تتصل ببوابة دفع أو تنقل بيانات الطلاب إلى خدمة خارجية.
- استيراد النظام السابق اختُبر بنسخة مصطنعة، مع تحقق منع التكرار وبقاء كل دفعة مستقلة وثبات ملف المصدر. لم تُستخدم قاعدة المركز الحقيقية.

## بيئة التطوير المحلية

أثناء تجهيز MariaDB، أزالت عملية تنظيف Homebrew مكتبة قديمة كان يعتمد عليها Node. أُصلح Node بإعادة تثبيته إلى 26.13.1، والتحقق من npm 11.20.0 وPHP 8.5.4. أُوقف توسيع التثبيت قبل تثبيت تحديثات PHP أو أدوات أخرى غير لازمة. خادم MariaDB للاختبار يعمل عبر socket محلي فقط، ويُوقف بعد الاختبارات.

## عرض GitHub Pages — 17 نوفمبر 2026

- 30 فحصًا آليًا لمسارات العمل عبر IndexedDB تجريبية مستقلة: الحسابات، الدورات والسعة، ملفات الموارد، تعطيل الهوية، واجبات وتقييم، محاكاة اختبار ومحاولات، حضور وشهادات، ولي الأمر، وإعادة البيانات.
- من المتصفح: إنشاء دورة ودرس ثم التحديث وبقاء الإضافات، تسليم الطالب ثم تقييم المدرب 19/20، نتيجة اختبار تجريبي 2/2، ظهور طفلين مرتبطين لولي الأمر، رفع صورة عامة ثم التحديث وبقاء رابط Blob، وإعادة البيانات.
- 14 صفحة مكتبية و14 صفحة جوال 390×844 دون تمرير أفقي أو صور مكسورة، وصفر أخطاء أو تحذيرات في console خلال فحص البناء. تنبيه الحفظ المحلي ظاهر على الجوال.
- أُعيدت اختبارات PHP/SQLite: 51 ناجحًا، وصياغة PHP وبناء الإنتاج وحزمة Hostinger ناجحة.
- هذا فحص لعرض محلي ببيانات مصطنعة، وليس إثباتًا لأمان GitHub Pages كخادم أو جاهزية استضافة المركز.
