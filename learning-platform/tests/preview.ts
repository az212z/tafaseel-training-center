import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { previewApi as api } from "../src/preview/api";
import { dbState, fileUrl } from "../src/preview/store";
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
});
let checks = 0;
async function test(name: string, fn: () => unknown) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
const data = () => api<any>("data");
const role = (role: string) => api("demo", { role });
await test("preview initializes signed out", async () =>
  assert.equal((await api<any>("session")).user, null));
await test("data needs a selected preview account", async () =>
  assert.rejects(() => data(), /اختر حساب/));
await role("admin");
await test("public catalog and fictional profiles initialize", async () => {
  const d = await data();
  assert.equal(d.courses.length, 20);
  assert.equal(d.students.length, 12);
  assert.ok(d.users.every((u: any) => u.email.endsWith("@example.test")));
  assert.ok(Object.values(dbState().profiles).every((p) => !p.identity_number));
});
const course = await api<any>("course.save", {
  title: "دورة وهمية للاختبار",
  description: "وصف دورة الاختبار",
  category: "تجربة",
  status: "published",
  instructor_id: "preview-instructor",
  duration: 3,
  capacity: 1,
});
await api("enroll", { course_id: course.id, student_id: "preview-student" });
await test("duplicate enrollment blocked", async () =>
  assert.rejects(
    () =>
      api("enroll", { course_id: course.id, student_id: "preview-student" }),
    /مسجل مسبق/,
  ));
await test("capacity enforced", async () =>
  assert.rejects(
    () =>
      api("enroll", { course_id: course.id, student_id: "preview-student-2" }),
    /المقاعد/,
  ));
await api("lesson.save", {
  course_id: course.id,
  title: "درس وهمي",
  kind: "text",
  body: "محتوى الدرس التجريبي",
  duration: 10,
  sort_order: 1,
});
await test("minor needs guardian details", async () =>
  assert.rejects(
    () =>
      api("user.save", {
        role: "student",
        name: "طالب تجربة",
        email: "new@example.test",
        birth_date: "2015-01-01",
        consent: true,
      }),
    /ولي الأمر/,
  ));
await test("identity uploads disabled in public preview", async () => {
  const f = new FormData();
  f.set("purpose", "identity");
  f.set("student_id", "preview-student");
  f.set("file", new File(["test"], "fake.pdf", { type: "application/pdf" }));
  await assert.rejects(() => api("file.upload", f), /غير متاح في العرض العام/);
});
const resource = new FormData();
resource.set("purpose", "resource");
resource.set("course_id", course.id);
resource.set(
  "file",
  new File(["%PDF-1.4\n%%EOF"], "fake.pdf", { type: "application/pdf" }),
);
const file = await api<any>("file.upload", resource);
await test("resource stored locally with Blob URL", async () => {
  assert.ok(fileUrl(file.id).startsWith("blob:"));
  assert.ok((await data()).files.some((f: any) => f.id === file.id));
});
await test("unsupported resource type blocked", async () => {
  const f = new FormData();
  f.set("purpose", "resource");
  f.set("course_id", course.id);
  f.set("file", new File(["test"], "unsafe.html", { type: "text/html" }));
  await assert.rejects(() => api("file.upload", f), /PDF/);
});
const assignment = await api<any>("assignment.save", {
  course_id: course.id,
  title: "واجب تجريبي",
  description: "أجب للتجربة",
  due_at: new Date(Date.now() + 86400000).toISOString(),
  points: 20,
});
const quiz = await api<any>("quiz.save", {
  course_id: course.id,
  title: "اختبار تجريبي",
  minutes: 1,
  passing: 50,
  max_attempts: 1,
  questions: [
    {
      text: "السؤال التجريبي",
      options: ["إجابة صحيحة", "إجابة خاطئة"],
      correct: 0,
    },
  ],
});
await role("student");
await test("student list limited to self and published enrolled courses", async () => {
  const d = await data();
  assert.equal(d.students.length, 1);
  assert.equal(d.students[0].id, "preview-student");
  assert.ok(d.courses.every((c: any) => c.status === "published"));
  assert.equal(d.users, undefined);
  assert.equal(d.audit, undefined);
});
await test("student cannot create courses", async () =>
  assert.rejects(() => api("course.save", { title: "ممنوع" }), /غير متاحة/));
await test("student can access enrolled resource", async () =>
  assert.ok((await data()).files.some((f: any) => f.id === file.id)));
const submission = await api<any>("submission.save", {
  assignment_id: assignment.id,
  body: "إجابة وهمية لاختبار التسليم",
});
await test("cannot issue certificate before requirements complete", async () => {
  await role("admin");
  await assert.rejects(() =>
    api("certificate.issue", {
      course_id: course.id,
      student_id: "preview-student",
    }),
  );
  await role("student");
});
const started = await api<any>("quiz.start", { id: quiz.id });
await test("starting active quiz resumes same attempt", async () =>
  assert.equal((await api<any>("quiz.start", { id: quiz.id })).id, started.id));
