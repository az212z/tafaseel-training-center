import { PublicPathDirectory } from "../pages/LearningTools";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  Certificate,
  Check,
  CheckCircle,
  Buildings,
  ChalkboardTeacher,
  MagnifyingGlass,
  List,
  X,
  Phone,
  WhatsappLogo,
  Envelope,
  ArrowRight,
  MapPin,
  Clock,
} from "@phosphor-icons/react";
import { api, get } from "../api";
import { asset, isStaticPreview } from "../environment";
import { RegistrationForm } from "../components/Registration";
import type { Order, User } from "../types";
import type { SiteContent, SiteProgram } from "./types";
import defaults from "./defaults.json";
import "./site.css";

const nav = [
  ["/programs", "الدورات والبرامج"],
  ["/trainers", "المدربون"],
  ["/about", "عن تفاصيل"],
  ["/business", "للجهات"],
  ["/library", "المكتبة"],
  ["/help", "المساعدة"],
];
const publicPaths = [
  "/",
  "/programs",
  "/trainers",
  "/tracks",
  "/learning-paths",
  "/about",
  "/gallery",
  "/business",
  "/teach",
  "/library",
  "/practice",
  "/help",
  "/faq",
  "/contact",
  "/verify",
  "/privacy",
  "/terms",
  "/registration-policy",
  "/sitemap",
  "/register",
];
export function isPublicPath(path: string) {
  return (
    publicPaths.includes(path.replace(/\/$/, "") || "/") ||
    /^\/(programs|tracks|library)\/[^/]+\/?$/.test(path)
  );
}
const money = (n: number) =>
  new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(n / 100);
