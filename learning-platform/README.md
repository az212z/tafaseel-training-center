# تفاصيل: الموقع الرئيسي والمنصة التعليمية

الموقع الحي: https://tafaseel-learn.com — دخول الحسابات: https://tafaseel-learn.com/login — مركز الإدارة الموحد: https://tafaseel-learn.com/website.

# منصة تفاصيل التعليمية

منصة عربية لمركز تفاصيل للتدريب بواجهة React/TypeScript وخادم PHP وقاعدة PDO. تعمل محليًا بـSQLite، ومجهزة لـMySQL/MariaDB على Hostinger دون خادم Node في الاستضافة. إضافة مستقلة إلى موقع المركز الحالي.

## التشغيل المحلي

يتطلب Node.js 22.12+، PHP 8.3+ مع pdo_sqlite وmbstring وopenssl وfileinfo وcurl وSimpleXML وiconv، وComposer 2 وPython 3 للاختبارات.

```sh
composer install --no-dev
npm ci
npm run setup
npm start
```

افتح **http://127.0.0.1:3117/**. اختر الإدارة أو المدرب أو الطالب أو ولي الأمر في قسم التجربة المحلية. حسابات مصطنعة وبيانات محفوظة فعليًا في قاعدة محلية. حسابات التجربة لا تُضمّن في حزمة الاستضافة. لا ترفع `.local` أو `server/config.php` أو `reference`.

التشغيل المنفصل: `npm run api` و`npm run dev`. الجذر 127.0.0.1 مقصود؛ لا تُعرض التجربة على شبكة عامة. الجلسة تتطلب Origin مطابقًا، لذلك استخدم نفس العنوان دون استبداله بـlocalhost أثناء التجربة.

## التحقق والتسليم

```sh
npm run typecheck
npm run build
npm run check:php
npm test
npm run test:extensions
npm run test:preview
composer audit
npm run package
```

الأرشيف: `output/tafaseel-learning-hostinger.zip`. تفاصيل [النشر](docs/DEPLOYMENT.md)، [الحماية وحدودها](docs/SECURITY.md)، [الوظائف](docs/FEATURES.md)، [نتائج الاختبار](docs/QA.md)، [اتجاه التصميم](docs/DESIGN.md)، [تفعيل الخدمات](docs/INTEGRATIONS.md)، [السعة والتشغيل](docs/ARCHITECTURE.md).

اختبار MariaDB المحلي، باستخدام قاعدة مؤقتة مستقلة وخادم socket خاص:

```sh
TAFASEEL_TEST_MYSQL_SOCKET=/ABSOLUTE/PATH/mysql.sock npm test
```

الإصدار منشور على [الدومين الرسمي](https://tafaseel-learn.com/) بخادم PHP وقاعدة MariaDB مستقلة عن الموقع الحالي. التسجيل ينتظر مراجعة الإدارة، وتفعيل MFA مطلوب عند أول دخول للعاملين. [حالة التشغيل ونتائج الفحص الحي](docs/LAUNCH-STATUS.md). المشروع لا يحتاج بيانات طلاب المركز أو أسرار استضافته لبنائه، ولم يغير قاعدة التسجيل القائمة. بيانات الدورات والصور والشعار أُخذت من مستودعات المركز التي حددها المستخدم، والمواقع المرجعية استُخدمت لفهم نطاق الخدمة دون نسخ واجهاتها.

## عرض GitHub Pages

[افتح نسخة العرض](https://az212z.github.io/tafaseel-learning-preview/) — أربعة حسابات تجريبية وحفظ داخل المتصفح فقط. لا تستخدم بيانات حقيقية. [تفاصيل البناء والقيود](docs/GITHUB-PREVIEW.md).

## إصدار 2.0

تسجيل طلاب عام بمراجعة الإدارة، تسجيل دورات مجانية أو دفع مستضاف لدى ميسر، حقائب تعليمية، ربط زوم، طابور SMS للغياب عبر تقنيات، رفع فيديو كبير قابل للاستئناف إلى Bunny Stream، وتخزين S3 خاص للملفات المشفرة. التكاملات مكتوبة ومختبرة باستخدام بدائل محلية؛ حسابات الخدمات والمفاتيح غير موجودة، لذلك لم يُنفذ دفع أو SMS أو اجتماع خارجي حقيقي. يلزم إعدادها والتحقق الحي قبل التشغيل.

المصادقة الثنائية إلزامية للإدارة والمدربين في الإنتاج افتراضيًا. التسجيل العام ينتج حساب طالب موقوفًا حتى المراجعة. لا يستطيع المتقدم اختيار دور آخر أو رفع هويته قبل تفعيل حسابه.

## تجربة مؤقتة كاملة على GitHub

[فتح بيئة المنصة الكاملة في GitHub Codespaces](https://codespaces.new/az212z/tafaseel-training-center/tree/feat/learning-platform?devcontainer_path=.devcontainer%2Flearning-platform%2Fdevcontainer.json)

خادم PHP وقاعدة SQLite خاصة بالبيئة، ودخول بكلمات مرور فردية، وحفظ فعلي للدورات والطلاب والواجبات والاختبارات والحضور. هذه بيئة اختبار مؤقتة وليست استضافة الإنتاج أو واجهة IndexedDB. بيانات البداية مصطنعة للاختبار، والمصادقة الثنائية مطلوبة للعاملين. لا ينشر إعدادها أي شيء على Hostinger.

[التشغيل والحسابات والاستئناف والنسخ](docs/GITHUB-TRIAL.md). الرابط يفتح صفحة إنشاء/استئناف Codespace، ولا يعني أن خادمًا قد شُغّل قبل إنشائه في حسابك.
