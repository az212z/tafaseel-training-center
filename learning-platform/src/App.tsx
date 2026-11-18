import {
  useEffect,
  useState,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  NavLink,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import { LearningNotificationBell } from "./components/LearningNotifications";
import {
  SquaresFour,
  Wallet,
  ShoppingCart,
  VideoCamera,
  Plug,
  BookOpen,
  UsersThree,
  ClipboardText,
  Exam,
  CalendarBlank,
  UserCheck,
  FolderOpen,
  Certificate,
  ChartBar,
  Megaphone,
  ShieldCheck,
  GearSix,
  Question,
  SignOut,
  MagnifyingGlass,
  Bell,
  SidebarSimple,
  X,
  ArrowLeft,
  LockKey,
  ArrowSquareOut,
  CheckCircle,
  WarningCircle,
  SpinnerGap,
  GraduationCap,
  ChalkboardTeacher,
  UserCircle,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { api, get, setCsrf } from "./api";
import { asset, isStaticPreview, githubTrialUrl } from "./environment";
import { Context, roles } from "./context";
import type { Data, User, Role } from "./types";
import { Avatar, Button, Modal, Search, Empty } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import "./learning-tools.css";
import { Notebook } from "./pages/Notebook";
import { EmailCenter } from "./pages/EmailCenter";
import { Paths, LaunchChecklist } from "./pages/LearningTools";
import { Catalog, Payments } from "./pages/Commerce";
import { Bags, Videos } from "./pages/Resources";
import { Notifications, Integrations } from "./pages/Communication";
import { Registration } from "./components/Registration";
import {
  Courses,
  CourseDetail,
  Students,
  StudentDetail,
  Assignments,
  Quizzes,
  QuizAttempt,
  Schedule,
  AttendancePage,
  FilesPage,
  Certificates,
  Reports,
  Announcements,
  Users,
  Settings,
  SupportPage,
} from "./pages/Pages";
const PublicSite = lazy(() => import("./site/PublicSite"));
const WebsiteAdmin = lazy(() => import("./site/WebsiteAdmin"));
const AccountActivation = lazy(() => import("./pages/AccountActivation"));
const menu: {
  title: string;
  items: { to: string; label: string; icon: Icon; roles?: Role[] }[];
}[] = [
  {
    title: "مساحة التعلم",
    items: [
      { to: "/dashboard", label: "نظرة عامة", icon: SquaresFour },
      { to: "/courses", label: "الدورات التدريبية", icon: BookOpen },
      { to: "/paths", label: "مسارات التعلم", icon: GraduationCap },
      {
        to: "/notebook",
        label: "دفتر المراجعة",
        icon: BookOpen,
        roles: ["admin", "instructor", "student"],
      },
      { to: "/catalog", label: "التسجيل في الدورات", icon: ShoppingCart },
      {
        to: "/students",
        label: "الطلاب والمتدربون",
        icon: UsersThree,
        roles: ["admin", "instructor", "guardian"],
      },
      { to: "/assignments", label: "الواجبات والتكليفات", icon: ClipboardText },
      { to: "/quizzes", label: "الاختبارات", icon: Exam },
      { to: "/schedule", label: "الجدول التدريبي", icon: CalendarBlank },
      { to: "/attendance", label: "الحضور والغياب", icon: UserCheck },
    ],
  },
  {
    title: "الموارد والمتابعة",
    items: [
      { to: "/files", label: "مكتبة الملفات", icon: FolderOpen },
      { to: "/bags", label: "الحقائب التعليمية", icon: FolderOpen },
      {
        to: "/videos",
        label: "مكتبة الفيديو السحابي",
        icon: VideoCamera,
        roles: ["admin", "instructor"],
      },
      {
        to: "/payments",
        label: "المدفوعات والتسجيل",
        icon: Wallet,
        roles: ["admin", "student"],
      },
      {
        to: "/notifications",
        label: "رسائل الغياب",
        icon: Bell,
        roles: ["admin", "guardian"],
      },
      { to: "/certificates", label: "الشهادات", icon: Certificate },
      { to: "/reports", label: "التقارير والإحصاءات", icon: ChartBar },
      {
        to: "/readiness",
        label: "الجاهزية والتشغيل",
        icon: ShieldCheck,
        roles: ["admin"],
      },
      { to: "/announcements", label: "الإعلانات", icon: Megaphone },
      { to: "/communications", label: "البريد والتواصل", icon: Bell },
    ],
  },
  {
    title: "إدارة المنصة",
    items: [
      {
        to: "/website",
        label: "الموقع ومركز الإدارة",
        icon: GearSix,
        roles: ["admin"],
      },
      {
        to: "/users",
        label: "الحسابات والصلاحيات",
        icon: ShieldCheck,
        roles: ["admin"],
      },
      { to: "/settings", label: "الإعدادات والأمان", icon: GearSix },
      {
        to: "/integrations",
        label: "الخدمات والتشغيل",
        icon: Plug,
        roles: ["admin"],
      },
      { to: "/support", label: "المساعدة والدعم", icon: Question },
    ],
  },
];
function ResetPreview() {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button className="text-link" onClick={() => setConfirm(true)}>
        إعادة بيانات العرض
      </button>
      {confirm && (
        <Modal title="إعادة بيانات العرض" onClose={() => setConfirm(false)}>
          <p>
            ستُحذف إضافاتك وملفاتك التجريبية من هذا المتصفح، وتعود بيانات العرض
            الأصلية.
          </p>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("preview.reset", {});
                location.hash = "/";
                location.reload();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            إعادة البيانات التجريبية
          </Button>
        </Modal>
      )}
    </>
  );
}
function Login({
  demo,
  registrationEnabled,
  onLogin,
}: {
  demo: boolean;
  registrationEnabled: boolean;
  onLogin: (u: User) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mfa, setMfa] = useState(false);
  const [register, setRegister] = useState(false);
  const [show, setShow] = useState(false);
  async function demoLogin(role: Role) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ user: User }>("demo", { role });
      onLogin(r.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-art">
        <div className="login-brand">
          <img src={asset("/brand/logo.webp")} alt="شعار تفاصيل" />
          <div>
            تفاصيل<span>مركز تفاصيل للتدريب</span>
          </div>
        </div>
        <div className="login-art-copy">
          <span className="login-pill">
            <GraduationCap size={20} />
            منصة تفاصيل التعليمية
          </span>
          <h1>
            لكل طموح رحلة.
            <br />
            ولكل رحلة، تفاصيل.
          </h1>
          <p>
            مساحة تجمع المعرفة، وتقرّبك من هدفك.
            <br />
            تعلّم، تفاعل، واصنع خطوتك القادمة.
          </p>
        </div>
        <div className="login-photo">
          <img
            src={asset("/images/classroom.webp")}
            alt="قاعة التدريب في مركز تفاصيل"
          />
          <div>
            <BookOpen size={25} weight="duotone" />
            <span>من هنا، تبدأ حكاية تعلّم جديدة.</span>
          </div>
        </div>
        <small className="login-art-foot">
          مركز تفاصيل للتدريب <span>تعلّم يفتح لك آفاقًا جديدة</span>
        </small>
      </div>
      <main className="login-main">
        <a
          className="back-site"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
        >
          موقع المركز
          <ArrowSquareOut size={16} />
        </a>
        <div className="login-form">
          <span className="login-mark">
            <BookOpen size={29} weight="duotone" />
          </span>
          <h2>{mfa ? "خطوة أخيرة لحماية حسابك" : "أهلًا بك في تفاصيل"}</h2>
          <p>
            {mfa
              ? "أدخل الرمز من تطبيق المصادقة على جوالك."
              : isStaticPreview
                ? "اختر حسابًا لتجربة المنصة قبل إطلاقها."
                : "سجّل دخولك، وأكمل رحلتك التعليمية."}
          </p>
          {!isStaticPreview && (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const d = Object.fromEntries(new FormData(e.currentTarget));
                try {
                  const r = await api<{ user?: User; mfaRequired?: boolean }>(
                    mfa ? "login.mfa" : "login",
                    d,
                  );
                  if (r.mfaRequired) setMfa(true);
                  else if (r.user) onLogin(r.user);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {mfa ? (
                <label className="field">
                  <span>رمز التحقق</span>
                  <input
                    name="code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    autoFocus
                    dir="ltr"
                  />
                </label>
              ) : (
                <>
                  <label className="field">
                    <span>اسم المستخدم أو البريد الإلكتروني</span>
                    <input
                      type="text"
                      name="email"
                      required
                      maxLength={190}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="اسم المستخدم أو name@example.com"
                      dir="ltr"
                    />
                  </label>
                  <label className="field">
                    <span>كلمة المرور</span>
                    <div className="password-field">
                      <input
                        type={show ? "text" : "password"}
                        name="password"
                        required
                        autoComplete="current-password"
                        placeholder="أدخل كلمة المرور"
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={
                          show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                        }
                        onClick={() => setShow(!show)}
                      >
                        {show ? <EyeSlash size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </label>
                  <p className="login-help">
                    نسيت كلمة المرور؟{" "}
                    <Link to="/contact">تواصل مع الإدارة لاستعادتها</Link>.
                  </p>
                </>
              )}
              {error && (
                <div className="alert alert-error" role="alert">
                  <WarningCircle size={20} />
                  {error}
                </div>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <SpinnerGap size={20} className="spin" />
                ) : (
                  <>
                    تسجيل الدخول
                    <ArrowLeft size={19} />
                  </>
                )}
              </Button>
            </form>
          )}
          {isStaticPreview && error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          {registrationEnabled && (
            <Button variant="secondary" onClick={() => setRegister(true)}>
              طالب جديد؟ اطلب إنشاء حساب
            </Button>
          )}
          {register && <Registration onClose={() => setRegister(false)} />}
          {isStaticPreview && (
            <a
              className="btn btn-primary"
              href={githubTrialUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              تشغيل التجربة الكاملة على GitHub
              <ArrowSquareOut size={19} />
            </a>
          )}
          <div className="login-security">
            <LockKey size={16} />
            {isStaticPreview
              ? "نسخة عرض عامة • استخدم بيانات وهمية فقط"
              : "دخول محمي • خصوصيتك من أولوياتنا"}
          </div>
          {demo && (
            <div className="demo-login">
              <span>
                {isStaticPreview
                  ? "جرّب المنصة من أربع مساحات مختلفة"
                  : "استكشف النسخة المحلية ببيانات توضيحية"}
              </span>
              <div>
                {(
                  [
                    ["admin", "الإدارة", ShieldCheck],
                    ["instructor", "المدرب", ChalkboardTeacher],
                    ["student", "الطالب", GraduationCap],
                    ["guardian", "ولي الأمر", UserCircle],
                  ] as const
                ).map(([role, label, Icon]) => (
                  <button
                    key={role}
                    onClick={() => demoLogin(role)}
                    disabled={busy}
                  >
                    <Icon size={21} weight="duotone" />
                    {label}
                  </button>
                ))}
              </div>
              <small>هذه حسابات مصطنعة للتجربة، وليست بيانات المركز.</small>
              {isStaticPreview && (
                <>
                  <p className="preview-disclaimer">
                    تُحفظ إضافاتك في هذا المتصفح فقط. لا توجد حسابات حقيقية أو
                    حماية خادم في نسخة العرض، ويُعطّل إدخال الهويات ورفعها.
                  </p>
                  <ResetPreview />
                </>
              )}
            </div>
          )}
        </div>
        <footer>
          © {new Date().getFullYear()} مركز تفاصيل للتدريب. جميع الحقوق محفوظة.
        </footer>
      </main>
    </div>
  );
}
function Shell({
  data,
  user,
  refresh,
  logout,
  notify,
  onWorkspace,
}: {
  onWorkspace: (id: string) => void;
  data: Data;
  user: User;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  notify: (s: string, t?: "success" | "error") => void;
}) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 800px)").matches,
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (mobile && open) {
      sidebarRef.current
        ?.querySelector<HTMLButtonElement>(".mobile-close")
        ?.focus();
      return () => menuToggleRef.current?.focus();
    }
  }, [mobile, open]);
  const [search, setSearch] = useState(false);
  const [term, setTerm] = useState("");
  const [notifications, setNotifications] = useState(false);
  const nav = useNavigate();
  const path = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [path.pathname]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const current = menu
    .flatMap((s) => s.items)
    .find((i) =>
      i.to === "/" ? path.pathname === "/" : path.pathname.startsWith(i.to),
    );
  const results = [
    ...data.courses.map((c) => ({
      title: c.title,
      type: "دورة تدريبية",
      url: `/courses/${c.id}`,
    })),
    ...data.students.map((s) => ({
      title: s.name,
      type: "ملف طالب",
      url: `/students/${s.id}`,
    })),
    ...data.assignments.map((a) => ({
      title: a.title,
      type: "واجب",
      url: "/assignments",
    })),
  ].filter((r) => r.title.includes(term));
  return (
    <Context.Provider value={{ data, user, refresh, notify, logout }}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
          document.getElementById("main")?.scrollIntoView();
        }}
      >
        انتقل إلى المحتوى
      </a>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="platform-sidebar"
        ref={sidebarRef}
        className={`sidebar ${open ? "is-open" : ""}`}
        inert={mobile && !open}
        aria-hidden={mobile && !open ? true : undefined}
        onKeyDown={(e) => {
          if (!mobile || !open) return;
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "Tab") {
            const items = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                "a[href],button:not([disabled])",
              ),
            ].filter((x) => x.offsetParent !== null);
            const first = items[0],
              last = items.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="brand">
          <Link to="/" className="brand-link">
            <div className="brand-logo">
              <img src={asset("/brand/logo.webp")} alt="شعار مركز تفاصيل" />
            </div>
            <div>
              <strong>تفاصيل</strong>
              <span>المنصة التعليمية</span>
            </div>
          </Link>
          <button
            className="icon-btn mobile-close"
            aria-label="إغلاق القائمة"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <GraduationCap size={22} weight="duotone" />
          </span>
          <div>
            <strong>مركز تفاصيل للتدريب</strong>
            <small>{roles[user.role]}</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <nav aria-label="القائمة الرئيسية">
          {menu.map((section) => {
            const items = section.items.filter(
              (i) => !i.roles || i.roles.includes(user.role),
            );
            if (!items.length) return null;
            return (
              <div className="nav-section" key={section.title}>
                <div className="nav-label">{section.title}</div>
                {items.map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.to === "/"}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? "active" : ""}`
                    }
                  >
                    <i.icon
                      size={21}
                      weight={path.pathname === i.to ? "fill" : "regular"}
                    />
                    <span>{i.label}</span>
                    {i.to === "/assignments" &&
                      ["admin", "instructor"].includes(user.role) &&
                      data.submissions.some((s) => s.score === null) && (
                        <small>
                          {
                            data.submissions.filter((s) => s.score === null)
                              .length
                          }
                        </small>
                      )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-support">
          <span>
            <Question size={23} weight="duotone" />
          </span>
          <strong>نحن هنا لمساعدتك</strong>
          <small>خطوة بخطوة، نهتم بالتفاصيل.</small>
          <button onClick={() => nav("/support")}>
            مركز المساعدة
            <ArrowUpLeftIcon />
          </button>
        </div>
        <button className="sidebar-user" onClick={() => nav("/settings")}>
          <Avatar name={user.name} />
          <div>
            <strong>{user.name}</strong>
            <small>{roles[user.role]}</small>
          </div>
          <GearSix size={19} />
        </button>
      </aside>
      <div className="app-area" inert={mobile && open}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn menu-toggle"
              ref={menuToggleRef}
              aria-controls="platform-sidebar"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              aria-label="فتح القائمة"
            >
              <SidebarSimple size={23} />
            </button>
            <span>المنصة التعليمية</span>
            <span className="crumb-divider">/</span>
            <strong>{current?.label ?? "تفاصيل الدورة"}</strong>
          </div>
          <div className="topbar-actions">
            <button className="global-search" onClick={() => setSearch(true)}>
              <MagnifyingGlass size={19} />
              <span>ابحث في المنصة…</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-divider" />
            {user.role === "student" ? (
              <LearningNotificationBell onWorkspace={onWorkspace} />
            ) : (
              <button
                className="icon-btn notification-button"
                onClick={() => setNotifications(true)}
                aria-label="الإشعارات"
              >
                <Bell size={22} />
                {data.announcements.length > 0 && <span />}
              </button>
            )}
            <button
              className="icon-btn"
              onClick={logout}
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
            >
              <SignOut size={21} />
            </button>
            <button
              className="topbar-avatar"
              aria-label="ملفي وإعداداتي"
              onClick={() => nav("/settings")}
            >
              <Avatar name={user.name} size="sm" />
            </button>
          </div>
        </header>
        {data.demo && (
          <div className="preview-strip">
            <span>
              <span className="preview-dot" />
              {isStaticPreview ? "نسخة عرض تجريبية" : "نسخة محلية للتجربة"}
            </span>
            <span>
              {isStaticPreview
                ? "الحفظ في هذا المتصفح فقط • لا تدخل بيانات حقيقية"
                : "البيانات المعروضة توضيحية • لم تُربط بقاعدة المركز"}
            </span>
            {isStaticPreview && <ResetPreview />}
            {isStaticPreview && (
              <a
                href={githubTrialUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                فتح التجربة الكاملة <ArrowSquareOut size={14} />
              </a>
            )}
            <button onClick={logout}>
              تبديل الحساب
              <ArrowLeft size={14} />
            </button>
          </div>
        )}
        {data.mfa_setup_required && (
          <div className="alert">
            يلزم تفعيل المصادقة الثنائية قبل إدارة بيانات الطلاب. افتح تبويب
            الأمان لإكمال التفعيل.
          </div>
        )}
        <main id="main" className="main-content" tabIndex={-1}>
          {data.dataset?.scoped &&
            ["admin", "instructor"].includes(user.role) && (
              <div className="workspace-filter">
                <label htmlFor="workspace-course">نطاق العمل التفصيلي</label>
                <select
                  id="workspace-course"
                  value={data.dataset.course_id}
                  onChange={(e) => {
                    onWorkspace(e.target.value);
                    if (/^\/(courses|students)\//.test(path.pathname))
                      nav("/dashboard");
                  }}
                >
                  <option value="">نظرة عامة</option>
                  {data.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <small>
                  {data.dataset.student_id
                    ? "يعرض ملف الطالب المحدد"
                    : data.dataset.overview
                      ? "اختر دورة لعرض سجلاتها التفصيلية. قوائم الطلاب والتقارير تشمل جميع السجلات عبر صفحاتها."
                      : "السجلات التفصيلية للدورة المحددة؛ التقارير تحسب كامل البيانات."}
                </small>
              </div>
            )}

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/website"
              element={
                user.role === "admin" ? (
                  <Suspense fallback={<p>جارٍ تجهيز مركز الإدارة…</p>}>
                    <WebsiteAdmin />
                  </Suspense>
                ) : (
                  <Empty title="صلاحية إدارية مطلوبة" />
                )
              }
            />
            <Route path="/courses" element={<Courses />} />
            <Route path="/paths" element={<Paths />} />
            <Route
              path="/notebook"
              element={
                user.role !== "guardian" ? (
                  <Notebook />
                ) : (
                  <Empty title="الملاحظات خاصة بالمتدرب" />
                )
              }
            />
            <Route
              path="/readiness"
              element={
                user.role === "admin" ? (
                  <LaunchChecklist />
                ) : (
                  <Empty title="صلاحية إدارية مطلوبة" />
                )
              }
            />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/bags" element={<Bags />} />
            <Route
              path="/videos"
              element={
                ["admin", "instructor"].includes(user.role) ? (
                  <Videos />
                ) : (
                  <Empty title="صلاحية مدرّب مطلوبة" />
                )
              }
            />
            <Route
              path="/payments"
              element={
                ["admin", "student"].includes(user.role) ? (
                  <Payments />
                ) : (
                  <Empty title="هذا السجل للإدارة وصاحب الطلب" />
                )
              }
            />
            <Route
              path="/notifications"
              element={
                ["admin", "guardian"].includes(user.role) ? (
                  <Notifications />
                ) : (
                  <Empty title="هذا السجل للإدارة وولي الأمر" />
                )
              }
            />
            <Route
              path="/integrations"
              element={
                user.role === "admin" ? (
                  <Integrations />
                ) : (
                  <Empty title="صلاحية إدارية مطلوبة" />
                )
              }
            />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/quizzes" element={<Quizzes />} />
            <Route path="/quizzes/attempt/:id" element={<QuizAttempt />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/certificates" element={<Certificates />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/communications" element={<EmailCenter />} />
            <Route
              path="/users"
              element={
                user.role === "admin" ? (
                  <Users />
                ) : (
                  <Empty
                    title="صلاحية إدارية مطلوبة"
                    text="هذه الصفحة مخصصة لإدارة المنصة."
                  />
                )
              }
            />
            <Route path="/settings" element={<Settings />} />
            <Route path="/support" element={<SupportPage />} />
            <Route
              path="*"
              element={
                <Empty
                  title="الصفحة غير موجودة"
                  text="يمكنك متابعة رحلتك من الصفحة الرئيسية."
                  action={
                    <Link className="btn btn-primary" to="/">
                      العودة للرئيسية
                    </Link>
                  }
                />
              }
            />
          </Routes>
        </main>
      </div>
      {search && (
        <Modal title="البحث في المنصة" onClose={() => setSearch(false)}>
          <Search
            value={term}
            onChange={setTerm}
            placeholder="ابحث عن دورة، طالب، أو واجب…"
          />
          <div className="search-results">
            {(term ? results : results.slice(0, 6)).slice(0, 20).map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  setSearch(false);
                  nav(r.url);
                }}
              >
                <span>
                  <strong>{r.title}</strong>
                  <small>{r.type}</small>
                </span>
                <ArrowLeft size={18} />
              </button>
            ))}
            {term && !results.length && (
              <Empty
                title="لا توجد نتائج"
                text="جرّب كلمة أخرى أو جزءًا من الاسم."
              />
            )}
          </div>
        </Modal>
      )}
      {notifications && (
        <Modal title="إعلانات ومستجدات" onClose={() => setNotifications(false)}>
          {data.announcements.length ? (
            data.announcements.map((a) => (
              <div className="notification-item" key={a.id}>
                <span className="update-icon">
                  <Megaphone size={22} />
                </span>
                <div>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="لا توجد إعلانات"
              text="ستظهر هنا تحديثات المركز الجديدة."
            />
          )}
        </Modal>
      )}
    </Context.Provider>
  );
}
function ArrowUpLeftIcon() {
  return <ArrowSquareOut size={16} />;
}
function SessionApp() {
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [demo, setDemo] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: string } | null>(
    null,
  );
  const notify = useCallback(
    (message: string, type = "success") => setToast({ message, type }),
    [],
  );
  const [workspace, setWorkspace] = useState("");
  const dataRequest = useRef(0);
  const courseScope =
    routeLocation.pathname.match(/^\/courses\/([^/]+)$/)?.[1] ?? "";
  const studentScope =
    routeLocation.pathname.match(/^\/students\/([^/]+)$/)?.[1] ?? "";
  const scopeCourse = studentScope ? "" : courseScope || workspace;
  const refresh = useCallback(async () => {
    const request = ++dataRequest.current;
    const result = await get<Data>("data", {
      course_id: scopeCourse,
      student_id: studentScope,
    });
    if (request === dataRequest.current) setData(result);
  }, [scopeCourse, studentScope]);
  useEffect(() => {
    let live = true;
    api<{
      user: User | null;
      csrf: string;
      demo: boolean;
      registration_enabled?: boolean;
    }>("session")
      .then((r) => {
        if (live) {
          setCsrf(r.csrf);
          setUser(r.user);
          setDemo(r.demo);
          setRegistrationEnabled(r.registration_enabled ?? isStaticPreview);
        }
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    const expired = () => {
      setUser(null);
      setData(null);
      notify("انتهت الجلسة. سجّل الدخول مجددًا.", "error");
    };
    window.addEventListener("session-expired", expired);
    return () => {
      live = false;
      window.removeEventListener("session-expired", expired);
    };
  }, [notify]);
  useEffect(() => {
    if (user) {
      setLoading(true);
      refresh()
        .catch((e) => {
          if (e.status !== 401) setError(e.message);
        })
        .finally(() => setLoading(false));
    }
  }, [user, refresh]);
  useEffect(() => {
    if (user && data && routeLocation.pathname === "/login")
      navigate(user.role === "admin" ? "/website" : "/dashboard", {
        replace: true,
      });
  }, [user, data, routeLocation.pathname, navigate]);
  useEffect(() => {
    document.title = "تفاصيل | المنصة التعليمية";
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute("content", "noindex,nofollow");
    if (data?.mfa_setup_required)
      navigate("/settings?tab=security", { replace: true });
  }, [data?.mfa_setup_required, navigate]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 5500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  async function logout() {
    try {
      await api("logout", {});
      setUser(null);
      setData(null);
      navigate("/login", { replace: true });
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  return (
    <>
      {loading ? (
        <div className="loading-screen">
          <img src={asset("/brand/logo.webp")} alt="تفاصيل" />
          <SpinnerGap size={27} className="spin" />
          <p>نجهّز مساحتك التعليمية…</p>
        </div>
      ) : error ? (
        <div className="loading-screen">
          <WarningCircle size={38} />
          <h2>تعذّر الاتصال بالمنصة</h2>
          <p>{error}</p>
          <Button onClick={() => location.reload()}>إعادة المحاولة</Button>
        </div>
      ) : user && data ? (
        <Shell
          data={data}
          user={data.user}
          refresh={refresh}
          logout={logout}
          notify={notify}
          onWorkspace={setWorkspace}
        />
      ) : (
        <Login
          demo={demo}
          registrationEnabled={registrationEnabled}
          onLogin={(u) => {
            setError("");
            setUser(u);
            navigate(
              routeLocation.pathname !== "/login"
                ? routeLocation.pathname + routeLocation.search
                : u.role === "admin"
                  ? "/website"
                  : "/dashboard",
              { replace: true },
            );
          }}
        />
      )}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          {toast.type === "success" ? (
            <CheckCircle size={22} weight="fill" />
          ) : (
            <WarningCircle size={22} />
          )}
          <span>{toast.message}</span>
          <button aria-label="إغلاق التنبيه" onClick={() => setToast(null)}>
            <X size={17} />
          </button>
        </div>
      )}
    </>
  );
}

function ApplicationRoutes() {
  const { pathname } = useLocation();
  if (pathname === "/activate")
    return (
      <Suspense fallback={<div className="loading-screen">جارٍ فتح دعوتك…</div>}>
        <AccountActivation />
      </Suspense>
    );
  const platform =
    /^\/(login|dashboard|website|paths|notebook|readiness|communications|courses|catalog|bags|videos|payments|notifications|integrations|students|assignments|quizzes|schedule|attendance|files|certificates|reports|announcements|users|settings|support)(\/|$)/.test(
      pathname,
    );
  return isStaticPreview || platform ? (
    <SessionApp />
  ) : (
    <Suspense
      fallback={
        <div className="loading-screen">
          <p>أهلًا بك في تفاصيل…</p>
        </div>
      }
    >
      <PublicSite />
    </Suspense>
  );
}
export default function App() {
  const Router = isStaticPreview ? HashRouter : BrowserRouter;
  return (
    <Router>
      <ApplicationRoutes />
    </Router>
  );
}
