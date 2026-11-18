import { extendedApi, previewAbsences } from "./extended";
import type { Course, Data, Question, Role, User } from "../types";
import {
  dbState,
  initialize,
  now,
  reset,
  save,
  saveFile,
  sessionUser,
  setRole,
  uid,
} from "./store";
type Fields = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`أدخل رقمًا بين ${min} و${max}.`);
  return n;
};
function required(v: unknown, label = "الحقل") {
  const s = text(v);
  if (s.length < 2) throw new Error(`أكمل ${label}.`);
  return s;
}
export function actor(roles?: Role[]) {
  const u = sessionUser();
  if (!u) throw new Error("اختر حساب عرض للمتابعة.");
  if (roles && !roles.includes(u.role))
    throw new Error("هذه الوظيفة غير متاحة لهذا النوع من الحسابات.");
  return u;
}
export function canStudent(u: User, id: string, privateData = false) {
  const s = dbState();
  if (u.role === "admin" || u.id === id) return true;
  if (u.role === "guardian") return s.profiles[id]?.guardian_id === u.id;
  if (!privateData && u.role === "instructor")
    return s.enrollments.some(
      (e) =>
        e.student_id === id &&
        s.courses.some((c) => c.id === e.course_id && c.instructor_id === u.id),
    );
  return false;
}
export function canCourse(u: User, id: string, write = false) {
  const s = dbState();
  const c = s.courses.find((c) => c.id === id);
  if (!c) return false;
  if (
    u.role === "admin" ||
    (u.role === "instructor" && c.instructor_id === u.id)
  )
    return true;
  if (write || c.status !== "published") return false;
  return s.enrollments.some(
    (e) =>
      e.course_id === id &&
      (u.role === "student"
        ? e.student_id === u.id
        : u.role === "guardian" &&
          s.profiles[e.student_id]?.guardian_id === u.id),
  );
}
export function course(u: User, id: string, write = false) {
  const c = dbState().courses.find((c) => c.id === id);
  if (!c || !canCourse(u, id, write))
    throw new Error("هذه الدورة غير متاحة لحساب العرض الحالي.");
  return c;
}
function fileAllowed(u: User, f: Data["files"][number]) {
  if (u.role === "admin" || f.owner_id === u.id) return true;
  if (f.purpose === "identity")
    return !!f.student_id && canStudent(u, f.student_id, true);
  if (f.purpose === "submission")
    return (
      !!f.student_id &&
      (canStudent(u, f.student_id, true) ||
        (u.role === "instructor" &&
          !!f.course_id &&
          canCourse(u, f.course_id, true)))
    );
  return !!f.course_id && canCourse(u, f.course_id);
}
function log(u: User, action: string, id?: string) {
  const s = dbState();
  s.audit ??= [];
  s.audit.unshift({
    id: uid(),
    actor_name: u.name,
    action,
    entity_id: id ?? null,
    created_at: now(),
  });
  s.audit = s.audit.slice(0, 200);
}
function dataFor(u: User): Data {
  const s = dbState();
  const courses = s.courses
    .filter((c) => canCourse(u, c.id))
    .map((c) => ({
      ...c,
      instructor_name:
        s.users.find((t) => t.id === c.instructor_id)?.name ?? null,
      students_count: s.enrollments.filter((e) => e.course_id === c.id).length,
      lessons_count: s.lessons.filter((l) => l.course_id === c.id).length,
    }));
  const ids = new Set(courses.map((c) => c.id));
  const students = s.users
    .filter((t) => t.role === "student" && canStudent(u, t.id))
    .map((t) => ({
      ...t,
      city: s.profiles[t.id]?.city,
      birth_date:
        u.role === "instructor" ? undefined : s.profiles[t.id]?.birth_date,
    }));
  const sid = new Set(students.map((t) => t.id));
  const assignments = s.assignments.filter((a) => ids.has(a.course_id));
  const quizzes = s.quizzes.filter((q) => ids.has(q.course_id));
  const classes = s.classes
    .filter((c) => ids.has(c.course_id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const lessons = s.lessons
    .filter((l) => ids.has(l.course_id))
    .sort((a, b) => a.sort_order - b.sort_order);
  return structuredClone({
    user: u,
    demo: true,
    mfa: false,
    courses,
    students,
    instructors: s.users
      .filter((t) => t.role === "instructor" && t.active)
      .map(({ id, name }) => ({ id, name })),
    enrollments: s.enrollments.filter(
      (e) => ids.has(e.course_id) && sid.has(e.student_id),
    ),
    lessons,
    assignments,
    submissions: s.submissions.filter(
      (v) =>
        sid.has(v.student_id) &&
        assignments.some((a) => a.id === v.assignment_id),
    ),
    quizzes,
    attempts: s.attempts.filter(
      (a) => sid.has(a.student_id) && quizzes.some((q) => q.id === a.quiz_id),
    ),
    classes,
    attendance: s.attendance.filter(
      (a) => sid.has(a.student_id) && classes.some((c) => c.id === a.class_id),
    ),
    progress: s.progress.filter(
      (p) => sid.has(p.student_id) && lessons.some((l) => l.id === p.lesson_id),
    ),
    files: s.files.filter((f) => fileAllowed(u, f)),
    commerce: u.role === "admin" ? (s.extensions?.commerce ?? []) : [],
    capabilities: { zoom: false, video: false, payments: false },
    announcements: s.announcements.filter(
      (a) => !a.course_id || ids.has(a.course_id),
    ),
    certificates: s.certificates.filter(
      (c) => ids.has(c.course_id) && sid.has(c.student_id),
    ),
    settings: s.settings,
    support: s.support.filter((t) => u.role === "admin" || t.user_id === u.id),
    ...(u.role === "admin" ? { users: s.users, audit: s.audit ?? [] } : {}),
  });
}
function previewLearningUpdates(u: User) {
  if (u.role !== "student")
    throw new Error("تحديثات التعلم متاحة للطالب من حسابه.");
  const s = dbState();
  const seen = new Set<string>();
  const read = s.learningReads?.[u.id] ?? {};
  return (s.audit ?? []).flatMap((event) => {
    const id = event.entity_id;
    if (!id) return [];
    const kind = event.action.split(".")[0];
    const source:
      { course_id?: string | null; title?: string; name?: string } | undefined =
      kind === "lesson"
        ? s.lessons.find((v) => v.id === id)
        : kind === "assignment"
          ? s.assignments.find((v) => v.id === id)
          : kind === "quiz"
            ? s.quizzes.find((v) => v.id === id)
            : kind === "class"
              ? s.classes.find((v) => v.id === id)
              : kind === "announcement"
                ? s.announcements.find((v) => v.id === id)
                : kind === "file"
                  ? s.files.find((v) => v.id === id && v.purpose === "resource")
                  : undefined;
    const cid = source?.course_id;
    const key = `${kind}:${id}`;
    if (!cid || seen.has(key) || !canCourse(u, cid)) return [];
    seen.add(key);
    const path =
      kind === "assignment"
        ? `/assignments?course=${cid}&assignment=${id}`
        : kind === "quiz"
          ? `/quizzes?course=${cid}&quiz=${id}`
          : kind === "class"
            ? `/schedule?course=${cid}`
            : kind === "file"
              ? `/files?course=${cid}`
              : kind === "announcement"
                ? "/announcements"
                : `/courses/${cid}?lesson=${id}`;
    return [
      {
        id: key,
        course_id: cid,
        title: source.title ?? source.name ?? "تحديث جديد",
        body: s.courses.find((c) => c.id === cid)?.title ?? "",
        created_at: event.created_at,
        read_at: read[key] ?? null,
        link_path: path,
      },
    ];
  });
}
function checkCertificate(courseId: string, studentId: string) {
  const s = dbState();
  if (
    !s.enrollments.some(
      (e) => e.course_id === courseId && e.student_id === studentId,
    )
  )
    throw new Error("الطالب غير مسجل في الدورة.");
  const lessons = s.lessons.filter((l) => l.course_id === courseId);
  if (
    !lessons.length ||
    lessons.some(
      (l) =>
        !s.progress.some(
          (p) => p.lesson_id === l.id && p.student_id === studentId,
        ),
    )
  )
    throw new Error("يجب إكمال جميع دروس الدورة.");
  for (const a of s.assignments.filter((a) => a.course_id === courseId)) {
    const sub = s.submissions.find(
      (v) => v.assignment_id === a.id && v.student_id === studentId,
    );
    if (sub?.score == null || sub.score / a.points < 0.6)
      throw new Error("يجب اجتياز الواجبات وتقييمها بنسبة ٦٠٪ على الأقل.");
  }
  for (const q of s.quizzes.filter((q) => q.course_id === courseId)) {
    if (
      !s.attempts.some(
        (a) =>
          a.quiz_id === q.id &&
          a.student_id === studentId &&
          a.score !== null &&
          (100 * a.score) / a.total >= q.passing,
      )
    )
      throw new Error("يجب اجتياز اختبارات الدورة.");
  }
  const classes = s.classes.filter((c) => c.course_id === courseId);
  if (classes.length) {
    const records = classes
      .map((c) => {
        if (new Date(c.ends_at).getTime() > Date.now())
          throw new Error("لا تصدر الشهادة قبل انتهاء جميع حصص الدورة.");
        const r = s.attendance.find(
          (a) => a.class_id === c.id && a.student_id === studentId,
        );
        if (!r) throw new Error("أكمل رصد حضور الطالب في جميع حصص الدورة.");
        return r;
      })
      .filter((r) => r.status !== "excused");
    const present = records.filter((r) =>
      ["present", "late"].includes(r.status),
    ).length;
    if (
      !records.length ||
      (100 * present) / records.length < s.settings.certificate_attendance
    )
      throw new Error("نسبة الحضور أقل من المطلوب لإصدار الشهادة.");
  }
}
export async function previewApi<T>(
  action: string,
  body?: object | FormData,
  params: Record<string, string> = {},
): Promise<T> {
  await initialize();
  const s = dbState();
  const d = (
    body instanceof FormData ? Object.fromEntries(body) : (body ?? params)
  ) as Fields;
  if (action === "session")
    return { user: sessionUser(), demo: true, csrf: "preview" } as T;
  if (action === "health") return { ok: true, mode: "browser-preview" } as T;
  if (action === "preview.reset") {
    await reset();
    return { ok: true } as T;
  }
  if (action === "demo") {
    const role = d.role as Role;
    if (!["admin", "instructor", "student", "guardian"].includes(role))
      throw new Error("اختر نوع حساب صحيحًا.");
    const u = s.users.find((u) => u.role === role);
    if (!u?.active)
      throw new Error("حساب العرض موقوف. فعّله من الإدارة أو أعد بيانات العرض.");
    setRole(role);
    return { user: u, csrf: "preview" } as T;
  }
  if (
    ["login", "login.mfa", "password", "mfa.begin", "mfa.confirm"].includes(
      action,
    )
  )
    throw new Error(
      "نسخة العرض تستخدم الحسابات التجريبية فقط. المصادقة وكلمات المرور تعمل عبر الخادم في النسخة النهائية.",
    );
  const extended = await extendedApi<T>(action, d);
  if (extended !== undefined) return structuredClone(extended);
  const u = actor();
  let result: unknown = { ok: true };
  switch (action) {
    case "logout":
      setRole(null);
      return { ok: true, csrf: "preview" } as T;
    case "data":
      return dataFor(u) as T;
    case "learning.updates": {
      const items = previewLearningUpdates(u);
      const page = int(d.page ?? 1, 1, 1000000);
      return {
        items: items.slice((page - 1) * 25, page * 25),
        total: items.length,
        unread: items.filter((x) => !x.read_at).length,
        page,
        page_size: 25,
      } as T;
    }
    case "learning.updates.read": {
      const items = previewLearningUpdates(u);
      const chosen =
        d.all === true ? items : items.filter((x) => x.id === d.id);
      if (d.all !== true && !chosen.length)
        throw new Error("الإشعار غير متاح.");
      s.learningReads ??= {};
      s.learningReads[u.id] ??= {};
      for (const item of chosen) s.learningReads[u.id][item.id] = now();
      await save();
      return { ok: true } as T;
    }
    case "student": {
      const id = text(d.id);
      const student = s.users.find((t) => t.id === id && t.role === "student");
      if (!student || !canStudent(u, id))
        throw new Error("ملف الطالب غير متاح لحسابك.");
      const profile = s.profiles[id] ?? {};
      return structuredClone({
        student,
        profile: u.role === "instructor" ? { city: profile.city } : profile,
      }) as T;
    }
    case "user.save": {
      actor(["admin"]);
      const id = text(d.id) || uid();
      const old = s.users.find((t) => t.id === id);
      const role = text(d.role) as Role;
      if (!["student", "instructor", "guardian"].includes(role))
        throw new Error("نوع الحساب غير صحيح.");
      if (old && old.role !== role)
        throw new Error("لا يمكن تغيير نوع الحساب الموجود.");
      const name = required(d.name, "الاسم");
      const email = required(d.email, "البريد");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error("البريد الإلكتروني غير صحيح.");
      if (s.users.some((t) => t.email === email && t.id !== id))
        throw new Error("البريد مسجل مسبقًا.");
      if (role === "student") {
        const birth = required(d.birth_date, "تاريخ الميلاد");
        const age = (Date.now() - new Date(birth).getTime()) / 31557600000;
        if (!Number.isFinite(age) || age < 0 || age > 100)
          throw new Error("تاريخ الميلاد غير صحيح.");
        if (age < 18 && (!text(d.guardian_name) || !text(d.guardian_phone)))
          throw new Error(
            "أكمل اسم وجوال ولي الأمر للقاصر، باستخدام بيانات تجريبية فقط.",
          );
        if (d.consent !== true) throw new Error("أكّد الموافقة التجريبية.");
        const gi = text(d.guardian_id);
        if (
          gi &&
          !s.users.some((t) => t.id === gi && t.role === "guardian" && t.active)
        )
          throw new Error("حساب ولي الأمر غير صحيح.");
        s.profiles[id] = {
          birth_date: birth,
          city: text(d.city),
          phone: text(d.phone),
          identity_number: "",
          guardian_name: text(d.guardian_name),
          guardian_phone: text(d.guardian_phone),
          guardian_id: gi || null,
        };
      }
      if (old) Object.assign(old, { name, email });
      else
        s.users.push({ id, name, email, role, active: 1, created_at: now() });
      log(u, old ? "user.updated" : "user.created", id);
      result = { id };
      break;
    }
    case "user.toggle": {
      actor(["admin"]);
      const target = s.users.find((t) => t.id === d.id);
      if (!target || target.role === "admin")
        throw new Error("لا يمكن تغيير حالة هذا الحساب.");
      target.active = target.active ? 0 : 1;
      log(u, "user.status_changed", target.id);
      break;
    }
    case "course.save": {
      actor(["admin", "instructor"]);
      const id = text(d.id) || uid();
      const old = s.courses.find((c) => c.id === id);
      if (old) course(u, id, true);
      else actor(["admin"]);
      const capacity = int(d.capacity, 1, 500);
      if (capacity < s.enrollments.filter((e) => e.course_id === id).length)
        throw new Error("السعة أقل من عدد الطلاب المسجلين.");
      const teacher = text(d.instructor_id);
      if (
        teacher &&
        !s.users.some(
          (t) => t.id === teacher && t.role === "instructor" && t.active,
        )
      )
        throw new Error("اختر مدربًا متاحًا.");
      if (u.role === "instructor" && teacher !== u.id)
        throw new Error("لا يمكنك تغيير المدرب.");
      const status = text(d.status);
      if (!["draft", "published", "archived"].includes(status))
        throw new Error("حالة الدورة غير صحيحة.");
      const image = text(d.image) || "/images/courses/foundation.webp";
      if (!/^\/images\/courses\/[a-z-]+\.webp$/.test(image))
        throw new Error("اختر غلافًا من المكتبة.");
      const c: Course = {
        id,
        title: required(d.title, "اسم الدورة"),
        description: required(d.description, "وصف الدورة"),
        category: required(d.category, "المسار"),
        image,
        status,
        instructor_id: teacher || null,
        instructor_name: s.users.find((t) => t.id === teacher)?.name ?? null,
        duration: int(d.duration, 0, 2000),
        capacity,
        students_count: 0,
        lessons_count: 0,
        created_at: old?.created_at ?? now(),
      };
      if (old) Object.assign(old, c);
      else s.courses.unshift(c);
      log(u, old ? "course.updated" : "course.created", id);
      result = { id };
      break;
    }
    case "enroll": {
      actor(["admin"]);
      const c = course(u, text(d.course_id), true);
      const id = text(d.student_id);
      if (!s.users.some((t) => t.id === id && t.role === "student" && t.active))
        throw new Error("اختر طالبًا نشطًا.");
      if (
        s.enrollments.some((e) => e.course_id === c.id && e.student_id === id)
      )
        throw new Error("الطالب مسجل مسبقًا في الدورة.");
      if (
        s.enrollments.filter((e) => e.course_id === c.id).length >= c.capacity
      )
        throw new Error("اكتمل عدد المقاعد.");
      s.enrollments.push({ id: uid(), course_id: c.id, student_id: id });
      log(u, "student.enrolled", c.id);
      break;
    }
    case "lesson.save": {
      const c = course(u, text(d.course_id), true);
      const id = text(d.id) || uid();
      const kind = text(d.kind) as "text" | "video" | "file";
      if (!["text", "video", "file"].includes(kind))
        throw new Error("نوع الدرس غير صحيح.");
      const file = text(d.file_id);
      const url = text(d.video_url);
      if (kind === "video" && !file && !url)
        throw new Error("أضف فيديو أو رابطًا.");
      if (
        url &&
        !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//.test(url)
      )
        throw new Error("استخدم رابط HTTPS من YouTube أو Vimeo.");
      if (kind === "file" && !file) throw new Error("ارفع ملف الدرس أولًا.");
      if (
        file &&
        !s.files.some(
          (f) =>
            f.id === file && f.course_id === c.id && f.purpose === "resource",
        )
      )
        throw new Error("المرفق غير متاح.");
      const lesson = {
        id,
        course_id: c.id,
        title: required(d.title, "عنوان الدرس"),
        kind,
        body: kind === "text" ? required(d.body, "محتوى الدرس") : text(d.body),
        video_url: url,
        file_id: file || null,
        duration: int(d.duration, 0, 10000),
        sort_order: int(d.sort_order, 0, 10000),
      };
      const old = s.lessons.find((l) => l.id === id && l.course_id === c.id);
      if (old) Object.assign(old, lesson);
      else s.lessons.push(lesson);
      log(u, "lesson.saved", id);
      result = { id };
      break;
    }
    case "progress": {
      actor(["student"]);
      const l = s.lessons.find((l) => l.id === d.lesson_id);
      if (!l) throw new Error("الدرس غير موجود.");
      course(u, l.course_id);
      if (
        !s.progress.some((p) => p.lesson_id === l.id && p.student_id === u.id)
      )
        s.progress.push({ id: uid(), lesson_id: l.id, student_id: u.id });
      break;
    }
    case "assignment.save": {
      const c = course(u, text(d.course_id), true);
      const id = uid();
      const due = text(d.due_at);
      if (!Number.isFinite(Date.parse(due)))
        throw new Error("موعد التسليم غير صحيح.");
      s.assignments.push({
        id,
        course_id: c.id,
        title: required(d.title, "عنوان الواجب"),
        description: required(d.description, "التعليمات"),
        due_at: due,
        points: int(d.points, 1, 1000),
      });
      log(u, "assignment.created", id);
      result = { id };
      break;
    }
    case "submission.save": {
      actor(["student"]);
      const a = s.assignments.find((a) => a.id === d.assignment_id);
      if (!a) throw new Error("الواجب غير موجود.");
      course(u, a.course_id);
      if (Date.parse(a.due_at) < Date.now())
        throw new Error("انتهى موعد التسليم.");
      const old = s.submissions.find(
        (v) => v.assignment_id === a.id && v.student_id === u.id,
      );
      if (old?.score != null) throw new Error("لا يمكن تعديل واجب بعد تقييمه.");
      const file = text(d.file_id);
      if (
        file &&
        !s.files.some(
          (f) =>
            f.id === file &&
            f.student_id === u.id &&
            f.course_id === a.course_id &&
            f.purpose === "submission",
        )
      )
        throw new Error("المرفق غير صحيح.");
      const body = file ? text(d.body) : required(d.body, "الإجابة");
      const id = old?.id ?? uid();
      if (old)
        Object.assign(old, {
          body,
          file_id: file || null,
          submitted_at: now(),
        });
      else
        s.submissions.push({
          id,
          assignment_id: a.id,
          student_id: u.id,
          body,
          file_id: file || null,
          score: null,
          feedback: "",
          submitted_at: now(),
        });
      log(u, "assignment.submitted", id);
      result = { id };
      break;
    }
    case "submission.grade": {
      const sub = s.submissions.find((v) => v.id === d.id);
      const a = s.assignments.find((a) => a.id === sub?.assignment_id);
      if (!sub || !a) throw new Error("التسليم غير موجود.");
      course(u, a.course_id, true);
      sub.score = int(d.score, 0, a.points);
      sub.feedback = text(d.feedback);
      log(u, "submission.graded", sub.id);
      break;
    }
    case "quiz.save": {
      const c = course(u, text(d.course_id), true);
      const qs = d.questions as Question[];
      if (!Array.isArray(qs) || !qs.length || qs.length > 50)
        throw new Error("أضف من سؤال إلى ٥٠ سؤالًا.");
      for (const q of qs) {
        required(q.text, "نص السؤال");
        if (
          !Array.isArray(q.options) ||
          q.options.length < 2 ||
          q.options.length > 6
        )
          throw new Error("أضف خيارات السؤال.");
        q.options.forEach((o) => required(o, "الخيار"));
        int(q.correct, 0, q.options.length - 1);
      }
      const id = uid();
      s.quizzes.push({
        id,
        course_id: c.id,
        title: required(d.title, "عنوان الاختبار"),
        minutes: int(d.minutes, 1, 180),
        passing: int(d.passing, 1, 100),
        max_attempts: int(d.max_attempts, 1, 10),
      });
      s.questions[id] = structuredClone(qs);
      log(u, "quiz.created", id);
      result = { id };
      break;
    }
    case "quiz": {
      const q = s.quizzes.find((q) => q.id === d.id);
      if (!q) throw new Error("الاختبار غير موجود.");
      course(u, q.course_id, true);
      return structuredClone({
        quiz: { ...q, questions: s.questions[q.id] },
      }) as T;
    }
    case "quiz.start": {
      actor(["student"]);
      const q = s.quizzes.find((q) => q.id === d.id);
      if (!q) throw new Error("الاختبار غير موجود.");
      course(u, q.course_id);
      const attempts = s.attempts.filter(
        (a) => a.quiz_id === q.id && a.student_id === u.id,
      );
      const active = attempts.find((a) => !a.submitted_at);
      if (active) return { id: active.id } as T;
      if (attempts.length >= q.max_attempts)
        throw new Error("استخدمت المحاولات المتاحة.");
      const id = uid();
      const qs = s.questions[q.id];
      s.attemptQuestions[id] = structuredClone(qs);
      s.attempts.push({
        id,
        quiz_id: q.id,
        student_id: u.id,
        started_at: now(),
        expires_at: new Date(Date.now() + q.minutes * 60000).toISOString(),
        submitted_at: null,
        score: null,
        total: qs.length,
      });
      log(u, "quiz.started", id);
      result = { id };
      break;
    }
    case "quiz.attempt": {
      actor(["student"]);
      const a = s.attempts.find((a) => a.id === d.id && a.student_id === u.id);
      if (!a) throw new Error("المحاولة غير موجودة.");
      const q = s.quizzes.find((q) => q.id === a.quiz_id)!;
      course(u, q.course_id);
      return structuredClone({
        attempt: {
          ...a,
          questions: s.attemptQuestions[a.id].map((q) => ({
            text: q.text,
            options: q.options,
          })),
        },
        server_time: now(),
      }) as T;
    }
    case "quiz.submit": {
      actor(["student"]);
      const a = s.attempts.find((a) => a.id === d.id && a.student_id === u.id);
      if (!a) throw new Error("المحاولة غير موجودة.");
      const q = s.quizzes.find((q) => q.id === a.quiz_id)!;
      course(u, q.course_id);
      if (a.submitted_at) return { score: a.score, total: a.total } as T;
      const answers = d.answers as (number | null)[];
      if (!Array.isArray(answers)) throw new Error("الإجابات غير صحيحة.");
      const expired = Date.now() > Date.parse(a.expires_at) + 5000;
      a.score = expired
        ? 0
        : s.attemptQuestions[a.id].filter((q, i) => answers[i] === q.correct)
            .length;
      a.submitted_at = now();
      log(u, "quiz.submitted", a.id);
      result = { score: a.score, total: a.total, expired };
      break;
    }
    case "class.save": {
      const c = course(u, text(d.course_id), true);
      const start = text(d.starts_at),
        end = text(d.ends_at);
      if (
        !Number.isFinite(Date.parse(start)) ||
        !Number.isFinite(Date.parse(end)) ||
        end <= start
      )
        throw new Error("راجع وقت بداية ونهاية الحصة.");
      const url = text(d.join_url);
      if (url && !/^https:\/\//.test(url))
        throw new Error("استخدم رابط HTTPS.");
      const id = uid();
      s.classes.push({
        id,
        course_id: c.id,
        title: required(d.title, "عنوان الحصة"),
        starts_at: start,
        ends_at: end,
        location: required(d.location, "مكان الحصة"),
        join_url: url || null,
      });
      log(u, "class.created", id);
      result = { id };
      break;
    }
    case "attendance.save": {
      const c = s.classes.find((c) => c.id === d.class_id);
      if (!c) throw new Error("الحصة غير موجودة.");
      course(u, c.course_id, true);
      if (Date.parse(c.starts_at) > Date.now() + 900000)
        throw new Error("يفتح رصد الحضور قبل الحصة بربع ساعة.");
      const records = d.records as {
        student_id: string;
        status: string;
        note: string;
      }[];
      if (!Array.isArray(records)) throw new Error("سجل الحضور غير صحيح.");
      for (const r of records) {
        if (
          !s.enrollments.some(
            (e) => e.course_id === c.course_id && e.student_id === r.student_id,
          )
        )
          throw new Error("أحد الطلاب غير مسجل في الدورة.");
        if (!["present", "absent", "late", "excused"].includes(r.status))
          throw new Error("حالة الحضور غير صحيحة.");
        const old = s.attendance.find(
          (a) => a.class_id === c.id && a.student_id === r.student_id,
        );
        if (old && text(r.note).length < 3)
          throw new Error("اذكر سبب تعديل الحضور السابق.");
      }
      for (const r of records) {
        const old = s.attendance.find(
          (a) => a.class_id === c.id && a.student_id === r.student_id,
        );
        if (old)
          Object.assign(old, {
            status: r.status,
            note: text(r.note),
            updated_at: now(),
          });
        else
          s.attendance.push({
            id: uid(),
            class_id: c.id,
            student_id: r.student_id,
            status: r.status,
            note: text(r.note),
            updated_at: now(),
          });
      }
      log(u, "attendance.saved", c.id);
      break;
    }
    case "file.upload": {
      if (!(body instanceof FormData)) throw new Error("اختر الملف.");
      const file = body.get("file");
      if (!(file instanceof File) || !file.size)
        throw new Error("الملف غير صحيح.");
      if (file.size > 10 * 1024 * 1024)
        throw new Error("الحد في نسخة العرض ١٠ ميجابايت للملف.");
      if (
        ![
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
        ].includes(file.type)
      )
        throw new Error("اختر PDF أو صورة أو MP4.");
      const purpose = text(d.purpose);
      const cid = text(d.course_id);
      let sid = text(d.student_id);
      if (purpose === "resource") {
        course(u, cid, true);
        sid = "";
      } else if (purpose === "submission") {
        actor(["student"]);
        course(u, cid);
        sid = u.id;
      } else if (purpose === "identity") {
        if (!canStudent(u, sid, true)) throw new Error("الملف غير متاح.");
        throw new Error(
          "رفع الهويات غير متاح في العرض العام. استخدم ملفات تدريبية تجريبية فقط.",
        );
      } else throw new Error("نوع المرفق غير صحيح.");
      if (
        s.files.reduce((n, f) => n + f.bytes, 0) + file.size >
        30 * 1024 * 1024
      )
        throw new Error(
          "بلغت الملفات ٣٠ ميجابايت. أعد بيانات العرض لتفريغ المساحة.",
        );
      const id = uid();
      await saveFile(id, file);
      s.files.unshift({
        id,
        owner_id: u.id,
        course_id: cid || null,
        student_id: sid || null,
        purpose,
        name: file.name,
        mime: file.type,
        bytes: file.size,
        created_at: now(),
      });
      log(u, "file.uploaded", id);
      result = { id, name: file.name };
      break;
    }
    case "announcement.save": {
      actor(["admin", "instructor"]);
      const cid = text(d.course_id);
      if (cid) course(u, cid, true);
      else actor(["admin"]);
      const id = uid();
      s.announcements.unshift({
        id,
        course_id: cid || null,
        title: required(d.title, "العنوان"),
        body: required(d.body, "نص الإعلان"),
        author_name: u.name,
        created_at: now(),
      });
      log(u, "announcement.created", id);
      result = { id };
      break;
    }
    case "certificate.issue": {
      const c = course(u, text(d.course_id), true);
      const sid = text(d.student_id);
      checkCertificate(c.id, sid);
      const old = s.certificates.find(
        (v) => v.course_id === c.id && v.student_id === sid,
      );
      if (old) return { id: old.id } as T;
      const id = uid();
      s.certificates.push({
        id,
        course_id: c.id,
        student_id: sid,
        student_name: s.users.find((t) => t.id === sid)?.name ?? "طالب تجريبي",
        course_title: c.title,
        duration: c.duration,
        serial: `PREVIEW-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`,
        issued_at: now(),
      });
      log(u, "certificate.issued", id);
      result = { id };
      break;
    }
    case "settings.save": {
      actor(["admin"]);
      s.settings = {
        name: required(d.name, "اسم المركز"),
        email: required(d.email, "البريد"),
        phone: required(d.phone, "رقم التواصل"),
        certificate_attendance: int(d.certificate_attendance, 0, 100),
      };
      log(u, "settings.saved");
      break;
    }
    case "support.save": {
      const id = uid();
      s.support.unshift({
        id,
        user_id: u.id,
        name: u.name,
        subject: required(d.subject, "موضوع الطلب"),
        body: required(d.body, "وصف الطلب"),
        reply: null,
        status: "open",
        created_at: now(),
      });
      log(u, "support.created", id);
      result = { id };
      break;
    }
    case "support.reply": {
      actor(["admin"]);
      const ticket = s.support.find((t) => t.id === d.id);
      if (!ticket) throw new Error("الطلب غير موجود.");
      ticket.reply = required(d.reply, "الرد");
      ticket.status = "closed";
      log(u, "support.replied", ticket.id);
      break;
    }
    default:
      throw new Error("هذه الوظيفة غير متاحة في نسخة العرض.");
  }
  if (action === "attendance.save")
    await previewAbsences(
      String(d.class_id),
      d.records as { student_id: string; status: string }[],
    );
  await save();
  return structuredClone(result) as T;
}
