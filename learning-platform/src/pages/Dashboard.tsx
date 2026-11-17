import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowUpLeft,
  ArrowLeft,
  UsersThree,
  BookOpen,
  ClipboardText,
  CalendarBlank,
  Clock,
  VideoCamera,
  ChartLineUp,
  CheckCircle,
  SunHorizon,
  GraduationCap,
  Plus,
  DotsThree,
} from "@phosphor-icons/react";
import { useApp, ar, date, time, progressPercent } from "../context";
import type { Course } from "../types";
import {
  Panel,
  PageHead,
  MoreLink,
  Progress,
  Avatar,
  Badge,
  Empty,
  Button,
} from "../components/ui";
import { CourseForm, ClassForm } from "../components/forms";
export function CourseCard({ course }: { course: Course }) {
  const { data, user } = useApp();
  const value = progressPercent(
    data,
    course.id,
    user.role === "student" ? user.id : undefined,
  );
  return (
    <Link to={`/courses/${course.id}`} className="course-card">
      <div className="course-cover">
        <img src={course.image} alt="" loading="lazy" />
        <span className="course-category">{course.category}</span>
        <span className="cover-action">
          <ArrowUpLeft size={20} />
        </span>
      </div>
      <div className="course-card-body">
        <h3>{course.title}</h3>
        <div className="course-teacher">
          <Avatar size="sm" name={course.instructor_name ?? "فريق تفاصيل"} />
          <span>{course.instructor_name ?? "يحدد لاحقًا"}</span>
        </div>
        <div className="course-meta">
          <span>
            <BookOpen size={15} />
            {ar(course.lessons_count)} دروس
          </span>
          <span>
            <Clock size={15} />
            {ar(course.duration)} ساعة
          </span>
          <span>
            <UsersThree size={15} />
            {ar(course.students_count)}
          </span>
        </div>
        <div className="course-progress-label">
          <span>
            {user.role === "student" ? "تقدمك في الدورة" : "متوسط إنجاز الطلاب"}
          </span>
          <strong>{ar(value)}٪</strong>
        </div>
        <Progress value={value} />
      </div>
    </Link>
  );
}
export default function Dashboard() {
  const { data, user } = useApp();
  const nav = useNavigate();
  const [modal, setModal] = useState("");
  const staff = ["admin", "instructor"].includes(user.role);
  const current = new Date();
  const today = data.classes.filter(
    (c) =>
      date(c.starts_at, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }) ===
      date(current.toISOString(), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
  );
  const upcoming = data.classes
    .filter((c) => new Date(c.ends_at) > current)
    .slice(0, 3);
  const pending = data.submissions.filter((s) => s.score === null).length;
  const submitted = data.submissions.filter((s) => s.student_id === user.id);
  const progressCourses = data.courses.filter(
    (c) => c.status === "published" && c.lessons_count > 0,
  );
  const totalProgress = progressCourses.length
    ? Math.round(
        progressCourses.reduce(
          (n, c) =>
            n +
            progressPercent(
              data,
              c.id,
              user.role === "student" ? user.id : undefined,
            ),
          0,
        ) / progressCourses.length,
      )
    : 0;
  const attendance = data.attendance.length
    ? Math.round(
        (data.attendance.filter((a) => ["present", "late"].includes(a.status))
          .length /
          data.attendance.length) *
          100,
      )
    : 0;
  const cards = staff
    ? [
        {
          label: "إجمالي الطلاب",
          value: data.students.length,
          icon: UsersThree,
          tone: "mint",
          detail: "طلاب مسجلون في المنصة",
          route: "/students",
        },
        {
          label: "الدورات النشطة",
          value: data.courses.filter((c) => c.status === "published").length,
          icon: BookOpen,
          tone: "blue",
          detail: `من أصل ${ar(data.courses.length)} دورة تدريبية`,
          route: "/courses",
        },
        {
          label: "واجبات بانتظار التقييم",
          value: pending,
          icon: ClipboardText,
          tone: "sand",
          detail: "تسليمات تحتاج إلى مراجعتك",
          route: "/assignments",
        },
        {
          label: "حصص اليوم",
          value: today.length,
          icon: VideoCamera,
          tone: "rose",
          detail: "في جدولك التدريبي اليوم",
          route: "/schedule",
        },
      ]
    : [
        {
          label: "دوراتي التدريبية",
          value: data.courses.length,
          icon: BookOpen,
          tone: "mint",
          detail: "استكمل رحلتك التعليمية",
          route: "/courses",
        },
        {
          label: "نسبة الحضور",
          value: attendance,
          icon: CheckCircle,
          tone: "blue",
          detail: "من الحصص التي رُصدت",
          route: "/attendance",
        },
        {
          label: "الواجبات المسلّمة",
          value: submitted.length,
          icon: ClipboardText,
          tone: "sand",
          detail: "تابع ملاحظات مدربك",
          route: "/assignments",
        },
        {
          label: "شهاداتي",
          value: data.certificates.length,
          icon: GraduationCap,
          tone: "rose",
          detail: "إنجازاتك تستحق أن تُحفظ",
          route: "/certificates",
        },
      ];
  const active = data.courses
    .filter((c) => c.status === "published")
    .slice(0, 4);
  const recent = data.audit?.slice(0, 4);
  return (
    <>
      <PageHead
        title={staff ? "نظرة عامة" : "مساحتي التعليمية"}
        subtitle={date(current.toISOString(), {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      >
        {staff ? (
          <Button onClick={() => setModal("course")}>
            <Plus size={18} />
            إضافة دورة جديدة
          </Button>
        ) : (
          <Button onClick={() => nav("/courses")}>
            متابعة التعلم
            <ArrowLeft size={17} />
          </Button>
        )}
      </PageHead>
      <div className="welcome-banner">
        <div className="welcome-text">
          <span className="welcome-eyebrow">
            <SunHorizon size={21} weight="duotone" />
            كل يوم، خطوة نحو أثر أكبر
          </span>
          <h2>
            أهلًا بك،{" "}
            {user.role === "admin" ? "في تفاصيل" : user.name.split(" ")[0]}
            <span className="greeting-dot">.</span>
          </h2>
          <p>
            {staff
              ? "تعليم يصنع الفرق، وإدارة تهتم بكل التفاصيل."
              : "رحلتك تبدأ بخطوة، وتكبر بكل درس تتعلمه."}
            <br />
            {staff
              ? "إليك ما يحدث في منصتك التعليمية اليوم."
              : "دوراتك ومواعيدك وإنجازاتك، كلها هنا."}
          </p>
          <button className="welcome-link" onClick={() => nav("/schedule")}>
            استعرض جدولك التدريبي
            <ArrowLeft size={17} />
          </button>
        </div>
        <div className="welcome-visual" aria-hidden="true">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="floating-book">
            <BookOpen size={67} weight="duotone" />
          </div>
          <span className="visual-note note-one">
            <GraduationCap size={22} />
            تعلمٌ يبقى أثره
          </span>
          <span className="visual-note note-two">
            <span className="small-check">
              <CheckCircle size={19} weight="fill" />
            </span>
            نهتم بكل التفاصيل
          </span>
          <span className="spark spark-one">+</span>
          <span className="spark spark-two">+</span>
        </div>
        <div className="welcome-date">
          <span>{ar(current.getDate())}</span>
          <small>{date(current.toISOString(), { month: "long" })}</small>
        </div>
      </div>
      <div className="stats-grid">
        {cards.map((c) => (
          <button
            className="stat-card"
            key={c.label}
            onClick={() => nav(c.route)}
          >
            <div className="row-between">
              <span className={`stat-icon ${c.tone}`}>
                <c.icon size={25} weight="duotone" />
              </span>
              <ArrowUpLeft size={18} className="muted" />
            </div>
            <div className="stat-value">
              {ar(c.value)}
              {c.label.includes("نسبة") && <small>٪</small>}
            </div>
            <div className="stat-title">{c.label}</div>
            <div className="stat-detail">{c.detail}</div>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel
          title="الدورات التدريبية"
          description={
            staff
              ? "نظرة على الدورات المنشورة وتقدّم طلابها"
              : "واصل من حيث توقفت، اقترب من هدفك"
          }
          action={<MoreLink onClick={() => nav("/courses")} />}
          className="courses-panel"
        >
          <div className="course-grid dashboard-courses">
            {active.map((c) => (
              <CourseCard course={c} key={c.id} />
            ))}
          </div>
          {!active.length && (
            <Empty
              title="رحلة تعليمية جديدة بانتظارك"
              text={
                staff
                  ? "أضف دورتك الأولى وابدأ بإعداد دروسها."
                  : "ستظهر دوراتك بعد تسجيلك من إدارة المركز."
              }
            />
          )}
        </Panel>
        <div className="dashboard-aside">
          <Panel
            title="جدولك القادم"
            action={<CalendarBlank size={20} className="muted" />}
          >
            <div className="agenda-days">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i - 2);
                return (
                  <div className={i === 2 ? "selected" : ""} key={i}>
                    <small>{date(d.toISOString(), { weekday: "short" })}</small>
                    <strong>{ar(d.getDate())}</strong>
                    <span />
                  </div>
                );
              })}
            </div>
            <div className="agenda-items">
              {upcoming.length ? (
                upcoming.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => nav("/schedule")}
                    className="agenda-item"
                  >
                    <div className="agenda-time">
                      <span>{time(c.starts_at)}</span>
                      <small>{date(c.starts_at)}</small>
                    </div>
                    <div className="agenda-line" />
                    <div>
                      <h3>{c.title}</h3>
                      <p>
                        {data.courses.find((x) => x.id === c.course_id)?.title}
                      </p>
                      <span>
                        <VideoCamera size={14} />
                        {c.location}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="compact-empty">لا توجد حصص قادمة حاليًا.</div>
              )}
            </div>
            <button
              className="agenda-footer"
              onClick={() => (staff ? setModal("class") : nav("/schedule"))}
            >
              {staff ? (
                <>
                  <Plus size={16} />
                  جدولة حصة جديدة
                </>
              ) : (
                <>
                  الجدول التدريبي
                  <ArrowLeft size={16} />
                </>
              )}
            </button>
          </Panel>
          <Panel title="رحلة الإنجاز" description="كل خطوة تُحدث فرقًا">
            <div className="achievement-row">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(#2d7970 ${totalProgress}%,#eaf1ee 0)`,
                }}
              >
                <div>
                  <strong>
                    {ar(totalProgress)}
                    <small>٪</small>
                  </strong>
                  <span>متوسط الإنجاز</span>
                </div>
              </div>
              <div className="achievement-key">
                <p>
                  <span className="legend-dot green" />
                  الدروس المكتملة
                </p>
                <strong>
                  {ar(data.progress.length)} <small>إكمال مسجل</small>
                </strong>
                <p>
                  <span className="legend-dot gray" />
                  الدورات المنشورة
                </p>
                <strong>
                  {ar(active.length)} <small>دورات تدريبية</small>
                </strong>
              </div>
            </div>
          </Panel>
        </div>
        <Panel
          title="آخر المستجدات"
          action={<MoreLink onClick={() => nav("/announcements")} />}
        >
          <div className="updates-list">
            {data.announcements.slice(0, 2).map((a) => (
              <div className="update-item" key={a.id}>
                <span className="update-icon">
                  <ClipboardText size={21} weight="duotone" />
                </span>
                <div>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                  <small>
                    {date(a.created_at)} <span>•</span> {a.author_name}
                  </small>
                </div>
                <Badge tone="green">إعلان</Badge>
              </div>
            ))}
          </div>
          {!data.announcements.length && (
            <div className="compact-empty">ستظهر إعلانات المركز هنا.</div>
          )}
        </Panel>
        <Panel
          title={staff ? "المنصة بالأرقام" : "قريب من هدفك"}
          action={<ChartLineUp size={20} className="muted" />}
        >
          <div className="mini-metrics">
            <div>
              <span>نسبة الحضور المرصود</span>
              <strong>{ar(attendance)}٪</strong>
            </div>
            <Progress value={attendance} />
            <div>
              <span>الواجبات التي تم تقييمها</span>
              <strong>
                {ar(data.submissions.filter((s) => s.score !== null).length)}
              </strong>
            </div>
            <div>
              <span>الشهادات الصادرة</span>
              <strong>{ar(data.certificates.length)}</strong>
            </div>
          </div>
          {recent && (
            <button
              className="audit-link"
              onClick={() => nav("/settings?tab=audit")}
            >
              <DotsThree size={20} />
              عرض سجل عمليات المنصة
              <ArrowLeft size={16} />
            </button>
          )}
        </Panel>
      </div>
      <div className="dashboard-bottom">
        <CheckCircle size={16} />
        <span>اهتمام بالتعلّم. عناية بالتفاصيل.</span>
        <span>مركز تفاصيل للتدريب</span>
      </div>
      {modal === "course" && <CourseForm onClose={() => setModal("")} />}
      {modal === "class" && <ClassForm onClose={() => setModal("")} />}
    </>
  );
}
