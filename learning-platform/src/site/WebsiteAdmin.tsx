import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowSquareOut,
  CheckCircle,
  Globe,
  Envelope,
  Plus,
  ArrowLeft,
  BookOpen,
  UsersThree,
  Wallet,
  CalendarBlank,
  Certificate,
  GearSix,
  ChartBar,
  ChalkboardTeacher,
  DownloadSimple,
} from "@phosphor-icons/react";
import { api, get } from "../api";
import { useApp, date, downloadCsv } from "../context";
import {
  PageHead,
  Panel,
  Button,
  Empty,
  Badge,
  Field,
  Form,
  Modal,
} from "../components/ui";
import type { SiteContent, SiteProgram, SiteArticle } from "./types";
import { isStaticPreview } from "../environment";
import defaults from "./defaults.json";
import "./admin.css";
interface InquiryItem {
  id: string;
  reference: string;
  kind: string;
  program_slug: string;
  status: string;
  created_at: string;
  details: {
    name: string;
    phone: string;
    email: string;
    organization: string;
    message: string;
  };
}
const labels: Record<string, string> = {
  name: "اسم المركز",
  tagline: "عبارة الهوية",
  hero_title: "عنوان الرئيسية (سطر لكل عبارة)",
  hero_description: "مقدمة الرئيسية",
  about: "نبذة المركز",
  phone: "رقم الاتصال",
  whatsapp: "رقم واتساب الدولي",
  email: "البريد العام (اختياري)",
  address: "عنوان المركز (اختياري)",
  hours: "مواعيد التواصل والزيارة",
  announcement: "الشريط العلوي (اختياري)",
  business_description: "نبذة خدمات الجهات",
};
const kindLabels: Record<string, string> = {
  contact: "تواصل عام",
  program: "اهتمام بدورة",
  business: "تدريب جهة",
  trainer: "تعاون مدرب",
};
const stateLabels: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  closed: "مغلق",
};
export default function WebsiteAdmin() {
  const { data, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [content, setContent] = useState<SiteContent | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [program, setProgram] = useState("");
  const [article, setArticle] = useState("");
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [inquiryError, setInquiryError] = useState("");
  const [newCount, setNewCount] = useState(0);
  const [creating, setCreating] = useState<"program" | "article" | null>(null);
  const [pageKey, setPageKey] = useState("privacy");
  const [inquiryLoading, setInquiryLoading] = useState(true);
  async function load() {
    try {
      if (isStaticPreview) {
        setContent({ ...defaults, revision: 1 });
        return;
      }
      setContent(await api<SiteContent>("website.admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function loadInquiries() {
    if (isStaticPreview) {
      setInquiryLoading(false);
      return;
    }
    setInquiryLoading(true);
    try {
      const r = await get<{ items: InquiryItem[]; total: number }>(
        "website.inquiries",
        { page: String(page), status: filter },
      );
      setInquiries(r.items);
      setTotal(r.total);
      setInquiryError("");
    } catch (e) {
      setInquiryError((e as Error).message);
    } finally {
      setInquiryLoading(false);
    }
  }
  useEffect(() => {
    void load();
    if (!isStaticPreview)
      get<{ total: number }>("website.inquiries", { status: "new" })
        .then((r) => setNewCount(r.total))
        .catch(() => {});
  }, []);
  useEffect(() => {
    if (tab === "inquiries") void loadInquiries();
  }, [tab, page, filter]);
  async function save(section: string, value: object, extra: object = {}) {
    setBusy(true);
    try {
      if (isStaticPreview)
        throw new Error("إدارة المحتوى متاحة على الموقع الرئيسي.");
      await api("website.save", {
        section,
        value,
        revision: content?.revision,
        ...extra,
      });
      await load();
      notify("حُفظ المحتوى ونُشر في الموقع.");
    } catch (e) {
      notify((e as Error).message, "error");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <>
        <PageHead title="الموقع ومركز الإدارة" />
        <Panel>
          <p role="alert">{error}</p>
          <Button type="button" onClick={load}>
            إعادة المحاولة
          </Button>
        </Panel>
      </>
    );
  if (!content) return <PageHead title="جارٍ تجهيز مركز الإدارة…" />;
  const p =
    content.programs.find((p) => p.slug === program) || content.programs[0];
  const a =
    content.articles.find((a) => a.id === article) || content.articles[0];
  const pending =
    data.users?.filter((u) => u.role === "student" && !u.active).length || 0;
  return (
    <>
      <PageHead
        title="الموقع ومركز الإدارة"
        subtitle="أعمال المركز ومحتوى الموقع وطلبات الزوار، من مكان واحد."
      >
        <a
          className="btn btn-secondary"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
        >
          عرض الموقع <ArrowSquareOut size={18} />
        </a>
      </PageHead>
      <div
        className="tabs website-tabs"
        role="navigation"
        aria-label="أقسام إدارة الموقع"
      >
        {[
          ["overview", "مركز الإدارة"],
          ["site", "محتوى الموقع"],
          ["programs", "دليل الدورات"],
          ["library", "المكتبة"],
          ["faq", "الأسئلة الشائعة"],
          ["pages", "السياسات والصفحات"],
          ["inquiries", `طلبات الموقع${newCount ? " (" + newCount + ")" : ""}`],
        ].map(([key, title]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setParams({ tab: key })}
          >
            {title}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="website-admin-metrics">
            <Link to="/users">
              <span>حسابات تنتظر المراجعة</span>
              <strong>{pending.toLocaleString("ar-SA")}</strong>
              <small>راجع البيانات ثم قرر التفعيل</small>
            </Link>
            <button onClick={() => setParams({ tab: "inquiries" })}>
              <span>طلبات موقع جديدة</span>
              <strong>{newCount.toLocaleString("ar-SA")}</strong>
              <small>تواصل واهتمامات وجهات ومدربون</small>
            </button>
            <Link to="/courses">
              <span>الدورات المنشورة</span>
              <strong>
                {data.courses
                  .filter((c) => c.status === "published")
                  .length.toLocaleString("ar-SA")}
              </strong>
              <small>
                من {data.courses.length.toLocaleString("ar-SA")} دورة تعليمية
              </small>
            </Link>
            <button onClick={() => setParams({ tab: "programs" })}>
              <span>البرامج الظاهرة للزوار</span>
              <strong>
                {content.programs
                  .filter((p) => p.visible)
                  .length.toLocaleString("ar-SA")}
              </strong>
              <small>تحكم في الظهور وربط الدفعة</small>
            </button>
          </div>
          <div className="website-admin-groups">
            {[
              {
                title: "التسجيل والعلاقة بالمتدرب",
                links: [
                  [
                    "/users",
                    "الحسابات وطلبات التسجيل",
                    "مراجعة الطلاب، التفعيل والصلاحيات",
                    UsersThree,
                  ],
                  [
                    "/students",
                    "ملفات الطلاب",
                    "البيانات والارتباط بولي الأمر",
                    UsersThree,
                  ],
                  [
                    "/payments",
                    "الرسوم وطلبات الدفع",
                    "الحالات والمبالغ والبحث والتصدير",
                    Wallet,
                  ],
                  [
                    "/support",
                    "الدعم والمتابعة",
                    "متابعة تذاكر أصحاب الحسابات",
                    Envelope,
                  ],
                ],
              },
              {
                title: "تشغيل التدريب",
                links: [
                  [
                    "/courses",
                    "الدورات والمحتوى",
                    "أنشئ الدفعة وانشرها وحدد التسجيل",
                    BookOpen,
                  ],
                  [
                    "/schedule",
                    "الجدول والحصص",
                    "المواعيد والروابط والجلسات",
                    CalendarBlank,
                  ],
                  [
                    "/attendance",
                    "الحضور والغياب",
                    "رصد الحضور ومراجعة السجلات",
                    CheckCircle,
                  ],
                  [
                    "/assignments",
                    "الواجبات",
                    "التكليفات والتسليم والتصحيح",
                    ChalkboardTeacher,
                  ],
                  [
                    "/quizzes",
                    "الاختبارات",
                    "الأسئلة والمحاولات والنتائج",
                    BookOpen,
                  ],
                  [
                    "/certificates",
                    "الشهادات",
                    "الاستحقاق والإصدار",
                    Certificate,
                  ],
                ],
              },
              {
                title: "المتابعة وإدارة المركز",
                links: [
                  [
                    "/reports",
                    "التقارير",
                    "نتائج التدريب ومؤشرات المتابعة",
                    ChartBar,
                  ],
                  [
                    "/announcements",
                    "الإعلانات",
                    "مستجدات المركز والدورات",
                    Envelope,
                  ],
                  [
                    "/integrations",
                    "الخدمات والتشغيل",
                    "حالة الدفع والرسائل والفيديو وزوم",
                    GearSix,
                  ],
                  [
                    "/settings",
                    "بيانات المركز والأمان",
                    "الملف والإعدادات وسجل العمليات",
                    GearSix,
                  ],
                ],
              },
            ].map((g) => (
              <Panel key={g.title} title={g.title}>
                <div className="website-admin-shortcuts">
                  {g.links.map(([to, t, description, Icon]) => {
                    const C = Icon as typeof Globe;
                    return (
                      <Link key={String(to)} to={String(to)}>
                        <C size={23} />
                        <div>
                          <strong>{String(t)}</strong>
                          <small>{String(description)}</small>
                        </div>
                        <ArrowLeft size={18} />
                      </Link>
                    );
                  })}
                </div>
              </Panel>
            ))}
          </div>
          <Panel title="نشر دورة من البداية للنهاية">
            <ol className="website-admin-steps">
              <li>
                أنشئ الدورة في «الدورات والمحتوى»، وأضف المدرب والدروس والجدول
                والمتطلبات.
              </li>
              <li>
                حدد السعر والسعة وافتح التسجيل في إعدادات رسوم الدورة، ثم انشرها
                عندما تجهز.
              </li>
              <li>
                من «دليل الدورات» هنا، اربط صفحة البرنامج بالدورة التعليمية
                الصحيحة واختر ظهورها.
              </li>
              <li>
                راجع الصفحة العامة من «عرض الموقع». تتغير الرسوم وحالة التسجيل
                وفق الدفعة المنشورة.
              </li>
            </ol>
            <div className="alert">
              تعرض الخدمات والتشغيل الحالة الفعلية للمزودين. ظهور واجهة دفع أو
              رسائل لا يعني تفعيل الخدمة.
            </div>
          </Panel>
        </>
      )}
      {tab === "site" && (
        <Panel
          title="هوية الموقع ومعلومات المركز"
          description="تظهر التعديلات للزوار بعد الحفظ. اترك البريد والعنوان فارغين إذا لم يكونا معتمدين."
        >
          <Form
            key={"site-" + content.revision}
            submitLabel={busy ? "جارٍ الحفظ…" : "حفظ ونشر المحتوى"}
            onSubmit={(d) => save("site", d)}
          >
            <div className="form-grid">
              {Object.entries(content.site).map(([key, value]) => (
                <Field key={key} label={labels[key] || key}>
                  <>
                    {[
                      "about",
                      "hero_description",
                      "business_description",
                      "hero_title",
                    ].includes(key) ? (
                      <textarea
                        name={key}
                        defaultValue={value}
                        rows={key === "hero_title" ? 2 : 4}
                        required
                        maxLength={key === "hero_title" ? 300 : 3000}
                      />
                    ) : (
                      <input
                        name={key}
                        defaultValue={value}
                        type={key === "email" ? "email" : "text"}
                        maxLength={300}
                        required={
                          !["email", "address", "announcement"].includes(key)
                        }
                        dir={
                          ["phone", "whatsapp", "email"].includes(key)
                            ? "ltr"
                            : undefined
                        }
                      />
                    )}
                  </>
                </Field>
              ))}
            </div>
          </Form>
        </Panel>
      )}
      {tab === "programs" && (
        <Panel
          title="دليل الدورات العام"
          description="تحكم في النص التعريفي والظهور. محتوى الدروس الخاصة وحالة نشر الدفعة ورسومها تُدار من صفحة الدورات التعليمية."
        >
          <div className="website-create-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreating("program")}
            >
              <Plus size={18} />
              إضافة صفحة دورة
            </Button>
          </div>
          <label className="field website-select">
            <span>اختر صفحة الدورة</span>
            <select value={p.slug} onChange={(e) => setProgram(e.target.value)}>
              {content.programs.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title}
                  {p.visible ? "" : " — مخفية"}
                </option>
              ))}
            </select>
          </label>
          <ProgramEditor
            key={p.slug + "-" + content.revision}
            p={p}
            courses={data.courses}
            onSave={(v) => save("program", v, { slug: p.slug })}
          />
        </Panel>
      )}
      {tab === "library" && (
        <Panel
          title="مكتبة التعلّم"
          description="عدل الأدلة الحالية وعناوينها ونصوصها. تنشر كنصوص منسقة دون إدخال أكواد."
        >
          <div className="website-create-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreating("article")}
            >
              <Plus size={18} />
              إضافة مقال
            </Button>
          </div>
          <label className="field website-select">
            <span>اختر المقال</span>
            <select value={a.id} onChange={(e) => setArticle(e.target.value)}>
              {content.articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          <ArticleEditor
            key={a.id + "-" + content.revision}
            article={a}
            onSave={(v) => save("article", v, { id: a.id })}
          />
        </Panel>
      )}
      {tab === "faq" && (
        <Panel
          title="الأسئلة الشائعة"
          description="إجابات واضحة تساعد الزائر قبل التواصل. أضف سؤالًا أو عدل الإجابات، ثم احفظ للنشر."
        >
          <FaqEditor
            key={content.revision}
            items={content.faqs}
            onSave={(v) => save("faq", v)}
          />
        </Panel>
      )}
      {tab === "pages" && (
        <Panel
          title="السياسات والصفحات العامة"
          description="راجع شروط المركز وسياساته المعتمدة، ثم حدّث النصوص المنشورة هنا."
        >
          <label className="field website-select">
            <span>الصفحة</span>
            <select
              value={pageKey}
              onChange={(e) => setPageKey(e.target.value)}
            >
              {Object.entries(content.pages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.title}
                </option>
              ))}
            </select>
          </label>
          <PolicyEditor
            key={pageKey + content.revision}
            page={content.pages[pageKey]}
            onSave={(v) => save("page", v, { id: pageKey })}
          />
        </Panel>
      )}
      {creating && (
        <Modal
          title={
            creating === "program" ? "إضافة صفحة دورة" : "إضافة مقال للمكتبة"
          }
          wide
          onClose={() => setCreating(null)}
        >
          {creating === "program" ? (
            <ProgramEditor
              p={{
                slug: "",
                title: "",
                category: content.categories[0].id,
                description: "",
                overview: "",
                audience: "",
                prerequisites: "",
                topics: [],
                outcomes: [],
                image: "/images/facility/main-training-room.webp",
                imageAlt: "قاعة مركز تفاصيل",
                visible: false,
                featured: false,
              }}
              courses={data.courses}
              categories={content.categories}
              isNew
              onSave={async (v) => {
                const slug = String((v as { slug: string }).slug);
                await save("program", v, { slug, create: true });
                setProgram(slug);
                setCreating(null);
              }}
            />
          ) : (
            <ArticleEditor
              article={{
                id: "",
                title: "",
                category: "",
                minutes: 3,
                intro: "",
                sections: [{ title: "", text: "" }],
              }}
              isNew
              onSave={async (v) => {
                const id = String((v as { slug: string }).slug);
                await save("article", v, { id, create: true });
                setArticle(id);
                setCreating(null);
              }}
            />
          )}
        </Modal>
      )}
      {tab === "inquiries" && (
        <>
          <div className="filter-bar">
            <select
              aria-label="تصفية طلبات الموقع"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">جميع الحالات</option>
              {Object.entries(stateLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <span>{total.toLocaleString("ar-SA")} طلب</span>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  "طلبات-الموقع-الصفحة-" + page + ".csv",
                  [
                    "المرجع",
                    "النوع",
                    "الاسم",
                    "الجوال",
                    "البريد",
                    "الجهة",
                    "الرسالة",
                    "الحالة",
                    "التاريخ",
                  ],
                  inquiries.map((i) => [
                    i.reference,
                    kindLabels[i.kind],
                    i.details.name,
                    i.details.phone,
                    i.details.email,
                    i.details.organization,
                    i.details.message,
                    stateLabels[i.status],
                    i.created_at,
                  ]),
                )
              }
            >
              <DownloadSimple size={18} />
              تصدير الصفحة الحالية
            </Button>
          </div>
          {inquiryLoading ? (
            <Panel>
              <p role="status">جارٍ تحميل طلبات الموقع…</p>
            </Panel>
          ) : inquiryError ? (
            <Panel>
              <p role="alert">{inquiryError}</p>
              <Button type="button" onClick={loadInquiries}>
                إعادة التحميل
              </Button>
            </Panel>
          ) : !inquiries.length ? (
            <Empty
              title="لا توجد طلبات مطابقة"
              text="تظهر هنا رسائل التواصل وطلبات الدورات والجهات والتعاون التي تُرسل من الموقع."
            />
          ) : (
            <div className="website-inquiries">
              {inquiries.map((i) => (
                <Panel key={i.id}>
                  <div className="website-inquiry-head">
                    <div>
                      <Badge>{kindLabels[i.kind]}</Badge>
                      <h2>{i.details.name}</h2>
                      <small>
                        {i.reference} · {date(i.created_at)}
                      </small>
                    </div>
                    <select
                      aria-label={"حالة الطلب " + i.reference}
                      value={i.status}
                      onChange={async (e) => {
                        try {
                          await api("website.inquiry.status", {
                            id: i.id,
                            status: e.target.value,
                          });
                          await loadInquiries();
                          const r = await get<{ total: number }>(
                            "website.inquiries",
                            { status: "new" },
                          );
                          setNewCount(r.total);
                          notify("حُدّثت حالة الطلب.");
                        } catch (e) {
                          notify((e as Error).message, "error");
                        }
                      }}
                    >
                      {Object.entries(stateLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <dl className="website-inquiry-details">
                    <div>
                      <dt>الجوال</dt>
                      <dd>
                        <a href={"tel:" + i.details.phone}>
                          <bdi>{i.details.phone}</bdi>
                        </a>
                      </dd>
                    </div>
                    {i.details.email && (
                      <div>
                        <dt>البريد</dt>
                        <dd>
                          <a href={"mailto:" + i.details.email}>
                            {i.details.email}
                          </a>
                        </dd>
                      </div>
                    )}
                    {i.details.organization && (
                      <div>
                        <dt>الجهة</dt>
                        <dd>{i.details.organization}</dd>
                      </div>
                    )}
                    {i.program_slug && (
                      <div>
                        <dt>الدورة</dt>
                        <dd>
                          {content.programs.find(
                            (p) => p.slug === i.program_slug,
                          )?.title || i.program_slug}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="website-message">{i.details.message}</p>
                </Panel>
              ))}
            </div>
          )}
          <div className="website-pagination">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              السابقة
            </Button>
            <span>صفحة {page.toLocaleString("ar-SA")}</span>
            <Button
              type="button"
              variant="secondary"
              disabled={page * 25 >= total}
              onClick={() => setPage(page + 1)}
            >
              التالية
            </Button>
          </div>
        </>
      )}
    </>
  );
}
function ProgramEditor({
  p,
  courses,
  onSave,
  isNew = false,
  categories = [],
}: {
  isNew?: boolean;
  categories?: SiteContent["categories"];
  p: SiteProgram;
  courses: { id: string; title: string }[];
  onSave: (v: object) => Promise<void>;
}) {
  return (
    <Form
      submitLabel="حفظ ونشر صفحة الدورة"
      onSubmit={(d) =>
        onSave({
          ...d,
          visible: d.visible === "on",
          featured: d.featured === "on",
          topics: String(d.topics || "")
            .split("\n")
            .map((t) => t.trim())
            .filter(Boolean),
          outcomes: String(d.outcomes || "")
            .split("\n")
            .map((t) => t.trim())
            .filter(Boolean),
        })
      }
    >
      {isNew && (
        <div className="form-grid">
          <Field
            label="رابط الصفحة"
            hint="أحرف إنجليزية صغيرة وأرقام وشرطات؛ مثل communication-skills."
          >
            <input
              name="slug"
              dir="ltr"
              required
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </Field>
          <Field label="مجال الدورة">
            <select name="category" defaultValue={p.category}>
              {categories.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <div className="form-grid">
        {[
          ["title", "عنوان الدورة"],
          ["description", "التعريف المختصر"],
          ["overview", "عن الدورة"],
          ["audience", "الفئة المستهدفة"],
          ["prerequisites", "متطلبات البداية"],
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            {key === "title" ? (
              <input
                name={key}
                defaultValue={p[key]}
                required
                maxLength={160}
              />
            ) : (
              <textarea
                name={key}
                defaultValue={p[key as keyof SiteProgram] as string}
                required
                rows={4}
                maxLength={key === "overview" ? 4000 : 1000}
              />
            )}
          </Field>
        ))}
        <Field
          label="الدورة التعليمية المرتبطة"
          hint="تظهر حالة التسجيل والرسوم للدورة المنشورة فقط."
        >
          <select name="course_id" defaultValue={p.course_id || ""}>
            <option value="">مطابقة عنوان البرنامج تلقائيًا</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="محاور التعلّم"
          hint="محور واحد في كل سطر، بحد أقصى ١٢ محورًا."
        >
          <textarea name="topics" rows={6} defaultValue={p.topics.join("\n")} />
        </Field>
        <Field
          label="المهارات المستهدفة"
          hint="مهارة واحدة في كل سطر، بحد أقصى ١٢ مهارة."
        >
          <textarea
            name="outcomes"
            rows={6}
            defaultValue={p.outcomes.join("\n")}
          />
        </Field>
      </div>
      <label className="checkbox-field">
        <input type="checkbox" name="visible" defaultChecked={p.visible} />
        إظهار الدورة للزوار
      </label>
      <label className="checkbox-field">
        <input type="checkbox" name="featured" defaultChecked={p.featured} />
        ضمن الدورات المختارة في الرئيسية (تظهر أول أربع دورات مختارة)
      </label>
      <Link
        to={"/programs/" + p.slug}
        target="_blank"
        className="website-preview-link"
      >
        معاينة الصفحة <ArrowSquareOut size={17} />
      </Link>
    </Form>
  );
}
function FaqEditor({
  items,
  onSave,
}: {
  items: { q: string; a: string }[];
  onSave: (v: object) => Promise<void>;
}) {
  const [draft, setDraft] = useState(items);
  return (
    <Form submitLabel="حفظ ونشر الأسئلة" onSubmit={() => onSave(draft)}>
      {draft.map((f, i) => (
        <div className="website-editor-item" key={i}>
          <Field label={"السؤال " + (i + 1)}>
            <input
              required
              maxLength={300}
              value={f.q}
              onChange={(e) =>
                setDraft(
                  draft.map((x, n) =>
                    n === i ? { ...x, q: e.target.value } : x,
                  ),
                )
              }
            />
          </Field>
          <Field label="الإجابة">
            <textarea
              required
              maxLength={2500}
              rows={3}
              value={f.a}
              onChange={(e) =>
                setDraft(
                  draft.map((x, n) =>
                    n === i ? { ...x, a: e.target.value } : x,
                  ),
                )
              }
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDraft(draft.filter((_, n) => n !== i))}
          >
            إزالة السؤال من المسودة
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={draft.length >= 30}
        onClick={() => setDraft([...draft, { q: "", a: "" }])}
      >
        <Plus size={18} />
        إضافة سؤال
      </Button>
    </Form>
  );
}
function ArticleEditor({
  article,
  onSave,
  isNew = false,
}: {
  isNew?: boolean;
  article: SiteArticle;
  onSave: (v: object) => Promise<void>;
}) {
  const [sections, setSections] = useState(article.sections);
  return (
    <Form
      submitLabel="حفظ ونشر المقال"
      onSubmit={(d) => onSave({ ...d, minutes: Number(d.minutes), sections })}
    >
      {isNew && (
        <Field
          label="رابط المقال"
          hint="أحرف إنجليزية صغيرة وأرقام وشرطات، دون مسافات."
        >
          <input
            name="slug"
            required
            maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            dir="ltr"
          />
        </Field>
      )}
      <Field label="عنوان المقال">
        <input
          name="title"
          defaultValue={article.title}
          required
          maxLength={180}
        />
      </Field>
      <div className="form-grid">
        <Field label="التصنيف">
          <input
            name="category"
            defaultValue={article.category}
            required
            maxLength={100}
          />
        </Field>
        <Field label="وقت القراءة بالدقائق">
          <input
            name="minutes"
            type="number"
            defaultValue={article.minutes}
            min={1}
            max={60}
            required
          />
        </Field>
      </div>
      <Field label="المقدمة">
        <textarea
          name="intro"
          defaultValue={article.intro}
          rows={3}
          maxLength={1500}
          required
        />
      </Field>
      {sections.map((s, i) => (
        <div className="website-editor-item" key={i}>
          <Field label={"عنوان الفقرة " + (i + 1)}>
            <input
              value={s.title}
              required
              maxLength={200}
              onChange={(e) =>
                setSections(
                  sections.map((x, n) =>
                    n === i ? { ...x, title: e.target.value } : x,
                  ),
                )
              }
            />
          </Field>
          <Field label="نص الفقرة">
            <textarea
              value={s.text}
              required
              rows={4}
              maxLength={4000}
              onChange={(e) =>
                setSections(
                  sections.map((x, n) =>
                    n === i ? { ...x, text: e.target.value } : x,
                  ),
                )
              }
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSections(sections.filter((_, n) => n !== i))}
          >
            إزالة الفقرة من المسودة
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={sections.length >= 15}
        onClick={() => setSections([...sections, { title: "", text: "" }])}
      >
        <Plus size={18} />
        إضافة فقرة
      </Button>
    </Form>
  );
}

function PolicyEditor({
  page,
  onSave,
}: {
  page: SiteContent["pages"][string];
  onSave: (value: object) => Promise<void>;
}) {
  const [sections, setSections] = useState(page.sections);
  return (
    <Form
      submitLabel="حفظ ونشر الصفحة"
      onSubmit={(d) => onSave({ ...d, sections })}
    >
      <Field label="عنوان الصفحة">
        <input
          name="title"
          defaultValue={page.title}
          required
          maxLength={180}
        />
      </Field>
      <Field label="المقدمة">
        <textarea
          name="intro"
          defaultValue={page.intro}
          required
          rows={3}
          maxLength={1500}
        />
      </Field>
      {sections.map(([title, text], i) => (
        <div className="website-editor-item" key={i}>
          <Field label="عنوان الفقرة">
            <input
              value={title}
              required
              maxLength={200}
              onChange={(e) =>
                setSections(
                  sections.map((s, n) =>
                    n === i ? [e.target.value, s[1]] : s,
                  ),
                )
              }
            />
          </Field>
          <Field label="نص الفقرة">
            <textarea
              value={text}
              required
              maxLength={4000}
              rows={4}
              onChange={(e) =>
                setSections(
                  sections.map((s, n) =>
                    n === i ? [s[0], e.target.value] : s,
                  ),
                )
              }
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSections(sections.filter((_, n) => n !== i))}
          >
            إزالة الفقرة من المسودة
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={sections.length >= 20}
        onClick={() => setSections([...sections, ["", ""]])}
      >
        <Plus size={18} />
        إضافة فقرة
      </Button>
    </Form>
  );
}
