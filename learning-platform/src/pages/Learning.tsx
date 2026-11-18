import { CourseCommunity, CourseSurvey, LessonNotebook } from "./LearningTools";
import { asset, isStaticPreview } from "../environment";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BookOpen,
  UsersThree,
  Clock,
  PlayCircle,
  FileText,
  CheckCircle,
  ArrowRight,
  PencilSimple,
  Plus,
  DownloadSimple,
  Exam,
  ClipboardText,
  LockKey,
  UserPlus,
} from "@phosphor-icons/react";
import { useApp, ar, progressPercent } from "../context";
import { api, get, fileUrl } from "../api";
import type { Lesson } from "../types";
import {
  PageHead,
  Panel,
  Search,
  Empty,
  Button,
  Badge,
  Status,
  Modal,
  Progress,
  Table,
  Avatar,
} from "../components/ui";
import {
  CourseForm,
  LessonForm,
  AssignmentForm,
  QuizForm,
  EnrollForm,
} from "../components/forms";
import { CourseCard } from "./Dashboard";
export function Courses() {
  const { data, user } = useApp();
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [add, setAdd] = useState(false);
  const courses = data.courses.filter(
    (c) =>
      c.title.includes(term) &&
      (!category || c.category === category) &&
      (!status || c.status === status),
  );
  return (
    <>
      <PageHead
        title={
          ["student", "guardian"].includes(user.role)
            ? "دوراتي التدريبية"
            : "الدورات التدريبية"
        }
        subtitle="كل دورة، فرصة جديدة لتعلّم يصنع الفرق."
      >
        {user.role === "admin" && (
          <Button onClick={() => setAdd(true)}>
            <Plus size={18} />
            إضافة دورة
          </Button>
        )}
      </PageHead>
      <div className="filter-bar">
        <Search
          value={term}
          onChange={setTerm}
          placeholder="ابحث عن دورة تدريبية…"
        />
        <select
          aria-label="المسار التدريبي"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">جميع المسارات</option>
          {[...new Set(data.courses.map((c) => c.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {["admin", "instructor"].includes(user.role) && (
          <select
            aria-label="حالة الدورة"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">جميع الحالات</option>
            <option value="published">منشورة</option>
            <option value="draft">مسودة</option>
            <option value="archived">مؤرشفة</option>
          </select>
        )}
        <span className="results-count">{ar(courses.length)} دورة</span>
      </div>
      <div className="course-grid all-courses">
        {courses.map((c) => (
          <div key={c.id} className="course-list-wrap">
            <CourseCard course={c} />
            {["admin", "instructor"].includes(user.role) && (
              <div className="course-status">
                <Status value={c.status} />
              </div>
            )}
          </div>
        ))}
      </div>
      {!courses.length && (
        <Empty
          title="لا توجد دورات مطابقة"
          text="جرّب تغيير البحث أو المسار. ستظهر دوراتك بعد تسجيلك من المركز."
        />
      )}
      {add && <CourseForm onClose={() => setAdd(false)} />}
    </>
  );
}
export function LessonViewer({
  lesson,
  onClose,
}: {
  lesson: Lesson;
  onClose: () => void;
}) {
  const { data, user, refresh, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const completed = data.progress.some(
    (p) => p.lesson_id === lesson.id && p.student_id === user.id,
  );
  const [lessonBody, setLessonBody] = useState(lesson.body);
  const [bodyError, setBodyError] = useState("");
  useEffect(() => {
    let live = true;
    get<{ lesson: Lesson }>("lesson", { id: lesson.id })
      .then((r) => {
        if (live) setLessonBody(r.lesson.body);
      })
      .catch((e) => {
        if (live) setBodyError(e.message);
      });
    return () => {
      live = false;
    };
  }, [lesson.id]);
  const [cloudEmbed, setCloudEmbed] = useState("");
  const [cloudError, setCloudError] = useState("");
  useEffect(() => {
    let live = true;
    if (lesson.video_asset_id)
      get<{ url: string }>("video.play", { lesson_id: lesson.id })
        .then((r) => {
          if (live) setCloudEmbed(r.url);
        })
        .catch((e) => {
          if (live) setCloudError(e.message);
        });
    return () => {
      live = false;
    };
  }, [lesson.id, lesson.video_asset_id]);
  let embed = cloudEmbed;
  if (lesson.video_url) {
    try {
      const url = new URL(lesson.video_url);
      if (url.hostname.includes("youtu")) {
        const id =
          url.hostname === "youtu.be"
            ? url.pathname.slice(1)
            : url.searchParams.get("v") || url.pathname.split("/").pop();
        if (id && /^[\w-]{11}$/.test(id))
          embed = `https://www.youtube-nocookie.com/embed/${id}`;
      } else if (url.hostname.endsWith("vimeo.com")) {
        const id = url.pathname.split("/").pop();
        if (id && /^\d+$/.test(id))
          embed = `https://player.vimeo.com/video/${id}`;
      }
    } catch {
      /* URL validated by API. */
    }
  }
  return (
    <Modal title={lesson.title} onClose={onClose} wide>
      <div className="lesson-meta">
        <Badge tone="green">
          {lesson.kind === "video"
            ? "فيديو مسجل"
            : lesson.kind === "file"
              ? "ملف تدريبي"
              : "درس نصّي"}
        </Badge>
        <span>
          <Clock size={16} />
          {ar(lesson.duration)} دقيقة
        </span>
      </div>
      {lesson.kind === "video" &&
        (embed ? (
          <iframe
            className="video-frame"
            src={embed}
            title={lesson.title}
            allow="fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : lesson.file_id ? (
          <video
            className="video-frame"
            ref={setVideo}
            controls
            preload="metadata"
            src={fileUrl(lesson.file_id)}
          />
        ) : (
          <div className="alert">
            {cloudError ||
              (lesson.video_asset_id
                ? "جارٍ تجهيز رابط التشغيل…"
                : "أضف رابط تشغيل صالحًا للفيديو من إدارة الدورة.")}
          </div>
        ))}
      {bodyError && (
        <div className="alert alert-error" role="alert">
          {bodyError}
        </div>
      )}
      {lessonBody && <div className="lesson-body">{lessonBody}</div>}
      {lesson.file_id && lesson.kind !== "video" && (
        <a href={fileUrl(lesson.file_id)} className="btn btn-secondary">
          <DownloadSimple size={19} />
          تنزيل ملف الدرس
        </a>
      )}
      {user.role !== "guardian" && (
        <LessonNotebook lessonId={lesson.id} video={video} />
      )}
      {user.role === "student" && (
        <div className="lesson-footer">
          <Button
            disabled={completed || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("progress", { lesson_id: lesson.id });
                await refresh();
                notify("أحسنت! تم تسجيل إكمال الدرس.");
              } catch (e) {
                notify((e as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckCircle size={20} />
            {completed ? "أكملت هذا الدرس" : "تمّ، أكملت هذا الدرس"}
          </Button>
          <small>يُسجل الإكمال عند تأكيدك إنهاء المحتوى.</small>
        </div>
      )}
    </Modal>
  );
}
export function CourseDetail() {
  const { id } = useParams();
  const { data, user } = useApp();
  const [tab, setTab] = useState("lessons");
  const [modal, setModal] = useState("");
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const c = data.courses.find((c) => c.id === id);
  if (!c)
    return (
      <Empty
        title="الدورة غير متاحة"
        text="تحقق من تسجيلك في الدورة أو ارجع إلى مكتبة الدورات."
        action={
          <Link to="/courses" className="btn btn-primary">
            مكتبة الدورات
          </Link>
        }
      />
    );
  const staff = ["admin", "instructor"].includes(user.role);
  const lessons = data.lessons.filter((l) => l.course_id === id);
  const students = data.students.filter((s) =>
    data.enrollments.some((e) => e.student_id === s.id && e.course_id === id),
  );
  const tabs = [
    ["lessons", "المحتوى التدريبي"],
    ["students", staff ? "الطلاب المسجلون" : "التقدّم"],
    ["assignments", "الواجبات"],
    ["quizzes", "الاختبارات"],
    ["files", "الملفات"],
    ["community", "النقاشات"],
    ["survey", "تقييم التجربة"],
  ];
  return (
    <>
      <Link to="/courses" className="back-link">
        <ArrowRight size={17} />
        الدورات التدريبية
      </Link>
      <div className="course-hero">
        <div>
          <div className="inline-badges">
            <Badge tone="green">{c.category}</Badge>
            <Status value={c.status} />
          </div>
          <h1>{c.title}</h1>
          <p>{c.description}</p>
          <div className="course-hero-meta">
            <span>
              <Avatar name={c.instructor_name ?? "تفاصيل"} size="sm" />
              {c.instructor_name ?? "يحدد المدرب لاحقًا"}
            </span>
            <span>
              <Clock size={18} />
              {ar(c.duration)} ساعة
            </span>
            <span>
              <BookOpen size={18} />
              {ar(lessons.length)} دروس
            </span>
            <span>
              <UsersThree size={18} />
              {ar(c.students_count)} / {ar(c.capacity)} طالب
            </span>
          </div>
          {staff && (
            <div className="head-actions">
              <Button variant="secondary" onClick={() => setModal("edit")}>
                <PencilSimple size={18} />
                تعديل الدورة
              </Button>
              {user.role === "admin" && (
                <Button onClick={() => setModal("enroll")}>
                  <UserPlus size={18} />
                  تسجيل طالب
                </Button>
              )}
            </div>
          )}
        </div>
        <img src={asset(c.image)} alt="غلاف الدورة" />
      </div>
      <div className="tabs" role="tablist" aria-label="أقسام الدورة">
        {tabs.map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
            {!["community", "survey"].includes(key) && (
              <span>
                {ar(
                  key === "lessons"
                    ? lessons.length
                    : key === "students"
                      ? students.length
                      : key === "assignments"
                        ? data.assignments.filter((a) => a.course_id === id)
                            .length
                        : key === "quizzes"
                          ? data.quizzes.filter((q) => q.course_id === id)
                              .length
                          : data.files.filter(
                              (f) =>
                                f.course_id === id && f.purpose === "resource",
                            ).length,
                )}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === "community" && <CourseCommunity courseId={c.id} />}
      {tab === "survey" && <CourseSurvey courseId={c.id} />}
      <div className="course-resource-links">
        <Link className="text-link" to={`/bags?course=${id}`}>
          فتح الحقيبة التعليمية للمادة
        </Link>
      </div>
      {tab === "lessons" && (
        <Panel
          title="محتوى الدورة"
          description="خطوات متتابعة في رحلة تعلّمك"
          action={
            staff && (
              <Button onClick={() => setModal("lesson")}>
                <Plus size={17} />
                إضافة درس
              </Button>
            )
          }
        >
          {lessons.length ? (
            <div className="lesson-list">
              {lessons.map((l, i) => {
                const done = data.progress.some(
                  (p) => p.lesson_id === l.id && p.student_id === user.id,
                );
                const Icon =
                  l.kind === "video"
                    ? PlayCircle
                    : l.kind === "file"
                      ? FileText
                      : BookOpen;
                return (
                  <button
                    className="lesson-row"
                    key={l.id}
                    onClick={() => setLesson(l)}
                  >
                    <span className="lesson-number">
                      {ar(i + 1).padStart(2, "٠")}
                    </span>
                    <span className={`lesson-icon ${done ? "done" : ""}`}>
                      {done ? (
                        <CheckCircle size={24} weight="fill" />
                      ) : (
                        <Icon size={24} weight="duotone" />
                      )}
                    </span>
                    <span className="lesson-title">
                      <strong>{l.title}</strong>
                      <small>
                        {l.kind === "video"
                          ? "فيديو مسجل"
                          : l.kind === "file"
                            ? "ملف تدريبي"
                            : "درس نصّي"}
                      </small>
                    </span>
                    <span className="lesson-duration">
                      {ar(l.duration)} دقيقة
                    </span>
                    <span className="text-link">
                      {done ? "مراجعة الدرس" : "عرض الدرس"}
                      <ArrowRight size={16} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title="نجهّز محتوى هذه الدورة"
              text={
                staff
                  ? "أضف درسًا نصيًا، ملفًا تدريبيًا، أو فيديو مسجلًا."
                  : "سيظهر المحتوى بعد إضافته من مدربك."
              }
            />
          )}
        </Panel>
      )}
      {tab === "students" && (
        <Panel
          title={staff ? "الطلاب المسجلون" : "تقدم الطلاب المرتبطين بحسابك"}
        >
          <Table
            headers={[
              "الطالب",
              "البريد الإلكتروني",
              "إنجاز الدروس",
              "ملف الطالب",
            ]}
          >
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="person-cell">
                    <Avatar name={s.name} />
                    <strong>{s.name}</strong>
                  </div>
                </td>
                <td dir="ltr">{s.email}</td>
                <td>
                  <Progress value={progressPercent(data, c.id, s.id)} />
                </td>
                <td>
                  <Link className="text-link" to={`/students/${s.id}`}>
                    عرض الملف
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
      {tab === "assignments" && (
        <Panel
          title="واجبات الدورة"
          action={
            staff && (
              <Button onClick={() => setModal("assignment")}>
                <Plus size={18} />
                إضافة واجب
              </Button>
            )
          }
        >
          <div className="simple-list">
            {data.assignments
              .filter((a) => a.course_id === id)
              .map((a) => (
                <Link to={`/assignments?course=${id}`} key={a.id}>
                  <span className="update-icon">
                    <ClipboardText size={23} />
                  </span>
                  <div>
                    <h3>{a.title}</h3>
                    <p>{a.description}</p>
                  </div>
                  <Badge>{ar(a.points)} درجة</Badge>
                </Link>
              ))}
          </div>
          {!data.assignments.some((a) => a.course_id === id) && (
            <Empty title="لا توجد واجبات" text="ستظهر تكليفات الدورة هنا." />
          )}
        </Panel>
      )}
      {tab === "quizzes" && (
        <Panel
          title="اختبارات الدورة"
          action={
            staff && (
              <Button onClick={() => setModal("quiz")}>
                <Plus size={18} />
                إضافة اختبار
              </Button>
            )
          }
        >
          <div className="simple-list">
            {data.quizzes
              .filter((q) => q.course_id === id)
              .map((q) => (
                <Link to={`/quizzes?course=${id}`} key={q.id}>
                  <span className="update-icon">
                    <Exam size={23} />
                  </span>
                  <div>
                    <h3>{q.title}</h3>
                    <p>
                      {ar(q.minutes)} دقيقة • الاجتياز {ar(q.passing)}٪
                    </p>
                  </div>
                  <ArrowRight size={20} />
                </Link>
              ))}
          </div>
          {!data.quizzes.some((q) => q.course_id === id) && (
            <Empty
              title="لا توجد اختبارات"
              text="يمكن للمدرب إضافة الاختبارات من هنا."
            />
          )}
        </Panel>
      )}
      {tab === "files" && (
        <Panel title="ملفات الدورة">
          <div className="simple-list">
            {data.files
              .filter((f) => f.course_id === id && f.purpose === "resource")
              .map((f) => (
                <a href={fileUrl(f.id)} key={f.id}>
                  <FileText size={25} />
                  <div>
                    <h3>{f.name}</h3>
                    <p>{(f.bytes / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <DownloadSimple size={20} />
                </a>
              ))}
          </div>
          {!data.files.some(
            (f) => f.course_id === id && f.purpose === "resource",
          ) && (
            <Empty
              title="مكتبة الدورة جاهزة لاستقبال الملفات"
              text="تُضاف ملفات الدروس هنا تلقائيًا عند رفعها، ويمكن إضافة المزيد من مكتبة الملفات."
            />
          )}
        </Panel>
      )}
      {modal === "edit" && (
        <CourseForm course={c} onClose={() => setModal("")} />
      )}
      {modal === "lesson" && (
        <LessonForm courseId={c.id} onClose={() => setModal("")} />
      )}
      {modal === "assignment" && (
        <AssignmentForm courseId={c.id} onClose={() => setModal("")} />
      )}
      {modal === "quiz" && (
        <QuizForm courseId={c.id} onClose={() => setModal("")} />
      )}
      {modal === "enroll" && (
        <EnrollForm courseId={c.id} onClose={() => setModal("")} />
      )}
      {lesson && (
        <LessonViewer lesson={lesson} onClose={() => setLesson(null)} />
      )}
    </>
  );
}
export function QuizAttempt() {
  const { id } = useParams();
  const { notify, refresh } = useApp();
  const nav = useNavigate();
  const [attempt, setAttempt] = useState<import("../types").Attempt | null>(
    null,
  );
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    expired?: boolean;
  } | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!id) return;
    get<{ attempt: import("../types").Attempt; server_time: string }>(
      "quiz.attempt",
      { id },
    )
      .then((r) => {
        setAttempt(r.attempt);
        setOffset(Date.now() - Date.parse(r.server_time));
        if (r.attempt.submitted_at)
          setResult({ score: r.attempt.score ?? 0, total: r.attempt.total });
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!attempt || result) return;
    const update = () =>
      setRemaining(
        Math.max(
          0,
          Math.floor(
            (Date.parse(attempt.expires_at) - (Date.now() - offset)) / 1000,
          ),
        ),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [attempt, result, offset]);
  async function submit() {
    if (busy || !attempt) return;
    setBusy(true);
    try {
      const array = attempt.questions!.map((_, i) => answers[i] ?? null);
      const r = await api<{ score: number; total: number; expired?: boolean }>(
        "quiz.submit",
        { id, answers: array },
      );
      setResult(r);
      await refresh();
      notify("تم تسليم الاختبار.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <Empty
        title="تعذّر فتح الاختبار"
        text={error}
        action={
          <Button onClick={() => nav("/quizzes")}>العودة للاختبارات</Button>
        }
      />
    );
  if (!attempt) return <div className="compact-empty">جارٍ تجهيز الاختبار…</div>;
  if (result)
    return (
      <Panel>
        <div className="quiz-result">
          <span className="result-icon">
            <CheckCircle size={48} weight="duotone" />
          </span>
          <h1>تم تسليم الاختبار</h1>
          <p>
            {result.expired
              ? "انتهت مهلة الاختبار وسُجّلت المحاولة دون درجة."
              : "نتيجتك محفوظة ويمكنك الرجوع إليها في أي وقت."}
          </p>
          <strong>
            {ar(result.score)} <span>/ {ar(result.total)}</span>
          </strong>
          <Button onClick={() => nav("/quizzes")}>
            العودة للاختبارات
            <ArrowRight size={18} />
          </Button>
        </div>
      </Panel>
    );
  return (
    <>
      <PageHead
        title="مساحة الاختبار"
        subtitle="اقرأ الأسئلة بهدوء، ثم اختر إجابتك."
      >
        <div className={`exam-timer ${remaining < 60 ? "danger-text" : ""}`}>
          <Clock size={21} />
          {ar(Math.floor(remaining / 60))}:
          {String(remaining % 60).padStart(2, "0")}
          <small>الوقت المتبقي</small>
        </div>
      </PageHead>
      <div className="alert">
        <LockKey size={20} />
        {isStaticPreview
          ? "محاكاة للتوقيت والتصحيح في المتصفح. لا تصلح هذه النسخة لإجراء اختبارات فعلية. الإجابات غير المسلّمة تبقى في هذه الصفحة فقط."
          : "يستمر وقت الاختبار عند إغلاق الصفحة. سلّم إجاباتك قبل انتهاء الوقت، ولا تغادر قبل التسليم حتى لا تفقد الإجابات غير المحفوظة."}
      </div>
      {remaining === 0 && (
        <div className="alert alert-error">
          انتهى وقت الاختبار. سلّم المحاولة لتسجيل انتهائها.
        </div>
      )}
      <div className="quiz-questions">
        {attempt.questions?.map((q, i) => (
          <Panel key={i}>
            <div className="question-heading">
              <Badge>السؤال {ar(i + 1)}</Badge>
              <span>درجة واحدة</span>
            </div>
            <h2>{q.text}</h2>
            <div className="quiz-options">
              {q.options.map((o, j) => (
                <label key={j} className={answers[i] === j ? "selected" : ""}>
                  <input
                    type="radio"
                    name={`question-${i}`}
                    checked={answers[i] === j}
                    onChange={() => setAnswers({ ...answers, [i]: j })}
                    disabled={remaining === 0}
                  />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <div className="exam-submit">
        <p>
          {ar(Object.keys(answers).length)} من {ar(attempt.total)} أسئلة تمت
          إجابتها
        </p>
        <Button disabled={busy} onClick={submit}>
          {busy ? "جارٍ تسليم الاختبار…" : "تسليم الاختبار"}
          <CheckCircle size={20} />
        </Button>
      </div>
    </>
  );
}
