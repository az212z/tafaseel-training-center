import { asset } from "../environment";
import { Link } from "react-router-dom";
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
  GraduationCap,
  Plus,
  GearSix,
} from "@phosphor-icons/react";
import { useApp, ar, date, time, progressPercent } from "../context";
import type { Course } from "../types";
import {
  Panel,
  PageHead,
  Progress,
  Avatar,
  Empty,
  Button,
} from "../components/ui";
import { CourseForm } from "../components/forms";
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
        <img src={asset(course.image)} alt="" loading="lazy" />
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
          {user.role !== "student" && (
            <span>
              <UsersThree size={15} />
              {ar(course.students_count)}
            </span>
          )}
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
  const [newCourse, setNewCourse] = useState(false);
  const admin = user.role === "admin";
  const teacher = user.role === "instructor";
  const student = user.role === "student";
  const active = data.courses.filter((course) => course.status === "published");
  const courses = teacher
    ? data.courses.filter((course) => course.status !== "archived")
    : active;
  const incomplete = data.lessons.find(
    (lesson) =>
      active.some((course) => course.id === lesson.course_id) &&
      !data.progress.some(
        (done) => done.lesson_id === lesson.id && done.student_id === user.id,
      ),
  );
  const upcoming = data.classes
    .filter((lesson) => Date.parse(lesson.ends_at) > Date.now())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 4);
  const pending =
    data.statistics?.pending ??
    data.submissions.filter((submission) => submission.score === null).length;
  const shortcuts = admin
    ? [
        { title: "طلبات التسجيل", to: "/registrations", icon: ClipboardText },
        { title: "إدارة الحسابات", to: "/users", icon: UsersThree },
        { title: "إدارة الموقع", to: "/website", icon: GearSix },
        { title: "التقارير", to: "/reports", icon: ChartLineUp },
      ]
    : teacher
      ? [
          { title: "إدارة دروسي", to: "/courses", icon: BookOpen },
          {
            title: pending
              ? "واجبات للتصحيح (" + ar(pending) + ")"
              : "الواجبات",
            to: "/assignments",
            icon: ClipboardText,
          },
          { title: "إدارة الحصص", to: "/schedule", icon: VideoCamera },
          { title: "رصد الحضور", to: "/attendance", icon: CheckCircle },
        ]
      : [
          { title: "الواجبات", to: "/assignments", icon: ClipboardText },
          { title: "الاختبارات", to: "/quizzes", icon: CheckCircle },
          {
            title: student ? "طلباتي" : "الأبناء",
            to: student ? "/registrations" : "/students",
            icon: student ? BookOpen : UsersThree,
          },
          { title: "الشهادات", to: "/certificates", icon: GraduationCap },
        ];
  return (
    <>
      <PageHead
        title={
          admin
            ? "لوحة الإدارة"
            : teacher
              ? "لوحة المعلم"
              : student
                ? "مساحتي التعليمية"
                : "متابعة الأبناء"
        }
      >
        {admin && (
          <Button onClick={() => setNewCourse(true)}>
            <Plus size={18} /> إضافة دورة
          </Button>
        )}
        {student && (
          <Link className="btn btn-secondary" to="/programs">
            استعراض الدورات
          </Link>
        )}
      </PageHead>
      {student && incomplete && (
        <section className="resume-panel">
          <div>
            <span>درسُك التالي</span>
            <h2>{incomplete.title}</h2>
            <p>
              {
                active.find((course) => course.id === incomplete.course_id)
                  ?.title
              }
            </p>
          </div>
          <Link
            to={`/courses/${incomplete.course_id}?lesson=${incomplete.id}`}
            className="btn btn-primary"
          >
            تابع التعلّم <ArrowLeft size={17} />
          </Link>
        </section>
      )}
      <nav className="workspace-shortcuts" aria-label="إجراءات سريعة">
        {shortcuts.map(({ title, to, icon: Icon }) => (
          <Link key={to} to={to}>
            <Icon size={22} />
            <span>{title}</span>
            <ArrowUpLeft size={16} />
          </Link>
        ))}
      </nav>
      <div className="dashboard-grid">
        <Panel
          title={admin ? "الدورات المنشورة" : "دوراتي"}
          className="courses-panel"
          action={
            <Link className="text-link" to="/courses">
              عرض الكل
            </Link>
          }
        >
          {courses.length ? (
            <div className="course-grid dashboard-courses">
              {courses.slice(0, 4).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <Empty
              title={admin ? "لا توجد دورات منشورة" : "لا توجد دورات في حسابك"}
              action={
                student ? (
                  <Link className="btn btn-primary" to="/programs">
                    اختر دورة
                  </Link>
                ) : undefined
              }
            />
          )}
        </Panel>
        <Panel
          title="الحصص القادمة"
          action={
            <Link className="text-link" to="/schedule">
              الجدول
            </Link>
          }
        >
          {upcoming.length ? (
            <div className="simple-list">
              {upcoming.map((lesson) => (
                <Link
                  key={lesson.id}
                  to={"/schedule?course=" + lesson.course_id}
                >
                  <CalendarBlank size={22} />
                  <div>
                    <strong>{lesson.title}</strong>
                    <p>
                      {date(lesson.starts_at)} · {time(lesson.starts_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="لا توجد حصص قادمة" />
          )}
        </Panel>
      </div>
      {newCourse && <CourseForm onClose={() => setNewCourse(false)} />}
    </>
  );
}
