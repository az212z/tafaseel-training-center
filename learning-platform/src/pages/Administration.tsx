import { isStaticPreview } from "../environment";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  Megaphone,
  ShieldCheck,
  LockKey,
  Key,
  CheckCircle,
  Clock,
  DownloadSimple,
  Question,
  Envelope,
  ArrowLeft,
  WarningCircle,
  UsersThree,
  FolderLock,
} from "@phosphor-icons/react";
import { useApp, date, downloadCsv, roles } from "../context";
import { api } from "../api";
import type { Support } from "../types";
import {
  PageHead,
  Panel,
  Empty,
  Button,
  Badge,
  Modal,
  Form,
  Field,
  Table,
  Status,
} from "../components/ui";
import { CourseSelect } from "../components/forms";
export function Announcements() {
  const { data, user, refresh, notify } = useApp();
  const [add, setAdd] = useState(false);
  const [course, setCourse] = useState("");
  const staff = ["admin", "instructor"].includes(user.role);
  const items = data.announcements.filter(
    (a) => !course || a.course_id === course || !a.course_id,
  );
  return (
    <>
      <PageHead
        title="إعلانات المركز"
        subtitle="تواصل واضح، يبقي الجميع على اطلاع."
      >
        {staff && (
          <Link className="btn btn-secondary" to="/communications">
            بث رسالة بريدية
            <Envelope size={18} />
          </Link>
        )}
        {staff && (
          <Button onClick={() => setAdd(true)}>
            <Plus size={18} />
            إضافة إعلان
          </Button>
        )}
      </PageHead>
      <div className="filter-bar">
        <select
          aria-label="تصفية الإعلانات"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">جميع الإعلانات</option>
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="announcements-grid">
        {items.map((a) => (
          <Panel key={a.id}>
            <div className="announcement-heading">
              <span className="update-icon">
                <Megaphone size={24} weight="duotone" />
              </span>
              <Badge tone={a.course_id ? "blue" : "green"}>
                {a.course_id
                  ? data.courses.find((c) => c.id === a.course_id)?.title
                  : "إعلان عام"}
              </Badge>
              <span>{date(a.created_at)}</span>
            </div>
            <h2>{a.title}</h2>
            <p className="announcement-body">{a.body}</p>
            <div className="announcement-author">
              <UsersThree size={17} />
              {a.author_name}
            </div>
          </Panel>
        ))}
      </div>
      {!items.length && (
        <Empty
          title="لا توجد إعلانات"
          text="أخبار المركز وتحديثات الدورات تظهر هنا."
        />
      )}
      {add && (
        <Modal title="نشر إعلان جديد" onClose={() => setAdd(false)}>
          <Form
            submitLabel="نشر الإعلان داخل المنصة"
            onCancel={() => setAdd(false)}
            onSubmit={async (d) => {
              await api("announcement.save", {
                ...d,
                course_id: d.course_id || null,
              });
              await refresh();
              notify("تم نشر الإعلان داخل المنصة.");
              setAdd(false);
            }}
          >
            <Field label="الجمهور">
              <CourseSelect optional={user.role === "admin"} />
            </Field>
            <Field label="عنوان الإعلان">
              <input name="title" required maxLength={200} />
            </Field>
            <Field label="نص الإعلان">
              <textarea name="body" required rows={6} maxLength={5000} />
            </Field>
            <div className="alert">
              يظهر الإعلان داخل حسابات الطلاب المعنيين. لا يرسل رسائل SMS أو
              بريدًا إلكترونيًا.
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}
const auditNames: Record<string, string> = {
  "session.login": "تسجيل دخول",
  "session.logout": "تسجيل خروج",
  "session.denied": "محاولة دخول مرفوضة",
  "student.private_view": "عرض بيانات طالب خاصة",
  "password.changed": "تغيير كلمة المرور",
  "website.updated": "تحديث محتوى الموقع",
  "website.inquiries_viewed": "عرض طلبات الموقع",
  "website.inquiry_updated": "متابعة طلب من الموقع",
  "mfa.enabled": "تفعيل المصادقة الثنائية",
  "mfa.recovered": "استعادة المصادقة من أداة الاستضافة",
  "legacy.imported": "استيراد نسخة مراجعة للنظام السابق",
  "user.created": "إنشاء حساب",
  "user.updated": "تعديل حساب",
  "account.profile_updated": "تعديل بيانات حساب الإدارة",
  "account.credentials_changed":
    "تغيير بيانات دخول الإدارة وإبطال الجلسات السابقة",
  "user.status_changed": "تغيير حالة حساب",
  "course.created": "إنشاء دورة",
  "course.updated": "تعديل دورة",
  "student.enrolled": "تسجيل طالب في دورة",
  "lesson.saved": "حفظ درس",
  "assignment.created": "إضافة واجب",
  "assignment.submitted": "تسليم واجب",
  "submission.graded": "تقييم واجب",
  "quiz.created": "إنشاء اختبار",
  "quiz.started": "بدء اختبار",
  "quiz.submitted": "تسليم اختبار",
  "class.created": "جدولة حصة",
  "attendance.saved": "حفظ سجل حضور",
  "file.uploaded": "رفع ملف",
  "file.downloaded": "تنزيل ملف",
  "certificate.issued": "إصدار شهادة",
  "announcement.created": "نشر إعلان",
  "settings.saved": "حفظ الإعدادات",
  "support.created": "إنشاء طلب دعم",
  "support.replied": "الرد على طلب دعم",
  "demo.initialized": "تهيئة التجربة المحلية",
};
export function Settings() {
  const { data, user, notify, refresh } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "profile";
  const [secret, setSecret] = useState("");
  const [mfa, setMfa] = useState(false);
  const admin = user.role === "admin";
  const staff = ["admin", "instructor"].includes(user.role);
  const tabs = [
    ["profile", "الحساب الشخصي"],
    ["security", "الأمان"],
    ...(admin
      ? [
          ["general", "إعدادات المركز"],
          ["audit", "سجل العمليات"],
        ]
      : []),
  ];
  return (
    <>
      <PageHead
        title="الإعدادات والأمان"
        subtitle="منصة تناسب احتياجك، وحماية تهتم بخصوصيتك."
      />
      <div className="tabs" role="tablist" aria-label="أقسام الإعدادات">
        {tabs.map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => setParams({ tab: key })}
            key={key}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "profile" && (
        <div className="settings-grid">
          <Panel title="حسابك في تفاصيل">
            <dl className="details-list">
              <div>
                <dt>الاسم</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>البريد الإلكتروني</dt>
                <dd dir="ltr">{user.email}</dd>
              </div>
              {user.username && (
                <div>
                  <dt>اسم المستخدم</dt>
                  <dd dir="ltr">{user.username}</dd>
                </div>
              )}
              <div>
                <dt>نوع الحساب</dt>
                <dd>
                  <Badge tone="green">{roles[user.role]}</Badge>
                </dd>
              </div>
              <div>
                <dt>حالة الحساب</dt>
                <dd>نشط</dd>
              </div>
            </dl>
            {user.role === "student" && (
              <Link className="btn btn-secondary" to={`/students/${user.id}`}>
                عرض ملفي التدريبي
                <ArrowLeft size={18} />
              </Link>
            )}
            {admin && !isStaticPreview ? (
              <Form
                key={`${user.name}:${user.email}`}
                submitLabel="حفظ بيانات الإدارة"
                onSubmit={async (d) => {
                  await api("account.profile", d);
                  await refresh();
                  notify("تم تحديث اسمك وبريد الدخول.");
                }}
              >
                <Field label="اسم مدير المنصة">
                  <input
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={user.name}
                  />
                </Field>
                <Field label="بريد الدخول للإدارة">
                  <input
                    name="email"
                    type="email"
                    dir="ltr"
                    required
                    defaultValue={user.email}
                    autoComplete="username"
                  />
                </Field>
                <Field label="كلمة المرور الحالية لتأكيد التعديل">
                  <input
                    name="current"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </Field>
              </Form>
            ) : (
              <p className="muted">
                لتعديل بياناتك الأساسية، تواصل مع إدارة المركز.
              </p>
            )}
          </Panel>
          {isStaticPreview ? (
            <Panel title="حساب عرض تجريبي">
              <p>
                يمكنك التبديل بين الحسابات من الشريط العلوي. كلمات المرور
                والمصادقة الثنائية تتطلبان النسخة التي تعمل على خادم، ولا
                تستخدمان هنا.
              </p>
            </Panel>
          ) : (
            <>
              <Panel
                title="تغيير كلمة المرور"
                description="اختر عبارة طويلة لا تستخدمها في حساب آخر."
              >
                <Form
                  submitLabel="تغيير كلمة المرور"
                  onSubmit={async (d) => {
                    await api("password", d);
                    notify("تم تغيير كلمة المرور وإبطال الجلسات الأخرى.");
                  }}
                >
                  <Field label="كلمة المرور الحالية">
                    <input
                      type="password"
                      name="current"
                      required
                      autoComplete="current-password"
                    />
                  </Field>
                  <Field
                    label="كلمة المرور الجديدة"
                    hint="١٢ حرفًا على الأقل، وحد أقصى ٧٢ بايت."
                  >
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={12}
                      maxLength={72}
                      autoComplete="new-password"
                    />
                  </Field>
                </Form>
              </Panel>
            </>
          )}
        </div>
      )}
      {tab === "general" && admin && (
        <Panel title="معلومات المركز">
          <Form
            submitLabel="حفظ إعدادات المركز"
            onSubmit={async (d) => {
              await api("settings.save", {
                ...d,
                certificate_attendance: Number(d.certificate_attendance),
              });
              await refresh();
              notify("تم حفظ إعدادات المركز.");
            }}
          >
            <div className="form-grid">
              <Field label="اسم المركز">
                <input name="name" required defaultValue={data.settings.name} />
              </Field>
              <Field label="البريد الإداري">
                <input
                  type="email"
                  name="email"
                  required
                  dir="ltr"
                  defaultValue={data.settings.email}
                />
              </Field>
              <Field label="جوال التواصل">
                <input
                  type="tel"
                  name="phone"
                  required
                  dir="ltr"
                  defaultValue={data.settings.phone}
                />
              </Field>
              <Field label="نسبة الحضور المطلوبة للشهادة">
                <input
                  type="number"
                  name="certificate_attendance"
                  min={0}
                  max={100}
                  required
                  defaultValue={data.settings.certificate_attendance}
                />
              </Field>
            </div>
          </Form>
        </Panel>
      )}
      {tab === "security" && isStaticPreview && (
        <Panel title="الأمان في نسخة العرض">
          <div className="alert">
            <WarningCircle size={22} />
            هذا عرض عام يعمل داخل المتصفح. الحسابات والصلاحيات والتصحيح محاكاة،
            والتخزين المحلي غير مشفّر.
          </div>
          <p>
            استخدم أسماء وبيانات وملفات وهمية فقط. إدخال أرقام الهوية ورفع
            مرفقاتها معطّلان. المصادقة الحقيقية وحماية البيانات تُختبران على
            استضافة المركز قبل التشغيل الفعلي.
          </p>
        </Panel>
      )}
      {tab === "security" && !isStaticPreview && (
        <>
          <div className="security-overview">
            <ShieldCheck size={44} weight="duotone" />
            <div>
              <h2>حماية تبدأ من كل تفصيلة</h2>
              <p>
                {admin
                  ? "صلاحيات من الخادم، بيانات خاصة مشفرة، وسجل للعمليات المهمة."
                  : "تحكّم في أمان حسابك واحفظ بيانات دخولك بشكل خاص."}
              </p>
            </div>
            {admin && (
              <Badge tone={data.demo ? "amber" : "green"}>
                {data.demo ? "بيئة محلية" : "بيئة تشغيل"}
              </Badge>
            )}
          </div>
          <div className="settings-grid">
            <Panel
              title={
                data.mfa_available === false
                  ? "طريقة تسجيل الدخول"
                  : "المصادقة الثنائية"
              }
              description={
                data.mfa_available === false
                  ? "تسجيل الدخول باسم المستخدم أو البريد وكلمة المرور."
                  : "طبقة تحقق إضافية من تطبيق المصادقة على جوالك."
              }
            >
              <div className="mfa-status">
                <span className="security-icon">
                  <Key size={28} />
                </span>
                <div>
                  <h3>
                    {data.mfa
                      ? "المصادقة الثنائية مفعّلة"
                      : staff && data.mfa_available !== false
                        ? "عزّز حماية حسابك"
                        : "تسجيل الدخول بكلمة المرور"}
                  </h3>
                  <p>
                    {data.mfa
                      ? "يُطلب رمز عند كل تسجيل دخول."
                      : staff && data.mfa_available !== false
                        ? "فعّل الرمز المتغير لحماية حسابك الإداري."
                        : "استعمل كلمة مرور طويلة واحفظها بشكل خاص."}
                  </p>
                </div>
              </div>
              {staff && data.mfa_available !== false && !data.mfa && (
                <Button
                  onClick={() => {
                    setSecret("");
                    setMfa(true);
                  }}
                >
                  <ShieldCheck size={18} />
                  تفعيل المصادقة الثنائية
                </Button>
              )}
              {data.mfa && (
                <div className="alert">
                  <CheckCircle size={20} />
                  مفعّلة. استعادة الوصول تتم بواسطة مسؤول الاستضافة من أداة
                  الإدارة الخاصة.
                </div>
              )}
            </Panel>
            <Panel title="سياسة الجلسات والوصول">
              <div className="security-list">
                <p>
                  <CheckCircle size={20} />
                  <span>انتهاء الجلسة بعد ٣٠ دقيقة من الخمول.</span>
                </p>
                <p>
                  <CheckCircle size={20} />
                  <span>الحد الأقصى للجلسة ٨ ساعات.</span>
                </p>
                <p>
                  <CheckCircle size={20} />
                  <span>
                    إبطال الجلسات عند إيقاف الحساب أو تغيير كلمة المرور.
                  </span>
                </p>
                <p>
                  <CheckCircle size={20} />
                  <span>ولي الأمر يرى أبناءه المرتبطين فقط.</span>
                </p>
              </div>
            </Panel>
            <Panel title="خصوصية ملفات الطلاب">
              <div className="security-list">
                <p>
                  <FolderLock size={21} />
                  <span>
                    أرقام الهوية والجوالات ومرفقات الطلاب مشفرة أثناء التخزين.
                  </span>
                </p>
                <p>
                  <LockKey size={21} />
                  <span>مرفقات الهوية لا تظهر للمدربين.</span>
                </p>
                <p>
                  <Clock size={21} />
                  <span>عمليات عرض البيانات الخاصة وتنزيل الملفات تُسجّل.</span>
                </p>
              </div>
            </Panel>
            {admin && (
              <Panel title="قبل التشغيل الفعلي">
                <div className="security-list">
                  <p>
                    <WarningCircle size={20} />
                    <span>
                      تفعيل HTTPS والتحقق من النسخ الاحتياطية والاستعادة.
                    </span>
                  </p>
                  <p>
                    <WarningCircle size={20} />
                    <span>
                      مراجعة الأذونات والخصوصية وفترة الاحتفاظ ببيانات الطلاب.
                    </span>
                  </p>
                  <p>
                    <WarningCircle size={20} />
                    <span>
                      اختبار الربط على استضافة المركز وفحص الملفات المرفوعة.
                    </span>
                  </p>
                </div>
              </Panel>
            )}
          </div>
        </>
      )}
      {tab === "audit" && admin && (
        <Panel
          title="سجل العمليات"
          description="آخر ٢٠٠ عملية. لا تُسجل كلمات المرور أو محتويات الهوية."
          action={
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  "audit.csv",
                  ["العملية", "المسؤول", "التاريخ"],
                  (data.audit ?? []).map((a) => [
                    auditNames[a.action] ?? a.action,
                    a.actor_name ?? "غير مسجل",
                    a.created_at,
                  ]),
                )
              }
            >
              <DownloadSimple size={18} />
              تصدير السجل
            </Button>
          }
        >
          <Table headers={["العملية", "المسؤول", "التاريخ والوقت"]}>
            {data.audit?.map((a) => (
              <tr key={a.id}>
                <td>{auditNames[a.action] ?? a.action}</td>
                <td>{a.actor_name ?? "زائر / غير مسجل"}</td>
                <td>
                  {date(a.created_at, {
                    day: "numeric",
                    month: "long",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
      {mfa && (
        <Modal title="تفعيل المصادقة الثنائية" onClose={() => setMfa(false)}>
          {!secret ? (
            <Form
              submitLabel="إنشاء مفتاح التفعيل"
              onSubmit={async (d) => {
                const r = await api<{ secret: string }>("mfa.begin", d);
                setSecret(r.secret);
              }}
            >
              <p>
                أكّد كلمة مرورك لإنشاء مفتاح ربط بتطبيق مثل Google Authenticator
                أو Microsoft Authenticator.
              </p>
              <Field label="كلمة المرور الحالية">
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                />
              </Field>
            </Form>
          ) : (
            <Form
              submitLabel="تأكيد التفعيل"
              onSubmit={async (d) => {
                await api("mfa.confirm", d);
                await refresh();
                setMfa(false);
                setSecret("");
                notify("تم تفعيل المصادقة الثنائية.");
              }}
            >
              <p>
                أضف حسابًا في تطبيق المصادقة بخيار «إدخال مفتاح الإعداد». اختر
                نوع الرمز «مستند إلى الوقت».
              </p>
              <Field
                label="المفتاح الخاص"
                hint="احفظه بشكل خاص قبل المتابعة، لاستعادة وصولك عند فقدان الجوال."
              >
                <input readOnly dir="ltr" value={secret} />
              </Field>
              <Field label="رمز التحقق من التطبيق">
                <input
                  name="code"
                  inputMode="numeric"
                  required
                  minLength={6}
                  maxLength={6}
                  autoComplete="one-time-code"
                  dir="ltr"
                />
              </Field>
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
export function SupportPage() {
  const { data, user, refresh, notify } = useApp();
  const [add, setAdd] = useState(false);
  const [reply, setReply] = useState<Support | null>(null);
  const [faq, setFaq] = useState<number | null>(0);
  const faqs = [
    [
      "كيف أسجّل في دورة؟",
      "تضيف إدارة المركز حسابك إلى الدورة بعد تأكيد التسجيل. ستظهر الدورة في مساحتك فور تسجيلك فيها.",
    ],
    [
      "كيف أسلّم واجبي؟",
      "افتح صفحة الواجبات، ثم اختر الواجب. اكتب الإجابة أو أرفق ملفًا، واضغط تسليم الواجب قبل الموعد. يمكنك تعديله قبل التقييم ما دام الموعد مفتوحًا.",
    ],
    [
      "كيف أحصل على الشهادة؟",
      "أكمل دروس الدورة، واجتز واجباتها واختباراتها، وحقق نسبة الحضور المطلوبة. تصدر الإدارة شهادة الإتمام من المنصة بعد تحقق المتطلبات.",
    ],
    [
      "من يمكنه رؤية بيانات الطالب؟",
      "الإدارة والطالب وولي الأمر المرتبط يستطيعون رؤية بيانات الطالب الخاصة. يرى المدرب تقدم الطلاب المسجلين في دوراته، دون أرقام الهوية أو مرفقاتها.",
    ],
    [
      "هل تُرسل تنبيهات الغياب إلى الجوال؟",
      "تُجدول رسالة SMS عند تسجيل الغياب إذا فُعّلت الخدمة ووُثقت موافقة ولي الأمر. تتابع الإدارة حالتها من رسائل الغياب. نسخة GitHub للعرض لا ترسل رسائل.",
    ],
  ];
  return (
    <>
      <PageHead title="المساعدة والدعم" subtitle="كل سؤال، بداية لفهم أوضح.">
        <Button onClick={() => setAdd(true)}>
          <Plus size={18} />
          طلب مساعدة
        </Button>
      </PageHead>
      <div className="support-intro">
        <span>
          <Question size={42} weight="duotone" />
        </span>
        <div>
          <h2>نحن هنا لنساعدك في كل خطوة</h2>
          <p>تصفح الإجابات أو أرسل طلبك لفريق إدارة المنصة.</p>
        </div>
      </div>
      <div className="settings-grid">
        <Panel title="أسئلة شائعة">
          <div className="faq-list">
            {faqs.map(([q, a], i) => (
              <div key={q}>
                <button
                  aria-expanded={faq === i}
                  onClick={() => setFaq(faq === i ? null : i)}
                >
                  {q}
                  <Plus size={18} />
                </button>
                {faq === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title={
            user.role === "admin" ? "طلبات الدعم" : "طلبات المساعدة الخاصة بي"
          }
        >
          {data.support.length ? (
            data.support.map((s) => (
              <div className="support-ticket" key={s.id}>
                <div className="row-between">
                  <h3>{s.subject}</h3>
                  <Status value={s.status} />
                </div>
                <p>{s.body}</p>
                <small>
                  {s.name} • {date(s.created_at)}
                </small>
                {s.reply && (
                  <div className="support-reply">
                    <strong>رد إدارة المركز</strong>
                    <p>{s.reply}</p>
                  </div>
                )}
                {user.role === "admin" && (
                  <button className="text-link" onClick={() => setReply(s)}>
                    <Envelope size={17} />
                    الرد على الطلب
                  </button>
                )}
              </div>
            ))
          ) : (
            <Empty
              title="لا توجد طلبات دعم"
              text="عند الحاجة، أرسل طلبًا وستجد الرد في هذه المساحة."
            />
          )}
        </Panel>
      </div>
      {add && (
        <Modal title="طلب مساعدة" onClose={() => setAdd(false)}>
          <Form
            submitLabel="إرسال الطلب لإدارة المنصة"
            onCancel={() => setAdd(false)}
            onSubmit={async (d) => {
              await api("support.save", d);
              await refresh();
              notify("تم حفظ طلبك في صندوق دعم المركز.");
              setAdd(false);
            }}
          >
            <Field label="موضوع الطلب">
              <input name="subject" required maxLength={200} />
            </Field>
            <Field label="كيف يمكننا مساعدتك؟">
              <textarea name="body" required rows={6} maxLength={5000} />
            </Field>
            <div className="alert">
              لا تضع كلمات مرور أو صور هوية في طلب الدعم.
            </div>
          </Form>
        </Modal>
      )}
      {reply && (
        <Modal title={`الرد: ${reply.subject}`} onClose={() => setReply(null)}>
          <p>{reply.body}</p>
          <Form
            submitLabel="حفظ الرد وإغلاق الطلب"
            onCancel={() => setReply(null)}
            onSubmit={async (d) => {
              await api("support.reply", { id: reply.id, reply: d.reply });
              await refresh();
              notify("تم حفظ الرد وإتاحته لصاحب الطلب.");
              setReply(null);
            }}
          >
            <Field label="الرد على صاحب الطلب">
              <textarea
                name="reply"
                required
                rows={6}
                defaultValue={reply.reply ?? ""}
              />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
