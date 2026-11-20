import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { ar, attendancePercent, date, time, useApp } from "../context";
import type { Course } from "../types";
import { FileActions } from "./ResourcePreview";
import { RemoteState, useRemote } from "./remote";
import { Badge, Button, Field, Panel, Status, Table } from "./ui";
import { useState } from "react";

export function StudentTrainingRecord({
  studentId,
  courses,
}: {
  studentId: string;
  courses: Course[];
}) {
  const [params, setParams] = useSearchParams();
  const course =
    courses.find((item) => item.id === params.get("course")) ?? courses[0];
  if (!course) return null;
  return (
    <Panel title="السجل التدريبي والنتائج">
      <Field label="الدورة لعرض نتائجها">
        <select
          value={course.id}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("course", e.target.value);
            setParams(next, { replace: true });
          }}
        >
          {courses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </Field>
      <CourseResults
        key={`${studentId}:${course.id}`}
        course={course}
        studentId={studentId}
      />
    </Panel>
  );
}

function CourseResults({
  course,
  studentId,
}: {
  course: Course;
  studentId: string;
}) {
  const { data, user, refresh, notify } = useApp();
  const [issuing, setIssuing] = useState(false);
  const staff = user.role === "admin" || user.role === "instructor";
  const params = { course_id: course.id, student_id: studentId };
  const certificate = data.certificates.find(
    (c) => c.student_id === studentId && c.course_id === course.id,
  );
  const review = useRemote<{ reason: string | null }>(
    "certificate.review",
    params,
    staff && !certificate,
  );
  const lessons = data.lessons.filter((l) => l.course_id === course.id);
  const completed = new Map(
    data.progress
      .filter((p) => p.student_id === studentId)
      .map((p) => [p.lesson_id, p.completed_at]),
  );
  const assignments = data.assignments.filter((a) => a.course_id === course.id);
  const submissions = new Map(
    data.submissions
      .filter((s) => s.student_id === studentId)
      .map((s) => [s.assignment_id, s]),
  );
  const quizzes = data.quizzes.filter((q) => q.course_id === course.id);
  const attempts = data.attempts.filter((a) => a.student_id === studentId);
  const classes = data.classes.filter((c) => c.course_id === course.id);
  const attendance = new Map(
    data.attendance
      .filter((a) => a.student_id === studentId)
      .map((a) => [a.class_id, a]),
  );
  const recorded = classes.flatMap((c) => {
    const record = attendance.get(c.id);
    return record ? [record] : [];
  });
  const enrollment = data.enrollments.find(
    (e) => e.course_id === course.id && e.student_id === studentId,
  );
  const completedCount = lessons.filter((lesson) =>
    completed.has(lesson.id),
  ).length;

  return (
    <div className="training-record">
      <div className="inline-badges">
        <Badge>
          الدروس المكتملة {ar(completedCount)} / {ar(lessons.length)}
        </Badge>
        <Badge>
          الحضور المرصود{" "}
          {recorded.some((item) => item.status !== "excused")
            ? `${ar(attendancePercent(recorded))}٪`
            : "—"}
        </Badge>
        {enrollment?.created_at && (
          <Badge>التسجيل {date(enrollment.created_at)}</Badge>
        )}
      </div>
      {(staff || certificate) && (
        <div className="training-record-certificate">
          <h3>شهادة الإتمام</h3>
          {certificate ? (
            <div className="inline-badges">
              <Badge tone="green">صدرت في {date(certificate.issued_at)}</Badge>
              <span dir="ltr">{certificate.serial}</span>
            </div>
          ) : (
            <>
              <RemoteState {...review} />
              {!review.loading &&
                !review.error &&
                review.result &&
                (review.result.reason ? (
                  <p className="muted">{review.result.reason}</p>
                ) : (
                  <div className="inline-badges">
                    <Badge tone="green">مستوفٍ للمتطلبات</Badge>
                    <Button
                      disabled={issuing}
                      onClick={async () => {
                        setIssuing(true);
                        try {
                          await api("certificate.issue", params);
                          await refresh();
                          notify("تم إصدار الشهادة.");
                        } catch (error) {
                          notify((error as Error).message, "error");
                          review.reload();
                        } finally {
                          setIssuing(false);
                        }
                      }}
                    >
                      {issuing ? "جارٍ الإصدار…" : "إصدار الشهادة"}
                    </Button>
                  </div>
                ))}
            </>
          )}
        </div>
      )}
      <details open={assignments.length > 0}>
        <summary>الواجبات والدرجات ({ar(assignments.length)})</summary>
        {assignments.length ? (
          <Table
            headers={["الواجب", "التسليم", "الدرجة", "ملاحظات المعلم والمرفق"]}
          >
            {assignments.map((assignment) => {
              const submission = submissions.get(assignment.id);
              return (
                <tr key={assignment.id}>
                  <td>{assignment.title}</td>
                  <td>
                    {submission ? date(submission.submitted_at) : "لم يُسلّم"}
                  </td>
                  <td>
                    {submission?.score == null
                      ? submission
                        ? "بانتظار التقييم"
                        : "—"
                      : `${ar(submission.score)} / ${ar(assignment.points)}`}
                  </td>
                  <td>
                    {submission?.feedback && (
                      <p className="muted">{submission.feedback}</p>
                    )}
                    {submission?.file_id && (
                      <FileActions
                        key={submission.file_id}
                        id={submission.file_id}
                        file={data.files.find(
                          (f) => f.id === submission.file_id,
                        )}
                      />
                    )}
                    {!submission?.feedback && !submission?.file_id && "—"}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <p className="muted">لا توجد واجبات لهذه الدورة.</p>
        )}
      </details>
      <details open={quizzes.length > 0}>
        <summary>الاختبارات والمحاولات ({ar(quizzes.length)})</summary>
        {quizzes.length ? (
          <Table
            headers={[
              "الاختبار",
              "المحاولات المسلّمة",
              "حد الاجتياز",
              "النتيجة",
            ]}
          >
            {quizzes.map((quiz) => {
              const submitted = attempts.filter(
                (a) =>
                  a.quiz_id === quiz.id &&
                  a.submitted_at &&
                  a.score != null &&
                  a.total > 0,
              );
              const passed = submitted.some(
                (a) => (100 * a.score!) / a.total >= quiz.passing,
              );
              return (
                <tr key={quiz.id}>
                  <td>{quiz.title}</td>
                  <td>
                    {submitted.length ? (
                      <ul className="result-attempts">
                        {submitted.map((a) => (
                          <li key={a.id}>
                            {ar(a.score!)} / {ar(a.total)} ·{" "}
                            {date(a.submitted_at!)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{ar(quiz.passing)}٪</td>
                  <td>
                    <Badge tone={passed ? "green" : "gray"}>
                      {passed
                        ? "مجتاز"
                        : submitted.length
                          ? "لم يجتز"
                          : "لا توجد محاولة مسلّمة"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <p className="muted">لا توجد اختبارات لهذه الدورة.</p>
        )}
      </details>
      <details>
        <summary>الحضور والغياب ({ar(classes.length)})</summary>
        {classes.length ? (
          <Table headers={["الحصة", "الموعد", "الحالة"]}>
            {classes.map((item) => {
              const record = attendance.get(item.id);
              return (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>
                    {date(item.starts_at)} · {time(item.starts_at)}
                  </td>
                  <td>
                    {record ? (
                      <Status value={record.status} />
                    ) : new Date(item.ends_at) > new Date() ? (
                      "لم تنتهِ الحصة"
                    ) : (
                      "لم يُرصد"
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <p className="muted">لا توجد حصص مجدولة لهذه الدورة.</p>
        )}
      </details>
      <details>
        <summary>
          إكمال الدروس ({ar(completedCount)} / {ar(lessons.length)})
        </summary>
        {lessons.length ? (
          <Table headers={["الدرس", "حالة الإكمال"]}>
            {lessons.map((lesson) => {
              const done = completed.get(lesson.id);
              return (
                <tr key={lesson.id}>
                  <td>
                    <Link
                      className="text-link"
                      to={`/courses/${course.id}?lesson=${lesson.id}`}
                    >
                      {lesson.title}
                    </Link>
                  </td>
                  <td>
                    {done
                      ? `مكتمل · ${date(done)}`
                      : completed.has(lesson.id)
                        ? "مكتمل"
                        : "قيد الإكمال"}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <p className="muted">لا توجد دروس لهذه الدورة.</p>
        )}
      </details>
    </div>
  );
}
