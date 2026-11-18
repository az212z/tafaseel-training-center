import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  ClipboardText,
  Clock,
  CheckCircle,
  ArrowLeft,
  Exam,
  Eye,
  DownloadSimple,
} from "@phosphor-icons/react";
import { api, get, fileUrl } from "../api";
import { useApp, ar, date, downloadCsv } from "../context";
import type { Assignment, Submission, Quiz, Question } from "../types";
import {
  PageHead,
  Panel,
  Search,
  Empty,
  Button,
  Badge,
  Modal,
  Form,
  Field,
  FileUpload,
  Table,
  Avatar,
} from "../components/ui";
import { AssignmentForm, QuizForm } from "../components/forms";
export function Assignments() {
  const { data, user, notify, refresh } = useApp();
  const [params] = useSearchParams();
  const [course, setCourse] = useState(params.get("course") ?? "");
  const [term, setTerm] = useState("");
  const [add, setAdd] = useState(false);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const targetAssignment = params.get("assignment");
  useEffect(() => {
    if (targetAssignment)
      setSelected(
        data.assignments.find((a) => a.id === targetAssignment) ?? null,
      );
  }, [targetAssignment, data.assignments]);
  const [grade, setGrade] = useState<Submission | null>(null);
  const [file, setFile] = useState("");
  const staff = ["admin", "instructor"].includes(user.role);
  const items = data.assignments.filter(
    (a) => (!course || a.course_id === course) && a.title.includes(term),
  );
  const submissions = selected
    ? data.submissions.filter((s) => s.assignment_id === selected.id)
    : [];
  const own = submissions.find((s) => s.student_id === user.id);
  return (
    <>
      <PageHead
        title="الواجبات والتكليفات"
        subtitle={
          staff
            ? "تابع التسليمات، وقدّم ملاحظات تساعد على التقدم."
            : "خطوة تطبيقية تثبّت ما تعلّمته."
        }
      >
        {staff && (
          <Button onClick={() => setAdd(true)}>
            <Plus size={18} />
            إضافة واجب
          </Button>
        )}
      </PageHead>
      <div className="filter-bar">
        <Search
          value={term}
          onChange={setTerm}
          placeholder="ابحث في الواجبات…"
        />
        <select
          aria-label="تصفية بالدورة"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">جميع الدورات</option>
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="assessment-grid">
        {items.map((a) => {
          const subs = data.submissions.filter((s) => s.assignment_id === a.id);
          const mine = subs.find((s) => s.student_id === user.id);
          const expired = new Date(a.due_at) < new Date();
          return (
            <Panel key={a.id}>
              <div className="assessment-top">
                <span className="assessment-icon sand">
                  <ClipboardText size={29} weight="duotone" />
                </span>
                <Badge
                  tone={
                    mine?.score != null ? "green" : expired ? "gray" : "amber"
                  }
                >
                  {mine?.score != null
                    ? "تم التقييم"
                    : mine
                      ? "تم التسليم"
                      : expired
                        ? "انتهى الموعد"
                        : "مفتوح للتسليم"}
                </Badge>
              </div>
              <span className="assessment-course">
                {data.courses.find((c) => c.id === a.course_id)?.title}
              </span>
              <h2>{a.title}</h2>
              <p className="clamp-two">{a.description}</p>
              <div className="assessment-meta">
                <span>
                  <Clock size={17} />
                  {date(a.due_at)}
                </span>
                <span>{ar(a.points)} درجة</span>
              </div>
              {staff && (
                <div className="submission-meter">
                  <span>{ar(subs.length)} تسليم</span>
                  <span>
                    {ar(subs.filter((s) => s.score === null).length)} بانتظار
                    التقييم
                  </span>
                </div>
              )}
              <button
                className="assessment-button"
                onClick={() => {
                  setSelected(a);
                  setFile("");
                }}
              >
                {staff
                  ? "مراجعة التسليمات"
                  : user.role === "guardian"
                    ? "متابعة الواجب"
                    : "عرض الواجب وتسليمه"}
                <ArrowLeft size={18} />
              </button>
            </Panel>
          );
        })}
      </div>
      {!items.length && (
        <Empty
          title="لا توجد واجبات مطابقة"
          text="ستظهر الواجبات بعد إضافتها من المدرب."
        />
      )}
      {add && (
        <AssignmentForm
          onClose={() => setAdd(false)}
          courseId={course || undefined}
        />
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)} wide>
          <div className="inline-badges">
            <Badge>{ar(selected.points)} درجة</Badge>
            <Badge tone="amber">
              التسليم{" "}
              {date(selected.due_at, {
                day: "numeric",
                month: "long",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Badge>
          </div>
          <p className="lesson-body">{selected.description}</p>
          {staff ? (
            <>
              {submissions.length ? (
                <Table headers={["الطالب", "تاريخ التسليم", "الدرجة", ""]}>
                  {submissions.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="person-cell">
                          <Avatar
                            name={
                              data.students.find((t) => t.id === s.student_id)
                                ?.name ?? "طالب"
                            }
                            size="sm"
                          />
                          {
                            data.students.find((t) => t.id === s.student_id)
                              ?.name
                          }
                        </div>
                      </td>
                      <td>{date(s.submitted_at)}</td>
                      <td>
                        {s.score === null ? (
                          <Badge tone="amber">بانتظار التقييم</Badge>
                        ) : (
                          <Badge tone="green">
                            {ar(s.score)} / {ar(selected.points)}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => setGrade(s)}
                        >
                          مراجعة وتقييم
                          <Eye size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <Empty
                  title="لم تصل تسليمات بعد"
                  text="تظهر إجابات الطلاب هنا فور تسليمها."
                />
              )}
            </>
          ) : user.role === "student" ? (
            <>
              {own && (
                <div className="submission-receipt">
                  <CheckCircle size={24} />
                  <div>
                    <h3>تم تسليم واجبك</h3>
                    <p>{date(own.submitted_at)}</p>
                    {own.score !== null && (
                      <>
                        <strong>
                          الدرجة: {ar(own.score)} / {ar(selected.points)}
                        </strong>
                        <p>
                          ملاحظة المدرب:{" "}
                          {own.feedback || "لا توجد ملاحظات إضافية."}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {own?.score == null && new Date(selected.due_at) > new Date() && (
                <Form
                  submitLabel={own ? "تحديث التسليم" : "تسليم الواجب"}
                  onSubmit={async (d) => {
                    await api("submission.save", {
                      assignment_id: selected.id,
                      body: d.body,
                      file_id: file || own?.file_id || null,
                    });
                    await refresh();
                    notify("تم تسليم الواجب بنجاح.");
                    setSelected(null);
                  }}
                >
                  <Field label="إجابتك">
                    <textarea
                      name="body"
                      rows={6}
                      required={!file && !own?.file_id}
                      maxLength={10000}
                      defaultValue={own?.body}
                      placeholder="اكتب إجابتك أو أرفق ملفًا…"
                    />
                  </Field>
                  <FileUpload
                    purpose="submission"
                    courseId={selected.course_id}
                    onUploaded={(id) => setFile(id)}
                  />
                </Form>
              )}
              {new Date(selected.due_at) < new Date() && !own && (
                <div className="alert">
                  انتهى موعد التسليم. تواصل مع مدربك عند الحاجة.
                </div>
              )}
            </>
          ) : (
            <div className="simple-list">
              {submissions.map((s) => (
                <div key={s.id}>
                  <h3>
                    {data.students.find((t) => t.id === s.student_id)?.name}
                  </h3>
                  <p>
                    {s.score === null
                      ? "تم التسليم، بانتظار التقييم"
                      : `الدرجة ${ar(s.score)} / ${ar(selected.points)}`}
                  </p>
                  <p>{s.feedback}</p>
                </div>
              ))}
              {!submissions.length && <p>لم يُسلم الواجب بعد.</p>}
            </div>
          )}
        </Modal>
      )}
      {grade && selected && (
        <Modal title="تقييم تسليم الطالب" onClose={() => setGrade(null)}>
          <div className="answer-preview">{grade.body}</div>
          {grade.file_id && (
            <a href={fileUrl(grade.file_id)} className="btn btn-secondary">
              <DownloadSimple size={18} />
              تنزيل مرفق الإجابة
            </a>
          )}
          <Form
            submitLabel="حفظ التقييم"
            onCancel={() => setGrade(null)}
            onSubmit={async (d) => {
              await api("submission.grade", {
                id: grade.id,
                score: Number(d.score),
                feedback: d.feedback,
              });
              await refresh();
              notify("تم حفظ التقييم وإتاحته للطالب.");
              setGrade(null);
            }}
          >
            <Field label={`الدرجة من ${ar(selected.points)}`}>
              <input
                name="score"
                type="number"
                min={0}
                max={selected.points}
                required
                defaultValue={grade.score ?? ""}
              />
            </Field>
            <Field label="ملاحظات للطالب">
              <textarea
                name="feedback"
                rows={4}
                maxLength={3000}
                defaultValue={grade.feedback}
              />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
export function Quizzes() {
  const { data, user, notify } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [course, setCourse] = useState(params.get("course") ?? "");
  const [add, setAdd] = useState(false);
  const [selected, setSelected] = useState<Quiz | null>(null);
  const targetQuiz = params.get("quiz");
  useEffect(() => {
    if (targetQuiz)
      setSelected(data.quizzes.find((q) => q.id === targetQuiz) ?? null);
  }, [targetQuiz, data.quizzes]);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [busy, setBusy] = useState(false);
  const staff = ["admin", "instructor"].includes(user.role);
  const items = data.quizzes.filter((q) => !course || q.course_id === course);
  return (
    <>
      <PageHead
        title="الاختبارات"
        subtitle="قياس المعرفة، وفهم التقدم، وتحديد الخطوة القادمة."
      >
        {staff && (
          <Button onClick={() => setAdd(true)}>
            <Plus size={18} />
            إنشاء اختبار
          </Button>
        )}
      </PageHead>
      <div className="filter-bar">
        <select
          aria-label="تصفية الاختبارات بالدورة"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">جميع الدورات</option>
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <span className="results-count">{ar(items.length)} اختبار</span>
      </div>
      <div className="assessment-grid">
        {items.map((q) => {
          const attempts = data.attempts.filter((a) => a.quiz_id === q.id);
          const mine = attempts.filter((a) => a.student_id === user.id);
          const best = mine
            .filter((a) => a.score !== null)
            .reduce(
              (n, a) => Math.max(n, Math.round((a.score! / a.total) * 100)),
              -1,
            );
          return (
            <Panel key={q.id}>
              <div className="assessment-top">
                <span className="assessment-icon blue">
                  <Exam size={29} weight="duotone" />
                </span>
                <Badge tone={best >= q.passing ? "green" : "blue"}>
                  {best >= q.passing ? "تم الاجتياز" : "اختبار إلكتروني"}
                </Badge>
              </div>
              <span className="assessment-course">
                {data.courses.find((c) => c.id === q.course_id)?.title}
              </span>
              <h2>{q.title}</h2>
              <div className="assessment-meta">
                <span>
                  <Clock size={17} />
                  {ar(q.minutes)} دقيقة
                </span>
                <span>الاجتياز {ar(q.passing)}٪</span>
              </div>
              <p>
                {staff
                  ? `${ar(attempts.filter((a) => a.submitted_at).length)} محاولة مسلّمة`
                  : `${ar(q.max_attempts)} محاولات متاحة`}
              </p>
              {best >= 0 && (
                <p>
                  أفضل نتيجة: <strong>{ar(best)}٪</strong>
                </p>
              )}
              <button
                className="assessment-button"
                onClick={() => {
                  setSelected(q);
                  setQuestions(null);
                }}
              >
                {staff
                  ? "تفاصيل الاختبار والنتائج"
                  : user.role === "guardian"
                    ? "متابعة النتائج"
                    : "عرض الاختبار"}
                <ArrowLeft size={18} />
              </button>
            </Panel>
          );
        })}
      </div>
      {!items.length && (
        <Empty
          title="لا توجد اختبارات بعد"
          text="تظهر الاختبارات هنا بعد نشرها من المدرب."
        />
      )}
      {add && (
        <QuizForm
          onClose={() => setAdd(false)}
          courseId={course || undefined}
        />
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)} wide>
          <div className="inline-badges">
            <Badge tone="blue">{ar(selected.minutes)} دقيقة</Badge>
            <Badge>الاجتياز {ar(selected.passing)}٪</Badge>
            <Badge>{ar(selected.max_attempts)} محاولات</Badge>
          </div>
          {staff ? (
            <>
              <div className="modal-toolbar">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const r = await get<{ quiz: { questions: Question[] } }>(
                        "quiz",
                        { id: selected.id },
                      );
                      setQuestions(r.quiz.questions);
                    } catch (e) {
                      notify((e as Error).message, "error");
                    }
                  }}
                >
                  <Eye size={18} />
                  استعراض الأسئلة
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadCsv(
                      "quiz-results.csv",
                      ["الطالب", "الدرجة", "الأسئلة", "التسليم"],
                      data.attempts
                        .filter((a) => a.quiz_id === selected.id)
                        .map((a) => [
                          data.students.find((s) => s.id === a.student_id)
                            ?.name,
                          a.score,
                          a.total,
                          a.submitted_at ?? "لم يسلم",
                        ]),
                    )
                  }
                >
                  <DownloadSimple size={18} />
                  تصدير النتائج
                </Button>
              </div>
              {questions && (
                <div className="question-review">
                  {questions.map((q, i) => (
                    <div key={i}>
                      <h3>
                        {ar(i + 1)}. {q.text}
                      </h3>
                      {q.options.map((o, j) => (
                        <p
                          className={q.correct === j ? "correct-option" : ""}
                          key={j}
                        >
                          {q.correct === j && <CheckCircle size={17} />} {o}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <AttemptTable quizId={selected.id} />
            </>
          ) : user.role === "student" ? (
            <>
              <div className="exam-instructions">
                <h3>قبل أن تبدأ</h3>
                <ul>
                  <li>
                    يبدأ الوقت بمجرد الضغط على «بدء الاختبار» ويستمر عند مغادرة
                    الصفحة.
                  </li>
                  <li>
                    اختر إجابة واحدة لكل سؤال، ثم اضغط «تسليم الاختبار» قبل
                    انتهاء الوقت.
                  </li>
                  <li>
                    تُحفظ اختياراتك تلقائيًا وتُستعاد عند العودة. عند انتهاء الوقت
                    تُعتمد الإجابات المحفوظة قبل نهايته.
                  </li>
                </ul>
              </div>
              <AttemptTable quizId={selected.id} />
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api<{ id: string }>("quiz.start", {
                      id: selected.id,
                    });
                    nav(`/quizzes/attempt/${r.id}`);
                  } catch (e) {
                    notify((e as Error).message, "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? "جارٍ التجهيز…"
                  : data.attempts.some(
                        (a) =>
                          a.quiz_id === selected.id &&
                          a.student_id === user.id &&
                          !a.submitted_at,
                      )
                    ? "متابعة المحاولة"
                    : "بدء الاختبار"}
                <ArrowLeft size={19} />
              </Button>
            </>
          ) : (
            <AttemptTable quizId={selected.id} />
          )}
        </Modal>
      )}
    </>
  );
}
function AttemptTable({ quizId }: { quizId: string }) {
  const { data } = useApp();
  const items = data.attempts.filter((a) => a.quiz_id === quizId);
  if (!items.length)
    return <div className="compact-empty">لا توجد محاولات مسجلة بعد.</div>;
  return (
    <Table headers={["الطالب", "النتيجة", "حالة المحاولة", "التاريخ"]}>
      {items.map((a) => (
        <tr key={a.id}>
          <td>{data.students.find((s) => s.id === a.student_id)?.name}</td>
          <td>{a.score === null ? "—" : `${ar(a.score)} / ${ar(a.total)}`}</td>
          <td>
            <Badge tone={a.submitted_at ? "green" : "amber"}>
              {a.submitted_at
                ? "تم التسليم"
                : new Date(a.expires_at) < new Date()
                  ? "انتهى الوقت"
                  : "قيد الحل"}
            </Badge>
          </td>
          <td>{date(a.started_at)}</td>
        </tr>
      ))}
    </Table>
  );
}
