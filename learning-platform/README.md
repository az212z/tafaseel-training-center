# منصة تفاصيل التعليمية

منصة عربية لمركز تفاصيل للتدريب بواجهة React/TypeScript وخادم PHP وقاعدة PDO. تعمل محليًا بـSQLite، ومجهزة لـMySQL/MariaDB على Hostinger دون خادم Node في الاستضافة. إضافة مستقلة إلى موقع المركز الحالي.

## التشغيل المحلي

يتطلب Node.js 22.12+، PHP 8.3+ مع pdo_sqlite وmbstring وopenssl وfileinfo، وPython 3 للاختبارات.

```sh
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
npm run package
```

الأرشيف: `output/tafaseel-learning-hostinger.zip`. تفاصيل [النشر](docs/DEPLOYMENT.md)، [الحماية وحدودها](docs/SECURITY.md)، [الوظائف](docs/FEATURES.md)، [نتائج الاختبار](docs/QA.md)، [اتجاه التصميم](docs/DESIGN.md).

اختبار MariaDB المحلي، باستخدام قاعدة مؤقتة مستقلة وخادم socket خاص:

```sh
TAFASEEL_TEST_MYSQL_SOCKET=/ABSOLUTE/PATH/mysql.sock npm test
```

المشروع لا يحتاج بيانات طلاب المركز أو أسرار استضافته لبنائه. لم يُنشر هذا الإصدار على Hostinger، ولم يغير قاعدة التسجيل القائمة. بيانات الدورات والصور والشعار أُخذت من مستودعات المركز التي حددها المستخدم، والمواقع المرجعية استُخدمت لفهم نطاق الخدمة دون نسخ واجهاتها.

## عرض GitHub Pages

[افتح نسخة العرض](https://az212z.github.io/tafaseel-learning-preview/) — أربعة حسابات تجريبية وحفظ داخل المتصفح فقط. لا تستخدم بيانات حقيقية. [تفاصيل البناء والقيود](docs/GITHUB-PREVIEW.md).
