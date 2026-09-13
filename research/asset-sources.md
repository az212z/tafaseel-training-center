# مصادر الصور والهوية

## النسخة المقارنة V2

للنسخة الجديدة واجهة بصورتي التعلّم من أعناب، وأغلفة HTML/CSS موحدة تجمع صورة المجال واسم الدورة وشعار تفاصيل الأصلي. تبقى صور النسخة الأولى دون تغيير.

- صورة IELTS الجديدة من [صفحة التحضير للاختبار لدى EF السعودية](https://www.ef.com/saen/ils/courses/ielts-preparation/)، محفوظة محليًا باسم `v2-ielts.webp`؛ استُبدل بها الملصق الذي يحمل هوية منصة أخرى في V2 فقط.
- احتُفظ بصور دورات القدرات وSTEP والديكور من معهد القدرات ومهارات السعودية داخل نظام الأغلفة الجديد. يُعرض غلاف STEP كاملًا للحفاظ على النص الأصلي.
- باقي صور الدورات من المصادر السعودية الموضحة أدناه. الصور توضيحية، ولا توحي بأن الأشخاص أو أماكن التصوير تخص مركز تفاصيل.
- لا توجد عناوين مولدة داخل الصور؛ أسماء الدورات نصوص عربية فعلية قابلة للعرض بوضوح على جميع المقاسات، والشعار هو الأصل المرفق.

آخر تحديث: 13 سبتمبر 2026.

## الهوية الأصلية

صور الهوية الأربع التي قدمها المستخدم محفوظة كما هي في `public/brand/`. لم يتغير الشعار أو اسمه أو حجمه في تحديث صور الدورات.

## صور الدورات الحالية

استُبدلت صور الدورات الـ13 بصور مختارة من مواقع تدريب منافسة وصفحات دورات موجهة للسوق السعودي، بناءً على طلب المستخدم. جرى اختيار الصور التوضيحية والأغلفة المقروءة، واستبعاد صور المدرّبين المسمّين وملصقات المنافسين التي تحمل أسعارًا أو مواعيد أو اعتمادات.

| الدورة | الجهة وصفحة المصدر | الملف المستخدم |
| --- | --- | --- |
| القدرات العامة | [معهد القدرات](https://www.qdrat.edu.sa/Public/SubCourses/Details/qdrat-foundation) | `course-aptitude.webp` |
| التحصيلي | [أعناب](https://landing.aanaab.com/evergreen) | `course-achievement.webp` |
| الكفايات التعليمية | [أعناب](https://landing.aanaab.com/evergreen) | `course-teaching.webp` |
| تأسيس الإنجليزية | [أعناب](https://landing.aanaab.com/evergreen) | `course-english.webp` |
| STEP | [معهد القدرات](https://www.qdrat.edu.sa/Public/FrontendCourses/Details/markaz-qiyas) | `course-step.webp` |
| IELTS | [معيار النجاح](https://step.success.sa/ar) | `course-ielts.webp` |
| TOEFL | [EF السعودية](https://www.ef.com/sa/ils/courses/toefl-preparation/) | `course-toefl.webp` |
| تطوير الذات | [مهارة](https://www.maharah.net/courses/aaazbw7-20230513204541) | `course-self-development.webp` |
| التطوير المهني | [مهارة](https://www.maharah.net/courses/career-development) | `course-professional.webp` |
| الخط العربي | [معهد مسك للفنون](https://miskartinstitute.org/ar/training/art-of-saudi-calligraphy) | `course-calligraphy.webp` |
| الديكور والتصميم | [مهارات السعودية](https://saudi-skills.com/ar/courses/دورة-تأهيلية-في-التصميم-الداخلي-38) | `course-interior.webp` |
| الرسم والفن التشكيلي | [معهد مسك للفنون](https://miskartinstitute.org/ar/training/oil-painting-from-pigment-to-canvas) | `course-drawing.webp` |
| الفن الرقمي | [معهد مسك للفنون](https://miskartinstitute.org/ar/training/296-digital-painting) | `course-digital-art.webp` |

الأصول المستعملة وروابط الصور المباشرة وأبعادها وبصماتها الرقمية موثّقة في `saudi-course-images/selected.json`، والملفات الأصلية محفوظة في `saudi-course-images/selected-originals/`. الصور معروضة بوصفها صورًا توضيحية للمجالات، ولا تُنسب مواقع التصوير أو الأشخاص إلى مركز تفاصيل. حقوق الصور لأصحابها؛ توثيق المصدر لا يمثل ترخيصًا أو شراكة.

## العرض والتحسين

- تستخدم الواجهة نسخ WebP محلية محسنة دون الاعتماد على تحميل من خوادم المنافسين.
- بقي تكوين الصور الأصلي دون إعادة رسم أو إزالة شعارات أو علامات مائية.
- تعرض أغلفة STEP وIELTS كاملة باستخدام `object-fit: contain` للحفاظ على النصوص.
- تستخدم المسارات الأربعة صورًا متسقة مع الدورات المرتبطة بها.

## الصور العامة المتبقية

صورة الكتب في قسم التعريف بالمركز (`english-photo.webp`) بقيت من [Unsplash](https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8). الصور السابقة غير مستخدمة في بطاقات الدورات الحالية. أصل صورة الخط المولدة في النسخة الأولى محفوظ للرجوع فقط داخل `research/generated-artwork/`.