await test("attempt DTO excludes answer keys", async () => {
  const a = await api<any>("quiz.attempt", undefined, { id: started.id });
  assert.equal(a.attempt.questions[0].correct, undefined);
});
await test("quiz computes score from submitted answers", async () => {
  const result = await api<any>("quiz.submit", {
    id: started.id,
    answers: [0],
    score: 999,
  });
  assert.equal(result.score, 1);
  assert.equal(result.total, 1);
});
await test("repeat quiz submit cannot change score", async () =>
  assert.equal(
    (await api<any>("quiz.submit", { id: started.id, answers: [1] })).score,
    1,
  ));
await test("attempt quota enforced", async () =>
  assert.rejects(() => api("quiz.start", { id: quiz.id }), /المحاولات/));
const lesson = (await data()).lessons.find(
  (l: any) => l.course_id === course.id,
);
await api("progress", { lesson_id: lesson.id });
await role("instructor");
await test("instructor sees own courses only", async () =>
  assert.ok(
    (await data()).courses.every(
      (c: any) => c.instructor_id === "preview-instructor",
    ),
  ));
await test("instructor profile excludes private details", async () => {
  const p = await api<any>("student", undefined, { id: "preview-student" });
  assert.deepEqual(Object.keys(p.profile), ["city"]);
});
await test("grade bounds enforced", async () =>
  assert.rejects(
    () => api("submission.grade", { id: submission.id, score: 21 }),
    /بين/,
  ));
await api("submission.grade", {
  id: submission.id,
  score: 19,
  feedback: "تقييم وهمي",
});
await test("teacher grade reaches student record", async () =>
  assert.equal(
    (await data()).submissions.find((s: any) => s.id === submission.id).score,
    19,
  ));
await role("student");
await test("graded submission cannot be overwritten", async () =>
  assert.rejects(
    () =>
      api("submission.save", {
        assignment_id: assignment.id,
        body: "تعديل وهمي",
      }),
    /بعد تقييمه/,
  ));
await role("admin");
const session = await api<any>("class.save", {
  course_id: course.id,
  title: "حصة ماضية وهمية",
  starts_at: new Date(Date.now() - 7200000).toISOString(),
  ends_at: new Date(Date.now() - 3600000).toISOString(),
  location: "قاعة تجربة",
});
await api("attendance.save", {
  class_id: session.id,
  records: [{ student_id: "preview-student", status: "present", note: "" }],
});
await test("attendance edits need a reason", async () =>
  assert.rejects(
    () =>
      api("attendance.save", {
        class_id: session.id,
        records: [{ student_id: "preview-student", status: "late", note: "" }],
      }),
    /سبب/,
  ));
await test("eligible certificate issued once", async () => {
  const first = await api<any>("certificate.issue", {
    course_id: course.id,
    student_id: "preview-student",
  });
  const second = await api<any>("certificate.issue", {
    course_id: course.id,
    student_id: "preview-student",
  });
  assert.equal(first.id, second.id);
  assert.ok(
    (await data()).certificates
      .find((c: any) => c.id === first.id)
      .serial.startsWith("PREVIEW-"),
  );
});
await role("guardian");
await test("guardian sees only two linked fictional children", async () => {
  const d = await data();
  assert.deepEqual(
    d.students.map((s: any) => s.id),
    ["preview-student", "preview-student-2"],
  );
  assert.ok(
    d.submissions.every((s: any) =>
      ["preview-student", "preview-student-2"].includes(s.student_id),
    ),
  );
});
await test("guardian cannot open an unlinked profile", async () =>
  assert.rejects(
    () => api("student", undefined, { id: "preview-student-3" }),
    /غير متاح/,
  ));
await test("guardian cannot submit student homework", async () =>
  assert.rejects(
    () =>
      api("submission.save", { assignment_id: assignment.id, body: "ممنوع" }),
    /غير متاحة/,
  ));
await test("real authentication unavailable on static host", async () =>
  assert.rejects(
    () => api("login", { email: "x", password: "x" }),
    /الحسابات التجريبية فقط/,
  ));
await test("reset clears additions, files, roles and results", async () => {
  await api("preview.reset", {});
  assert.equal((await api<any>("session")).user, null);
  await role("admin");
  const d = await data();
  assert.equal(d.courses.length, 20);
  assert.equal(d.files.length, 0);
  assert.equal(d.attempts.length, 0);
  assert.equal(fileUrl(file.id), "#file-unavailable");
});
console.log(`${checks} browser-preview workflow checks passed.`);