function SiteLink({
  to,
  children,
  light = false,
}: {
  to: string;
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <Link className={`site-button${light ? " site-button-light" : ""}`} to={to}>
      {children}
      <ArrowLeft size={19} />
    </Link>
  );
}
function Heading({
  label,
  title,
  text,
}: {
  label: string;
  title: string;
  text?: string;
}) {
  return (
    <header className="site-heading">
      <span className="site-eyebrow">{label}</span>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </header>
  );
}
function ProgramCard({ p, c }: { p: SiteProgram; c: SiteContent }) {
  return (
    <article className="site-course">
      <Link to={`/programs/${p.slug}`} className="site-course-image">
        <img
          src={asset(p.image)}
          alt={p.imageAlt}
          loading="lazy"
          width="600"
          height="400"
        />
        <span>
          {c.categories.find((x) => x.id === p.category)?.title || p.category}
        </span>
      </Link>
      <div className="site-course-copy">
        <div className="site-course-state">
          <span className={p.availability?.open ? "site-open" : ""}>
            {p.availability?.open
              ? "التسجيل مفتوح"
              : "استفسر عن الدفعة القادمة"}
          </span>
          {p.availability?.duration ? (
            <small>{p.availability.duration} ساعة تدريبية</small>
          ) : null}
        </div>
        <h3>
          <Link to={`/programs/${p.slug}`}>{p.title}</Link>
        </h3>
        <p>{p.description}</p>
        {p.trainer_name && <small>{p.trainer_name}</small>}
        <div className="site-course-foot">
          {p.availability?.open && p.availability.price_minor !== null && (
            <span>{money(p.availability.price_minor)}</span>
          )}
          <Link to={`/programs/${p.slug}`} aria-label={`تفاصيل ${p.title}`}>
            عرض الدورة <ArrowUpLeft size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function PublicSite() {
  const [content, setContent] = useState<SiteContent | null>(
    isStaticPreview ? defaults : null,
  );
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    if (!isStaticPreview)
      api<SiteContent>("website")
        .then((r) => {
          if (live) setContent(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    api<{ user: User | null }>("session")
      .then((r) => {
        if (live) setUser(r.user);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [attempt]);
  useEffect(() => {
    setOpen(false);
    const anchor =
      location.hash && document.getElementById(location.hash.slice(1));
    if (anchor) anchor.scrollIntoView({ behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.hash, Boolean(content)]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!content) return;
    const path = location.pathname.replace(/\/$/, "") || "/";
    const p = content.programs.find((p) => path === `/programs/${p.slug}`);
    const a = content.articles.find((a) => path === `/library/${a.id}`);
    const labels: Record<string, string> = {
      "/": "منصة تفاصيل | الدورات والمدربون",
      "/trainers": "مدربو المنصة",
      "/programs": "الدورات والبرامج",
      "/learning-paths": "مسارات التعلم",
      "/about": "عن مركز تفاصيل",
      "/contact": "تواصل معنا",
      "/help": "مركز المساعدة",
      "/business": "تدريب الجهات",
      "/library": "مكتبة التعلّم",
      "/gallery": "صور المركز",
      "/teach": "انضم كمدرب",
      "/privacy": "سياسة الخصوصية",
      "/terms": "شروط الاستخدام",
      "/registration-policy": "سياسة التسجيل والإلغاء",
      "/verify": "التحقق من الشهادات",
      "/practice": "تمارين توضيحية",
      "/register": "إنشاء حساب متدرب",
      "/sitemap": "خريطة الموقع",
    };
    document.title =
      (p?.title || a?.title || labels[path] || "برامج تفاصيل") +
      (path === "/" ? "" : " | منصة تفاصيل");
    const desc = p?.description || a?.intro || content.site.hero_description;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", desc);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", "https://tafaseel-learn.com" + path);
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute(
        "content",
        path !== "/register" &&
          (publicPaths.includes(path) ||
            p ||
            a ||
            content.categories.some((g) => path === "/tracks/" + g.id))
          ? "index,follow"
          : "noindex,follow",
      );
  }, [location.pathname, content]);
  if (!content)
    return (
      <main className="site-loading" dir="rtl">
        <img src={asset("/brand/logo.webp")} alt="تفاصيل" />
        <h1>{error ? "تعذّر تحميل الموقع" : "أهلًا بك في تفاصيل"}</h1>
        <p>{error || "نجهّز لك خيارات التعلّم…"}</p>
        {error && (
          <button
            onClick={() => {
              setError("");
              setAttempt(attempt + 1);
            }}
          >
            إعادة المحاولة
          </button>
        )}
      </main>
    );
  const s = content.site;
  return (
    <div className="site" dir="rtl">
      <a href="#site-main" className="site-skip">
        انتقل إلى المحتوى
      </a>
      {s.announcement && (
        <div className="site-announcement">
          {s.announcement}
          <Link to="/help">
            كيف أبدأ؟ <ArrowLeft size={15} />
          </Link>
        </div>
      )}
      <header className="site-header">
        <div className="site-container site-nav">
          <Link className="site-brand" to="/" aria-label="تفاصيل — الرئيسية">
            <img
              src={asset("/brand/logo.webp")}
              alt=""
              width="55"
              height="55"
            />
            <span>منصة تفاصيل</span>
          </Link>
          <nav
            id="site-navigation"
            aria-label="التنقل الرئيسي"
            className={open ? "is-open" : ""}
          >
            {nav.map(([to, label]) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
            <Link to="/contact" className="site-mobile-contact">
              تواصل معنا
            </Link>
          </nav>
          <Link className="site-account" to={user ? "/dashboard" : "/login"}>
            <span>{user ? "مساحتي التعليمية" : "تسجيل الدخول"}</span>
            <ArrowUpLeft size={20} />
          </Link>
          <button
            className="site-menu"
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={open}
            aria-controls="site-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={25} /> : <List size={25} />}
          </button>
        </div>
      </header>
      <main id="site-main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home c={content} />} />
          <Route
            path="/trainers"
            element={
              <section className="site-container site-section">
                <TrainerCards c={content} />
              </section>
            }
          />
          <Route path="/programs" element={<Programs c={content} />} />
          <Route path="/learning-paths" element={<PublicPathDirectory />} />
          <Route path="/tracks" element={<Programs c={content} />} />
          <Route path="/tracks/:category" element={<Programs c={content} />} />
          <Route
            path="/programs/:slug"
            element={<ProgramDetail c={content} user={user} />}
          />
          <Route path="/about" element={<About c={content} />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route
            path="/business"
            element={<Service c={content} kind="business" />}
          />
          <Route
            path="/teach"
            element={<Service c={content} kind="trainer" />}
          />
          <Route path="/library" element={<Library c={content} />} />
          <Route path="/library/:id" element={<Article c={content} />} />
          <Route path="/practice" element={<Practice c={content} />} />
          <Route path="/help" element={<Help c={content} />} />
          <Route path="/faq" element={<Help c={content} />} />
          <Route path="/contact" element={<Contact c={content} />} />
          <Route path="/verify" element={<Verify />} />
          <Route
            path="/register"
            element={<Register content={content} user={user} />}
          />
          <Route
            path="/privacy"
            element={<Policy kind="privacy" c={content} />}
          />
          <Route path="/terms" element={<Policy kind="terms" c={content} />} />
          <Route
            path="/registration-policy"
            element={<Policy kind="registration" c={content} />}
          />
          <Route path="/sitemap" element={<Sitemap c={content} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="site-container site-footer-grid">
          <div>
            <Link className="site-brand" to="/">
              <img
                src={asset("/brand/logo.webp")}
                alt=""
                width="55"
                height="55"
              />
              <span>
                تفاصيل<small>{s.name}</small>
              </span>
            </Link>
            <p>{s.tagline}</p>
            <a className="site-phone" href={`tel:${s.phone}`}>
              <Phone size={19} />
              <bdi>{s.phone}</bdi>
            </a>
            <a
              href={`https://wa.me/${s.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsappLogo size={19} /> واتساب المركز
            </a>
          </div>
          <div>
            <h3>اكتشف تفاصيل</h3>
            {[
              ["/programs", "الدورات والبرامج"],
              ["/about", "عن المركز"],
              ["/gallery", "صور المركز"],
              ["/business", "تدريب الجهات"],
              ["/trainers", "مدربو المنصة"],
              ["/teach", "انضم كمدرب"],
            ].map(([to, l]) => (
              <Link key={to} to={to}>
                {l}
              </Link>
            ))}
          </div>
          <div>
            <h3>تعلّم وتابع</h3>
            {[
              ["/login", "مساحتي التعليمية"],
              ["/register", "إنشاء حساب متدرب"],
              ["/library", "مكتبة التعلّم"],
              ["/practice", "تمارين توضيحية"],
              ["/learning-paths", "مسارات التعلم"],
              ["/verify", "التحقق من الشهادات"],
            ].map(([to, l]) => (
              <Link key={to} to={to}>
                {l}
              </Link>
            ))}
          </div>
          <div>
            <h3>نساعدك على البدء</h3>
            {[
              ["/help", "مركز المساعدة"],
              ["/contact", "تواصل معنا"],
              ["/registration-policy", "التسجيل والإلغاء"],
              ["/privacy", "سياسة الخصوصية"],
              ["/terms", "شروط الاستخدام"],
            ].map(([to, l]) => (
              <Link key={to} to={to}>
                {l}
              </Link>
            ))}
          </div>
        </div>
        <div className="site-container site-footer-bottom">
          <span>
            © {new Date().getFullYear()} {s.name}. جميع الحقوق محفوظة.
          </span>
          <Link to="/sitemap">خريطة الموقع</Link>
        </div>
      </footer>
    </div>
  );
}
function TrainerCards({ c }: { c: SiteContent }) {
  return (
    <div className="trainer-showcase">
      <div className="site-section-heading">
        <h2>مدربو المنصة</h2>
        <Link className="site-text-link" to="/teach">
          انضم كمدرب <ArrowLeft size={18} />
        </Link>
      </div>
      <div className="trainer-grid">
        {c.trainers.map((t) => (
          <article className="trainer-card" key={t.id}>
            <div className="trainer-card-photo">
              {t.image && (
                <img
                  src={asset(t.image)}
                  loading="lazy"
                  width={420}
                  height={360}
                  alt={t.name}
                />
              )}
            </div>
            <div className="trainer-card-copy">
              <span>{t.specialty}</span>
              <h3>{t.name}</h3>
              <p>{t.bio}</p>
              {t.example && <small>ملف توضيحي</small>}
            </div>
          </article>
        ))}
      </div>
      {!c.trainers.length && <p>ستظهر هنا بطاقات المدربين عند نشرها.</p>}
    </div>
  );
}
function Home({ c }: { c: SiteContent }) {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const programs = c.programs
    .filter(
      (p) =>
        (!category || p.category === category) &&
        (!search.trim() ||
          (
            p.title +
            " " +
            p.description +
            " " +
            (p.trainer_name || "")
          ).includes(search.trim())),
    )
    .sort(
      (a, b) =>
        Number(!!b.availability?.open) - Number(!!a.availability?.open) ||
        Number(b.featured) - Number(a.featured),
    );
  return (
    <>
      <section className="discovery-hero site-container">
        <div>
          <h1>{c.site.hero_title}</h1>
          <p>{c.site.hero_description}</p>
          <div className="discovery-links">
            <a href="#home-courses" className="site-button">
              استكشف الدورات <ArrowLeft size={19} />
            </a>
            <Link to="/trainers">
              تعرّف على المدربين <ArrowUpLeft size={18} />
            </Link>
          </div>
        </div>
        <img
          src={asset("/images/facility/main-training-room.webp")}
          alt="قاعة تدريب تفاصيل"
          width="720"
          height="480"
          fetchPriority="high"
        />
      </section>
      <section
        id="home-courses"
        className="site-section site-container course-showcase"
      >
        <header className="site-section-heading">
          <div>
            <h2>جميع الدورات</h2>
          </div>
          <label className="discovery-search">
            <MagnifyingGlass size={20} />
            <input
              aria-label="ابحث في الدورات"
              placeholder="ابحث باسم الدورة أو المدرب"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </header>
        <div className="discovery-filters" aria-label="مجالات الدورات">
          <button aria-pressed={!category} onClick={() => setCategory("")}>
            الكل
          </button>
          {c.categories
            .filter((g) => c.programs.some((p) => p.category === g.id))
            .map((g) => (
              <button
                key={g.id}
                aria-pressed={g.id === category}
                onClick={() => setCategory(g.id)}
              >
                {g.title}
              </button>
            ))}
        </div>
        {programs.length ? (
          <div className="site-course-grid discovery-grid">
            {programs.map((p) => (
              <ProgramCard key={p.slug} p={p} c={c} />
            ))}
          </div>
        ) : (
          <p role="status">
            لم نجد دورة تطابق بحثك.{" "}
            <button
              onClick={() => {
                setSearch("");
                setCategory("");
              }}
            >
              عرض جميع الدورات
            </button>
          </p>
        )}
      </section>
      {c.trainers.length > 0 && (
        <section className="site-section site-container">
          <TrainerCards c={c} />
        </section>
      )}
      <section className="site-section site-container site-audiences">
        <div>
          <Buildings size={35} weight="duotone" />
          <h2>تدريب الجهات وفرق العمل</h2>
          <p>{c.site.business_description}</p>
          <Link className="site-text-link" to="/business">
            ناقش احتياج جهتك <ArrowLeft size={20} />
          </Link>
        </div>
        <div>
          <ChalkboardTeacher size={35} weight="duotone" />
          <h2>انضم إلى مدربي تفاصيل</h2>
          <p>
            عرّفنا بمجالك وخبرتك وفكرتك التدريبية. يصل طلب التعاون مباشرة إلى
            إدارة المركز لمراجعته.
          </p>
          <Link className="site-text-link" to="/teach">
            انضم كمدرب <ArrowLeft size={20} />
          </Link>
        </div>
      </section>
      <section className="site-section site-container site-place">
        <img
          src={asset("/images/facility/reception.webp")}
          alt="مكتب الاستقبال والجلسات الزرقاء داخل مركز تفاصيل"
          width="1448"
          height="1086"
          loading="lazy"
        />
        <div>
          <h2>عن منصة تفاصيل</h2>
          <p>{c.site.about}</p>
          <Link className="site-text-link" to="/gallery">
            جولة في المركز <ArrowLeft size={20} />
          </Link>
        </div>
      </section>
      <LibraryPreview c={c} />
      <section className="site-section site-container">
        <div className="site-section-heading">
          <h2>الأسئلة الشائعة</h2>
          <Link className="site-text-link" to="/help">
            مركز المساعدة <ArrowLeft size={19} />
          </Link>
        </div>
        <div className="site-faq-grid">
          {c.faqs.slice(0, 4).map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Programs({ c }: { c: SiteContent }) {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const term = params.get("q") || "";
  const cat = category || params.get("category") || "";
  const onlyOpen = params.get("open") === "1";
  const group = c.categories.find((g) => g.id === cat);
  const items = c.programs.filter(
    (p) =>
      (!cat || p.category === cat) &&
      (!onlyOpen || p.availability?.open) &&
      (!term ||
        [p.title, p.description, p.overview]
          .join(" ")
          .toLowerCase()
          .includes(term.toLowerCase())),
  );
  if (category && !group) return <NotFound />;
  return (
    <div className="site-container">
      <Heading
        label="دليل تفاصيل"
        title={group?.title || "الدورات والبرامج"}
        text={
          group?.description ||
          "تصفّح برامج المركز، تعرّف على ما يناسبك، وتحقق من حالة التسجيل لكل دورة."
        }
      />
      <div className="site-catalog-layout">
        <aside className="site-filters">
          <h2>مجالات التعلّم</h2>
          <Link className={!cat ? "selected" : ""} to="/programs">
            جميع المجالات{" "}
            <span>{c.programs.length.toLocaleString("ar-SA")}</span>
          </Link>
          {c.categories.map((g) => (
            <Link
              key={g.id}
              className={cat === g.id ? "selected" : ""}
              to={"/tracks/" + g.id}
            >
              {g.title}
              <span>
                {c.programs
                  .filter((p) => p.category === g.id)
                  .length.toLocaleString("ar-SA")}
              </span>
            </Link>
          ))}
          <div className="site-filter-help">
            <BookOpen size={27} />
            <h3>متردد في البداية؟</h3>
            <p>جاوب عن هدفك وحدد مجالًا تستكشفه.</p>
            <Link to="/help#finder">
              ساعدني أختار <ArrowLeft size={17} />
            </Link>
          </div>
        </aside>
        <section>
          <form
            className="site-catalog-search"
            role="search"
            onSubmit={(e) => e.preventDefault()}
          >
            <MagnifyingGlass size={21} />
            <input
              aria-label="ابحث في دليل الدورات"
              placeholder="ابحث باسم الدورة أو المهارة…"
              value={term}
              onChange={(e) => {
                setParams(
                  (p) => {
                    if (e.target.value) p.set("q", e.target.value);
                    else p.delete("q");
                    return p;
                  },
                  { replace: true },
                );
              }}
            />
            <label>
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(e) =>
                  setParams((p) => {
                    if (e.target.checked) p.set("open", "1");
                    else p.delete("open");
                    return p;
                  })
                }
              />
              التسجيل المفتوح
            </label>
          </form>
          <p className="site-result-count" role="status">
            {items.length.toLocaleString("ar-SA")} دورة مطابقة
          </p>
          {items.length ? (
            <div className="site-course-grid">
              {items.map((p) => (
                <ProgramCard key={p.slug} p={p} c={c} />
              ))}
            </div>
          ) : (
            <div className="site-empty">
              <MagnifyingGlass size={35} />
              <h2>لم نجد دورة بهذه الخيارات.</h2>
              <p>جرّب كلمة أخرى أو أزل تصفية التسجيل المفتوح.</p>
              <Link to="/programs">عرض جميع الدورات</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function ProgramDetail({ c, user }: { c: SiteContent; user: User | null }) {
  const { slug } = useParams();
  const p = c.programs.find((x) => x.slug === slug);
  if (!p) return <NotFound />;
  const category = c.categories.find((x) => x.id === p.category);
  return (
    <>
      <div className="site-container">
        <div className="site-breadcrumb">
          <Link to="/programs">الدورات</Link>
          <span>/</span>
          <Link to={"/tracks/" + p.category}>{category?.title}</Link>
          <span>/</span>
          <span>{p.title}</span>
        </div>
        <div className="site-detail-head">
          <div>
            <span className="site-eyebrow">{category?.title}</span>
            <h1>{p.title}</h1>
            <p>{p.description}</p>
            <span className="site-status">
              {p.availability?.open
                ? "التسجيل الإلكتروني مفتوح"
                : "استفسر عن موعد الدفعة القادمة"}
            </span>
          </div>
          <img src={asset(p.image)} alt={p.imageAlt} width="600" height="400" />
        </div>
        <div className="site-detail-layout">
          <article className="site-prose">
            <h2>عن الدورة</h2>
            <p>{p.overview}</p>
            {p.audience && (
              <>
                <h2>لمن هذه الدورة؟</h2>
                <p>{p.audience}</p>
              </>
            )}
            {p.prerequisites && (
              <>
                <h2>قبل أن تبدأ</h2>
                <p>{p.prerequisites}</p>
              </>
            )}
            {p.topics.length > 0 && (
              <>
                <h2>محاور التعلّم</h2>
                <ul className="site-check-list">
                  {p.topics.map((t) => (
                    <li key={t}>
                      <Check size={20} />
                      {t}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {p.outcomes.length > 0 && (
              <>
                <h2>مهارات تستهدفها الدورة</h2>
                <ul className="site-check-list">
                  {p.outcomes.map((t) => (
                    <li key={t}>
                      <CheckCircle size={20} />
                      {t}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {p.category === "exams" && (
              <p className="site-note">
                تدريب للاستعداد للاختبار. الحجز الرسمي لدى الجهة المنظمة.
              </p>
            )}
          </article>
          <ProgramEnrollment
            key={p.slug}
            program={p}
            user={user}
            registrationEnabled={c.registration_enabled !== false}
          />
        </div>
        {!p.availability?.open && (
          <section id="program-interest" className="site-section site-interest">
            <div>
              <h2>استفسر عن الدفعة القادمة</h2>
              <p>سيتواصل معك المركز عند توفر التفاصيل.</p>
            </div>
            <Inquiry c={c} kind="program" slug={p.slug} />
          </section>
        )}
        <section className="site-section">
          <div className="site-section-heading">
            <h2>دورات ذات صلة</h2>
            <Link to={"/tracks/" + p.category}>
              المزيد في المجال <ArrowLeft size={18} />
            </Link>
          </div>
          <div className="site-course-grid">
            {c.programs
              .filter((x) => x.category === p.category && x.slug !== p.slug)
              .slice(0, 2)
              .map((p) => (
                <ProgramCard key={p.slug} c={c} p={p} />
              ))}
          </div>
        </section>
      </div>
    </>
  );
}
type RegistrationState = {
  enrolled: boolean;
  requested: boolean;
  payment_available: boolean;
};
function ProgramEnrollment({
  program,
  user,
  registrationEnabled,
}: {
  program: SiteProgram;
  user: User | null;
  registrationEnabled: boolean;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<RegistrationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const course = program.availability;
  const courseId = course?.id;
  const student = user?.role === "student";
  const loginPath = "/login?program=" + encodeURIComponent(program.slug);
  useEffect(() => {
    if (!student || !courseId) return;
    let live = true;
    get<RegistrationState>("course.registration", { id: courseId })
      .then((result) => {
        if (live) setState(result);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [courseId, student]);

  async function register() {
    if (!courseId || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{
        enrolled: boolean;
        requested?: boolean;
        order?: Order;
      }>("course.apply", { course_id: courseId });
      if (r.enrolled) navigate("/courses/" + courseId);
      else if (r.order?.checkout_url) location.assign(r.order.checkout_url);
      else if (r.order) navigate("/payments?order=" + r.order.id);
      else navigate("/registrations");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const price = course?.price_minor ?? 0;
  return (
    <aside className="site-enroll" aria-label="التسجيل في الدورة">
      <h2>{state?.enrolled ? "مسجّل في الدورة" : "التسجيل في الدورة"}</h2>
      <dl>
        {course?.duration ? (
          <div>
            <dt>المدة</dt>
            <dd>{course.duration} ساعة</dd>
          </div>
        ) : null}
        {course?.open && (
          <div>
            <dt>الرسوم</dt>
            <dd>{price ? money(price) : "مجانية"}</dd>
          </div>
        )}
      </dl>
      {state?.enrolled ? (
        <SiteLink to={"/courses/" + courseId}>ابدأ التعلّم</SiteLink>
      ) : !course?.open ? (
        <a className="site-button" href="#program-interest">
          استفسر عن موعد التسجيل <ArrowLeft size={18} />
        </a>
      ) : !user ? (
        <>
          {registrationEnabled ? (
            <>
              <SiteLink
                to={"/register?program=" + encodeURIComponent(program.slug)}
              >
                سجّل في الدورة
              </SiteLink>
              <Link className="site-text-link" to={loginPath}>
                لدي حساب بالفعل
              </Link>
            </>
          ) : (
            <SiteLink to={loginPath}>سجّل الدخول للالتحاق</SiteLink>
          )}
        </>
      ) : !student ? (
        <p className="site-note">التسجيل متاح من حساب الطالب.</p>
      ) : state?.requested && price > 0 && !state?.payment_available ? (
        <>
          <p className="site-form-success" role="status">
            طلبك مسجّل وبانتظار السداد.
          </p>
          <SiteLink to="/registrations">متابعة الطلب</SiteLink>
        </>
      ) : (
        <button
          className="site-button"
          type="button"
          onClick={() => void register()}
          disabled={busy || !state}
        >
          {busy
            ? "جارٍ التسجيل…"
            : price && state?.payment_available
              ? "المتابعة إلى الدفع"
              : price
                ? "إرسال طلب التسجيل"
                : "سجّل مجانًا"}
          <ArrowLeft size={18} />
        </button>
      )}
      {error && (
        <p role="alert" className="site-form-error">
          {error}
        </p>
      )}
    </aside>
  );
}
function Inquiry({
  c,
  kind = "contact",
  slug = "",
}: {
  c: SiteContent;
  kind?: string;
  slug?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    reference: string;
    message: string;
  } | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (isStaticPreview)
        throw new Error(
          "هذه نسخة عرض محلية؛ نموذج الطلب متاح على الموقع الرئيسي.",
        );
      await api("session");
      setResult(
        await api("website.inquiry", {
          ...values,
          kind,
          program_slug: slug || values.program_slug || "",
          consent: values.consent === "on",
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <div className="site-form-success" role="status">
        <CheckCircle size={40} />
        <h3>وصل طلبك إلى تفاصيل.</h3>
        <p>{result.message}</p>
        <strong dir="ltr">{result.reference}</strong>
        <button onClick={() => setResult(null)}>إرسال طلب آخر</button>
      </div>
    );
  return (
    <form className="site-form" onSubmit={submit}>
      <div className="site-form-row">
        <label>
          الاسم الكامل
          <input name="name" required maxLength={120} autoComplete="name" />
        </label>
        <label>
          رقم الجوال
          <input
            name="phone"
            type="tel"
            required
            maxLength={20}
            autoComplete="tel"
            dir="ltr"
            placeholder="05xxxxxxxx"
          />
        </label>
      </div>
      <label>
        البريد الإلكتروني {kind !== "trainer" && <small>(اختياري)</small>}
        <input
          name="email"
          type="email"
          required={kind === "trainer"}
          maxLength={190}
          autoComplete="email"
          dir="ltr"
        />
      </label>
      {kind === "business" && (
        <label>
          الجهة أو فريق العمل
          <input name="organization" required maxLength={160} />
        </label>
      )}
      {kind === "contact" && (
        <label>
          الدورة المرتبطة بالاستفسار <small>(اختياري)</small>
          <select name="program_slug">
            <option value="">استفسار عام</option>
            {c.programs.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {kind === "trainer"
          ? "مجالك وخبرتك وفكرتك التدريبية"
          : kind === "business"
            ? "الهدف التدريبي وعدد المشاركين والوقت المقترح"
            : "كيف نساعدك؟"}
        <textarea
          name="message"
          required
          minLength={2}
          maxLength={3000}
          rows={5}
        />
      </label>
      <label className="site-trap" aria-hidden="true">
        الموقع
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="site-consent">
        <input type="checkbox" name="consent" required />
        <span>
          أوافق على حفظ بيانات طلبي والتواصل معي بخصوصه وفق{" "}
          <Link to="/privacy" target="_blank">
            سياسة الخصوصية
          </Link>
          .
        </span>
      </label>
      <p className="site-form-hint">
        أرسل معلومات طلبك فقط، دون كلمات مرور أو أرقام هوية أو بيانات دفع.
      </p>
      {error && (
        <p className="site-form-error" role="alert">
          {error}
        </p>
      )}
      <button className="site-button" type="submit" disabled={busy}>
        {busy ? "جارٍ إرسال الطلب…" : "إرسال إلى إدارة تفاصيل"}
        <ArrowLeft size={19} />
      </button>
    </form>
  );
}
function About({ c }: { c: SiteContent }) {
  return (
    <div className="site-container">
      <Heading
        label="عن تفاصيل"
        title="في التفاصيل، يبدأ الفهم."
        text="مركز تدريب، ومساحة تجمع الاكتشاف والتعلّم والمتابعة."
      />
      <section className="site-place site-about">
        <img
          src={asset("/images/facility/workshop-room.webp")}
          alt="إحدى قاعات مركز تفاصيل للتدريب"
          width="1448"
          height="1086"
        />
        <div>
          <h2>
            معرفة تفهمها.
            <br />
            ومهارة تستخدمها.
          </h2>
          <p>{c.site.about}</p>
          <p>
            تتنوع برامجنا بين القدرات والاختبارات التعليمية واللغة الإنجليزية
            والتطوير الذاتي والمهني والفنون ودورات الأطفال. نساعدك على اختيار
            البرنامج الأقرب إلى هدفك، ونوضح تفاصيل دفعتك قبل التسجيل.
          </p>
          <SiteLink to="/programs">اكتشف البرامج</SiteLink>
        </div>
      </section>
      <div className="site-values">
        {[
          [
            "01",
            "وضوح قبل القرار",
            "تعرّف على الفئة المستهدفة والمتطلبات، واستفسر عن الرسوم والجدول قبل تأكيد تسجيلك.",
          ],
          [
            "02",
            "ممارسة لها هدف",
            "انتقل من شرح الفكرة إلى التطبيق والمراجعة داخل الدورة التي تلتحق بها.",
          ],
          [
            "03",
            "متابعة في مكان واحد",
            "تابع دروسك وتكليفاتك وحضورك ونتائجك من حسابك، بصلاحيات تحفظ خصوصية كل متدرب.",
          ],
        ].map(([n, t, d]) => (
          <div key={n}>
            <span>{n}</span>
            <h2>{t}</h2>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <section className="site-section site-callout">
        <h2>تعرّف على المكان قبل زيارتك.</h2>
        <SiteLink to="/gallery" light>
          صور المركز
        </SiteLink>
      </section>
    </div>
  );
}
const photos = [
  [
    "main-training-room",
    "مساحة للتعلّم والمشاركة",
    "قاعة بطاولات جماعية وكراسٍ زرقاء وشاشة عرض.",
  ],
  [
    "reception",
    "أهلًا بك في تفاصيل",
    "مكتب الاستقبال والجلسات عند مدخل القاعات.",
  ],
  [
    "daylight-classroom",
    "ضوء وبداية جديدة",
    "مقاعد تدريبية بجوار الواجهات الزجاجية.",
  ],
  ["workshop-room", "هوية تحضر في المكان", "ألوان تفاصيل ونقوشها داخل القاعة."],
  [
    "lounge",
    "استراحة بين الخطوات",
    "جلسات جانبية وطاولات ونباتات داخل المركز.",
  ],
  [
    "interactive-display",
    "وسائل العرض في القاعات",
    "شاشة تفاعلية وسبورة ضمن تجهيزات المركز.",
  ],
];
function Gallery() {
  return (
    <div className="site-container">
      <Heading
        label="جولة في المركز"
        title="مساحات، لها تفاصيلها."
        text="صور من قاعات المركز والاستقبال ومناطق الجلوس. تعرّف على المكان، ونسّق زيارتك مع الفريق."
      />
      <div className="site-gallery">
        {photos.map(([id, t, d]) => (
          <figure key={id}>
            <img
              src={asset("/images/facility/" + id + ".webp")}
              alt={d}
              width="1448"
              height="1086"
              loading="lazy"
            />
            <figcaption>
              <h2>{t}</h2>
              <p>{d}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="site-note">
        الصور توثّق مساحات المركز، ولا تعني أن دورة معينة تُعقد في القاعة الظاهرة
        أو أن المقاعد متاحة في موعد محدد.
      </div>
    </div>
  );
}
function Service({
  c,
  kind,
}: {
  c: SiteContent;
  kind: "business" | "trainer";
}) {
  return (
    <div className="site-container">
      <Heading
        label={kind === "business" ? "تفاصيل للجهات" : "شارك معرفتك"}
        title={
          kind === "business"
            ? "فريقك يستحق تعلّمًا له هدف."
            : "خبرتك قد تكون بداية شخص آخر."
        }
        text={
          kind === "business"
            ? c.site.business_description
            : "نرحب بطلبات التعاون التدريبية. عرّفنا بخبرتك والموضوع الذي ترغب في تدريسه، لتراجع الإدارة مدى ملاءمته لبرامج المركز."
        }
      />
      <div className="site-contact-layout">
        <section className="site-service-copy">
          {kind === "business" ? (
            <Buildings size={50} weight="duotone" />
          ) : (
            <ChalkboardTeacher size={50} weight="duotone" />
          )}
          <h2>
            {kind === "business" ? "نبدأ من احتياجكم." : "تعاون يبدأ بالتعارف."}
          </h2>
          <ol className="site-service-steps">
            {(kind === "business"
              ? [
                  "حدّد المهارات التي يحتاجها الفريق والفئة المستهدفة.",
                  "شاركنا عدد المشاركين والمواعيد ونمط التدريب المقترح.",
                  "تناقش الإدارة النطاق والإمكانية ثم تفاصيل العرض والاتفاق.",
                ]
              : [
                  "عرّفنا بمجالك وخبرتك العملية والتدريبية.",
                  "اشرح فكرتك التدريبية والفئة التي تستهدفها.",
                  "تراجع الإدارة الطلب وتتواصل عند مناسبة التعاون.",
                ]
            ).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <p className="site-note">
            إرسال الطلب لا ينشئ اتفاقًا أو التزامًا ماليًا، ولا يؤكد القبول. تُناقش
            التفاصيل وتعتمد بصورة مستقلة.
          </p>
        </section>
        <Inquiry c={c} kind={kind} />
      </div>
    </div>
  );
}
function LibraryPreview({ c }: { c: SiteContent }) {
  return (
    <section className="site-section site-container">
      <div className="site-section-heading">
        <div>
          <h2>مكتبة التعلّم</h2>
        </div>
        <Link className="site-text-link" to="/library">
          اكتشف المكتبة <ArrowLeft size={19} />
        </Link>
      </div>
      <div className="site-article-list">
        {c.articles.map((a) => (
          <Link key={a.id} to={"/library/" + a.id}>
            <div>
              <small>
                {a.category} · {a.minutes} دقائق قراءة
              </small>
              <h3>{a.title}</h3>
              <p>{a.intro}</p>
            </div>
            <ArrowUpLeft size={24} />
          </Link>
        ))}
      </div>
    </section>
  );
}
function Library({ c }: { c: SiteContent }) {
  return (
    <>
      <div className="site-container">
        <Heading
          label="مكتبة تفاصيل"
          title="تعلّم كيف تتعلّم."
          text="أدلة قصيرة تساعدك على التخطيط والممارسة ومراجعة أخطائك. متاحة للقراءة دون حساب."
        />
        <div className="site-library-intro">
          <BookOpen size={50} weight="duotone" />
          <div>
            <h2>مساحة صغيرة، لعادة تعلّم أفضل.</h2>
            <p>
              اقرأ فكرة وجرّبها في مذاكرتك. وللتدرب على التفكير الكمي واللفظي،
              افتح التمارين التوضيحية مع تفسير الإجابة.
            </p>
          </div>
          <SiteLink to="/practice">جرّب التمارين</SiteLink>
        </div>
      </div>
      <LibraryPreview c={c} />
    </>
  );
}
function Article({ c }: { c: SiteContent }) {
  const { id } = useParams();
  const a = c.articles.find((x) => x.id === id);
  if (!a) return <NotFound />;
  return (
    <article className="site-container site-article">
      <Link className="site-text-link" to="/library">
        <ArrowRight size={18} />
        العودة للمكتبة
      </Link>
      <Heading
        label={`${a.category} · ${a.minutes} دقائق قراءة`}
        title={a.title}
        text={a.intro}
      />
      <div className="site-prose">
        {a.sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </section>
        ))}
        <div className="site-note">
          محتوى إرشادي للتعلّم والمذاكرة. اختر ما يناسب مستواك ووقتك، وناقش
          احتياجك مع مدربك.
        </div>
        <SiteLink to="/programs">خطوتك التالية في التعلّم</SiteLink>
      </div>
    </article>
  );
}
function Practice({ c }: { c: SiteContent }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const q = c.questions[index];
  const selected = answers[q.id];
  const score = c.questions.filter((q) => answers[q.id] === q.correct).length;
  return (
    <div className="site-container site-practice">
      <Heading
        label="جرّب فكرة"
        title="حلّ، ثم افهم السبب."
        text="٨ أسئلة توضيحية في التفكير الكمي واللفظي. تمارين غير رسمية، لا تقيس مستوى اختبارك ولا تُسجل في نتائج حسابك."
      />
      <div className="site-practice-panel">
        <div>
          <span>
            {q.category} / {q.skill}
          </span>
          <b>
            السؤال {(index + 1).toLocaleString("ar-SA")} من{" "}
            {c.questions.length.toLocaleString("ar-SA")}
          </b>
        </div>
        <h2>{q.text}</h2>
        <div className="site-answer-options">
          {q.options.map((o, i) => (
            <button
              key={i}
              disabled={selected !== undefined}
              className={
                selected === undefined
                  ? ""
                  : i === q.correct
                    ? "correct"
                    : selected === i
                      ? "incorrect"
                      : ""
              }
              onClick={() => setAnswers({ ...answers, [q.id]: i })}
            >
              <span>{["أ", "ب", "ج", "د"][i]}</span>
              {o}
              {selected !== undefined && i === q.correct && (
                <CheckCircle size={21} />
              )}
            </button>
          ))}
        </div>
        {selected !== undefined && (
          <div className="site-explanation" role="status">
            <strong>
              {selected === q.correct
                ? "إجابة صحيحة."
                : "راجع الفكرة، ثم حاول تطبيقها."}
            </strong>
            <p>{q.explanation}</p>
          </div>
        )}
        <div className="site-practice-nav">
          <button disabled={index === 0} onClick={() => setIndex(index - 1)}>
            <ArrowRight size={18} />
            السابق
          </button>
          <span>
            {Object.keys(answers).length.toLocaleString("ar-SA")} محاولات ·{" "}
            {score.toLocaleString("ar-SA")} صحيحة
          </span>
          <button
            disabled={index === c.questions.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            التالي
            <ArrowLeft size={18} />
          </button>
        </div>
        {Object.keys(answers).length === c.questions.length && (
          <div className="site-note">
            أنهيت الأسئلة التوضيحية. راجع الشرح لكل إجابة، ثم اختر مهارة تواصل
            التدريب عليها.
            <button
              onClick={() => {
                setAnswers({});
                setIndex(0);
              }}
            >
              إعادة التمارين
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function Finder({ c }: { c: SiteContent }) {
  const [choice, setChoice] = useState("");
  return (
    <section id="finder" className="site-finder">
      <div>
        <span className="site-eyebrow">بداية تناسب هدفك</span>
        <h2>ماذا تريد أن تطوّر؟</h2>
        <p>
          اختر الأقرب إليك لنقترح مجالًا تستكشفه. هذا اختيار إرشادي؛ ملاءمة
          الدورة تُراجع مع المركز.
        </p>
      </div>
      <div>
        <label>
          هدفي من التعلّم
          <select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">اختر هدفك</option>
            {c.categories.map((g) => (
              <option key={g.id} value={g.id}>
                {g.description}
              </option>
            ))}
          </select>
        </label>
        {choice && (
          <div className="site-finder-result" role="status">
            <strong>{c.categories.find((g) => g.id === choice)?.title}</strong>
            <Link to={"/tracks/" + choice}>
              استكشف دورات المجال <ArrowLeft size={18} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
function Help({ c }: { c: SiteContent }) {
  const [query, setQuery] = useState("");
  const items = c.faqs.filter((f) => (f.q + " " + f.a).includes(query));
  return (
    <div className="site-container">
      <Heading
        label="مركز المساعدة"
        title="كل تفصيلة، أوضح."
        text="من اختيار الدورة إلى التسجيل والدخول والمتابعة. تجد هنا إجابات البداية وخطوات استخدام مساحتك التعليمية."
      />
      <Finder c={c} />
      <section className="site-section">
        <div className="site-section-heading">
          <h2>سؤالك قد يبدأ من هنا.</h2>
          <label className="site-help-search">
            <MagnifyingGlass size={20} />
            <input
              aria-label="ابحث في الأسئلة الشائعة"
              placeholder="ابحث عن إجابة…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="site-faq-grid">
          {items.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
        {!items.length && (
          <p role="status">لم نجد إجابة مطابقة. تواصل معنا وسنراجع استفسارك.</p>
        )}
      </section>
      <div className="site-help-links">
        <Link to="/verify">
          <Certificate size={30} />
          <h3>التحقق من شهادة</h3>
          <p>راجع صحة رقم شهادة صدرت من تفاصيل.</p>
          <ArrowUpLeft size={22} />
        </Link>
        <Link to="/contact">
          <Phone size={30} />
          <h3>نسمع استفسارك</h3>
          <p>تواصل مع إدارة المركز أو أرسل طلب دعم.</p>
          <ArrowUpLeft size={22} />
        </Link>
      </div>
    </div>
  );
}
function Contact({ c }: { c: SiteContent }) {
  return (
    <div className="site-container">
      <Heading
        label="تواصل مع تفاصيل"
        title="بداية أوضح، بمحادثة."
        text="استفسر عن دورة، ناقش احتياجك، أو اطلب المساعدة في الوصول إلى حسابك. يصل النموذج مباشرة إلى إدارة المركز."
      />
      <div className="site-contact-layout">
        <section className="site-contact-info">
          <a href={`tel:${c.site.phone}`}>
            <Phone size={28} />
            <div>
              <small>اتصل بالمركز</small>
              <strong dir="ltr">{c.site.phone}</strong>
            </div>
            <ArrowUpLeft size={20} />
          </a>
          <a
            href={`https://wa.me/${c.site.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsappLogo size={28} />
            <div>
              <small>واتساب المركز</small>
              <strong>تحدث مع فريق تفاصيل</strong>
            </div>
            <ArrowUpLeft size={20} />
          </a>
          {c.site.email && (
            <a href={"mailto:" + c.site.email}>
              <Envelope size={28} />
              <div>
                <small>البريد الإلكتروني</small>
                <strong>{c.site.email}</strong>
              </div>
            </a>
          )}
          {c.site.address && (
            <div>
              <MapPin size={28} />
              <p>{c.site.address}</p>
            </div>
          )}
          <div>
            <Clock size={28} />
            <p>{c.site.hours}</p>
          </div>
          <img
            src={asset("/images/facility/reception.webp")}
            alt="منطقة استقبال مركز تفاصيل"
            width="600"
            height="450"
            loading="lazy"
          />
        </section>
        <Inquiry c={c} />
      </div>
    </div>
  );
}
function Verify() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    certificate: null | { serial: string; title: string; issued_at: string };
  } | null>(null);
  return (
    <div className="site-container site-verify">
      <Heading
        label="خدمة عامة"
        title="تحقق من شهادة تفاصيل."
        text="أدخل رقم الشهادة كاملًا كما يظهر عليها. تعرض الخدمة بيانات الإصدار والدورة، دون نشر بيانات المتدرب الشخصية."
      />
      <form
        className="site-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setResult(null);
          setBusy(true);
          try {
            await api("session");
            setResult(await api("certificate.verify", { serial: value }));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Certificate size={44} weight="duotone" />
        <label>
          رقم الشهادة
          <input
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="TF-2026-XXXXXXXXXX"
            maxLength={60}
            dir="ltr"
          />
        </label>
        <button type="submit" className="site-button" disabled={busy}>
          {busy ? "جارٍ التحقق…" : "تحقق من الشهادة"}
          <ArrowLeft size={19} />
        </button>
        {error && (
          <p role="alert" className="site-form-error">
            {error}
          </p>
        )}
        {result && (
          <div
            className={result.valid ? "site-form-success" : "site-note"}
            role="status"
          >
            <h2>
              {result.valid
                ? "الشهادة مسجلة لدى تفاصيل."
                : "لم نجد شهادة بهذا الرقم."}
            </h2>
            {result.certificate ? (
              <>
                <strong>{result.certificate.title}</strong>
                <p dir="ltr">{result.certificate.serial}</p>
                <p>
                  تاريخ الإصدار:{" "}
                  {new Date(result.certificate.issued_at).toLocaleDateString(
                    "ar-SA-u-ca-gregory",
                  )}
                </p>
              </>
            ) : (
              <p>
                راجع الرقم كما يظهر على الشهادة، أو تواصل مع الإدارة للمساعدة.
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
function Register({
  content,
  user,
}: {
  content: SiteContent;
  user: User | null;
}) {
  const [params] = useSearchParams();
  const slug = params.get("program");
  const program = content.programs.find((p) => p.slug === slug);
  const enabled = content.registration_enabled !== false;
  const loginPath = program
    ? "/login?program=" + encodeURIComponent(program.slug)
    : "/login";
  if (slug && !program) return <NotFound />;
  return (
    <div className="site-container site-register">
      <header className="site-heading">
        <h1>{program ? "التسجيل في الدورة" : "إنشاء حساب طالب"}</h1>
        {program && <p>{program.title}</p>}
      </header>
      {user ? (
        <SiteLink to={program ? "/programs/" + program.slug : "/dashboard"}>
          {program ? "المتابعة إلى الدورة" : "مساحتي التعليمية"}
        </SiteLink>
      ) : !enabled || (program && !program.availability?.open) ? (
        <div className="site-note">
          التسجيل مغلق حاليًا. <Link to="/contact">تواصل مع الإدارة</Link>.
        </div>
      ) : (
        <div className="site-register-panel">
          <p>أكّد بريدك لتفعيل الحساب ومتابعة التسجيل في الدورة.</p>
          <RegistrationForm
            key={program?.slug ?? "account"}
            courseId={program?.availability?.id}
          />
        </div>
      )}
      {!user && (
        <Link className="site-text-link" to={loginPath}>
          لدي حساب بالفعل
        </Link>
      )}
    </div>
  );
}
function Policy({ kind, c }: { kind: string; c: SiteContent }) {
  const p = c.pages[kind];
  return (
    <div className="site-container site-policy">
      <Heading label="معلومات الاستخدام" title={p.title} text={p.intro} />
      <article className="site-prose">
        {p.sections.map(([t, d]) => (
          <section key={t}>
            <h2>{t}</h2>
            <p>{d}</p>
          </section>
        ))}
        <p>آخر تحديث: ١٧ نوفمبر ٢٠٢٦</p>
        <Link className="site-text-link" to="/contact">
          تواصل مع الإدارة <ArrowLeft size={18} />
        </Link>
      </article>
    </div>
  );
}
function Sitemap({ c }: { c: SiteContent }) {
  return (
    <div className="site-container">
      <Heading label="روابط تفاصيل" title="كل طريق، من هنا." />
      <div className="site-sitemap">
        <div>
          <h2>الموقع والخدمات</h2>
          {publicPaths
            .filter((p) => !["/tracks", "/faq"].includes(p))
            .map((p) => (
              <Link key={p} to={p}>
                {
                  (
                    {
                      "/": "الرئيسية",
                      "/programs": "الدورات",
                      "/about": "عن المركز",
                      "/gallery": "صور المركز",
                      "/business": "للجهات",
                      "/teach": "انضم كمدرب",
                      "/library": "المكتبة",
                      "/practice": "التمارين",
                      "/learning-paths": "مسارات التعلم",
                      "/help": "المساعدة",
                      "/contact": "التواصل",
                      "/verify": "التحقق من الشهادات",
                      "/privacy": "الخصوصية",
                      "/terms": "الشروط",
                      "/registration-policy": "سياسة التسجيل",
                      "/register": "إنشاء حساب",
                      "/sitemap": "خريطة الموقع",
                    } as Record<string, string>
                  )[p]
                }
              </Link>
            ))}
        </div>
        <div>
          <h2>المجالات</h2>
          {c.categories.map((g) => (
            <Link key={g.id} to={"/tracks/" + g.id}>
              {g.title}
            </Link>
          ))}
          <h2>مكتبة التعلّم</h2>
          {c.articles.map((a) => (
            <Link key={a.id} to={"/library/" + a.id}>
              {a.title}
            </Link>
          ))}
        </div>
        <div>
          <h2>دورات المركز</h2>
          {c.programs.map((p) => (
            <Link key={p.slug} to={"/programs/" + p.slug}>
              {p.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
export function NotFound() {
  return (
    <div className="site-container site-empty">
      <span className="site-eyebrow">404</span>
      <h1>هذا الطريق غير موجود.</h1>
      <p>اختر دورة من دليل المركز، أو عد إلى الرئيسية لتكمل رحلتك.</p>
      <SiteLink to="/">العودة إلى تفاصيل</SiteLink>
    </div>
  );
}
