import { useEffect, useState, useCallback } from "react";
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
import {
  SquaresFour,
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
import { api, setCsrf } from "./api";
import { asset, isStaticPreview } from "./environment";
import { Context, roles } from "./context";
import type { Data, User, Role } from "./types";
import { Avatar, Button, Modal, Search, Empty } from "./components/ui";
import Dashboard from "./pages/Dashboard";
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
const menu: {
  title: string;
  items: { to: string; label: string; icon: Icon; roles?: Role[] }[];
}[] = [
  {
    title: "مساحة التعلم",
    items: [
      { to: "/", label: "نظرة عامة", icon: SquaresFour },
      { to: "/courses", label: "الدورات التدريبية", icon: BookOpen },
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
      { to: "/certificates", label: "الشهادات", icon: Certificate },
      { to: "/reports", label: "التقارير والإحصاءات", icon: ChartBar },
      { to: "/announcements", label: "الإعلانات", icon: Megaphone },
    ],
  },
  {
    title: "إدارة المنصة",
    items: [
      {
        to: "/users",
        label: "الحسابات والصلاحيات",
        icon: ShieldCheck,
        roles: ["admin"],
      },
      { to: "/settings", label: "الإعدادات والأمان", icon: GearSix },
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
  onLogin,
}: {
  demo: boolean;
  onLogin: (u: User) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mfa, setMfa] = useState(false);
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
        <Link
          className="back-site"
          to="/"
          onClick={(e) => {
            e.preventDefault();
            window.open(
              "https://tafaseel-training.com/",
              "_blank",
              "noopener,noreferrer",
            );
          }}
        >
          موقع المركز
          <ArrowSquareOut size={16} />
        </Link>
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
                    <span>البريد الإلكتروني</span>
                    <input
                      type="email"
                      name="email"
                      required
                      autoComplete="username"
                      placeholder="name@example.com"
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
                    نسيت كلمة المرور؟ تواصل مع إدارة المركز لاستعادتها.
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
}: {
  data: Data;
  user: User;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  notify: (s: string, t?: "success" | "error") => void;
}) {
  const [open, setOpen] = useState(false);
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
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link to="/" className="brand">
          <div className="brand-logo">
            <img src={asset("/brand/logo.webp")} alt="شعار مركز تفاصيل" />
          </div>
          <div>
            <strong>تفاصيل</strong>
            <span>المنصة التعليمية</span>
          </div>
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
        </Link>
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
      <div className="app-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn menu-toggle"
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
            <button
              className="icon-btn notification-button"
              onClick={() => setNotifications(true)}
              aria-label="الإشعارات"
            >
              <Bell size={22} />
              {data.announcements.length > 0 && <span />}
            </button>
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
            <button onClick={logout}>
              تبديل الحساب
              <ArrowLeft size={14} />
            </button>
          </div>
        )}
        <main id="main" className="main-content" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/courses" element={<Courses />} />
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
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: string } | null>(
    null,
  );
  const notify = useCallback(
    (message: string, type = "success") => setToast({ message, type }),
    [],
  );
  const refresh = useCallback(async () => {
    const result = await api<Data>("data");
    setData(result);
  }, []);
  useEffect(() => {
    let live = true;
    api<{ user: User | null; csrf: string; demo: boolean }>("session")
      .then((r) => {
        if (live) {
          setCsrf(r.csrf);
          setUser(r.user);
          setDemo(r.demo);
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
      navigate("/", { replace: true });
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  return (
    <>
      {loading ? (
        <div className="loading-screen">
          <img src="/brand/logo.webp" alt="تفاصيل" />
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
          user={user}
          refresh={refresh}
          logout={logout}
          notify={notify}
        />
      ) : (
        <Login
          demo={demo}
          onLogin={(u) => {
            setError("");
            setUser(u);
            navigate("/", { replace: true });
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

export default function App() {
  const Router = isStaticPreview ? HashRouter : BrowserRouter;
  return (
    <Router>
      <SessionApp />
    </Router>
  );
}
