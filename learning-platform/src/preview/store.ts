import type { Data, Profile, Question, Role, User } from "../types";
import catalog from "../../server/catalog.json";
export interface PreviewState extends Omit<Data, "user" | "demo" | "mfa"> {
  version: 1;
  users: User[];
  profiles: Record<string, Profile>;
  questions: Record<string, Question[]>;
  attemptQuestions: Record<string, Question[]>;
}
const DATABASE = "tafaseel-learning-preview-v1";
const ROLE_KEY = "tafaseel-learning-preview-role-v1";
let state: PreviewState | undefined;
let database: IDBDatabase | undefined;
let ready: Promise<void> | undefined;
const urls = new Map<string, string>();
export const uid = () => crypto.randomUUID().replaceAll("-", "");
export const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
export function seed(): PreviewState {
  const stamp = now();
  const users: User[] = [
    {
      id: "preview-admin",
      name: "إدارة تفاصيل",
      email: "admin@example.test",
      role: "admin",
      active: 1,
      created_at: stamp,
    },
    {
      id: "preview-instructor",
      name: "أحمد العتيبي",
      email: "trainer@example.test",
      role: "instructor",
      active: 1,
      created_at: stamp,
    },
    {
      id: "preview-instructor-2",
      name: "سارة الحربي",
      email: "trainer2@example.test",
      role: "instructor",
      active: 1,
      created_at: stamp,
    },
    {
      id: "preview-guardian",
      name: "ولي الأمر التجريبي",
      email: "guardian@example.test",
      role: "guardian",
      active: 1,
      created_at: stamp,
    },
  ];
  const names = [
    "نورة القحطاني",
    "محمد العتيبي",
    "ريم الحربي",
    "خالد الدوسري",
    "لينا الشهري",
    "عبدالعزيز الغامدي",
    "جود السبيعي",
    "سلمان المطيري",
    "شهد العنزي",
    "عمر الزهراني",
    "هيا القحطاني",
    "فيصل العمري",
  ];
  const profiles: Record<string, Profile> = {};
  names.forEach((name, i) => {
    const id = i === 0 ? "preview-student" : `preview-student-${i + 1}`;
    users.push({
      id,
      name,
      email: i === 0 ? "student@example.test" : `student${i + 1}@example.test`,
      role: "student",
      active: 1,
      created_at: stamp,
    });
    profiles[id] = {
      birth_date: i < 2 ? "2011-05-14" : "2000-03-10",
      city: "تبوك",
      phone: "",
      guardian_name: i < 2 ? "ولي الأمر التجريبي" : "",
      guardian_phone: "",
      guardian_id: i < 2 ? "preview-guardian" : null,
      identity_number: "",
    };
  });
  const images: Record<string, string> = {
    aptitude: "foundation",
    english: "step",
    exams: "teacher-competencies",
    development: "self-development",
    arts: "interior-design",
    children: "drawing-painting",
  };
  const courses = catalog.courses.map((course, i) => ({
    id: `preview-course-${i + 1}`,
    title: course.title,
    description: course.description,
    category:
      catalog.programs.find((p) => p.id === course.program_id)?.shortTitle ??
      "برامج تفاصيل",
    image: `/images/courses/${images[course.program_id] ?? "foundation"}.webp`,
    status: [0, 2, 5, 12].includes(i) ? "published" : "draft",
    instructor_id: i % 2 ? "preview-instructor-2" : "preview-instructor",
    instructor_name: i % 2 ? "سارة الحربي" : "أحمد العتيبي",
    duration: 12 + i,
    capacity: 20,
    students_count: 0,
    lessons_count: 0,
    created_at: new Date(Date.now() - i * 60000).toISOString(),
  }));
  const s: PreviewState = {
    version: 1,
    users,
    profiles,
    courses,
    instructors: users
      .filter((u) => u.role === "instructor")
      .map(({ id, name }) => ({ id, name })),
    students: [],
    enrollments: [],
    lessons: [],
    assignments: [],
    submissions: [],
    quizzes: [],
    questions: {},
    attemptQuestions: {},
    attempts: [],
    classes: [],
    attendance: [],
    progress: [],
    files: [],
    announcements: [],
    certificates: [],
    support: [],
    audit: [],
    settings: {
      name: "مركز تفاصيل للتدريب",
      email: "training@example.test",
      phone: "0544552366",
      certificate_attendance: 75,
    },
  };
  courses
    .filter((c) => c.status === "published")
    .forEach((c, ci) => {
      const students = users
        .filter((u) => u.role === "student")
        .slice(0, ci === 3 ? 8 : 12);
      students.forEach((u) =>
        s.enrollments.push({ id: uid(), student_id: u.id, course_id: c.id }),
      );
      [
        "مرحبًا بك وخطة التعلم",
        "المفاهيم الأساسية وتطبيقاتها",
        "التدريب العملي والمراجعة",
      ].forEach((title, i) => {
        const id = `${c.id}-lesson-${i + 1}`;
        s.lessons.push({
          id,
          course_id: c.id,
          title,
          kind: "text",
          body: "هذا درس توضيحي لتجربة المنصة.\n\nتعرّف على أهداف الدورة، ثم دوّن ملاحظاتك وطبّق المفاهيم في مثال من اختيارك.\n\nيمكنك من حساب الإدارة إضافة درس نصّي أو ملف أو رابط فيديو أو رفع MP4. جميع الإضافات في نسخة العرض تُحفظ على هذا المتصفح فقط.",
          video_url: "",
          file_id: null,
          duration: 20 + i * 10,
          sort_order: i,
        });
        students.forEach((u, j) => {
          if (j % 3 >= i)
            s.progress.push({ id: uid(), lesson_id: id, student_id: u.id });
        });
      });
      const aid = `${c.id}-assignment`;
      s.assignments.push({
        id: aid,
        course_id: c.id,
        title: "النشاط التطبيقي الأول",
        description:
          "اكتب ملخصًا للمفاهيم الأساسية مع مثال عملي من اختيارك. هذا واجب توضيحي للاختبار.",
        due_at: new Date(Date.now() + 3 * 86400000).toISOString(),
        points: 20,
      });
      students
        .slice(1, 6)
        .forEach((u, i) =>
          s.submissions.push({
            id: uid(),
            assignment_id: aid,
            student_id: u.id,
            body: "إجابة تجريبية لتوضيح تسليم الواجب ومراجعة المدرب.",
            file_id: null,
            score: i < 2 ? 18 : null,
            feedback: i < 2 ? "عمل جيد، حافظ على وضوح الأمثلة." : "",
            submitted_at: stamp,
          }),
        );
      const qid = `c-${ci}-quiz`;
      s.quizzes.push({
        id: qid,
        course_id: c.id,
        title: "اختبار المفاهيم الأساسية",
        minutes: 20,
        passing: 60,
        max_attempts: 2,
      });
      s.questions[qid] = [
        {
          text: "ما أفضل بداية لخطة تعلم فعالة؟",
          options: [
            "تحديد هدف واضح",
            "تجاوز الدروس الأساسية",
            "تأجيل التطبيق",
            "الاعتماد على الحفظ فقط",
          ],
          correct: 0,
        },
        {
          text: "أي ممارسة تساعد على تثبيت المعرفة؟",
          options: [
            "عدم المراجعة",
            "التطبيق والمراجعة المنتظمة",
            "تجاهل الملاحظات",
            "السرعة فقط",
          ],
          correct: 1,
        },
      ];
      [-1, 0, 2].forEach((offset) => {
        const start = new Date();
        start.setDate(start.getDate() + offset);
        start.setHours(18, 0, 0, 0);
        const id = uid();
        s.classes.push({
          id,
          course_id: c.id,
          title:
            offset === 0
              ? "لقاء اليوم: التطبيق والمناقشة"
              : "لقاء تدريبي مباشر",
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(),
          location: `قاعة تفاصيل ${ci + 1}`,
          join_url: null,
        });
        if (offset < 0)
          students.forEach((u, i) =>
            s.attendance.push({
              id: uid(),
              class_id: id,
              student_id: u.id,
              status: i % 7 === 0 ? "absent" : i % 5 === 0 ? "late" : "present",
              note: "",
              updated_at: stamp,
            }),
          );
      });
    });
  s.announcements.push({
    id: uid(),
    course_id: null,
    title: "أهلًا بك في نسخة العرض من منصة تفاصيل",
    body: "جرّب الحسابات الأربعة وأضف دورات ودروسًا وواجبات واختبارات. يحفظ هذا العرض تعديلاتك في هذا المتصفح فقط. لا تدخل بيانات طلاب أو هويات حقيقية.",
    author_name: "إدارة تفاصيل",
    created_at: stamp,
  });
  return s;
}
function request<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function initialize() {
  if (ready) return ready;
  ready = (async () => {
    const open = indexedDB.open(DATABASE, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore("state");
      open.result.createObjectStore("files", { keyPath: "id" });
    };
    database = await request(open);
    const saved = (await request(
      database.transaction("state").objectStore("state").get("main"),
    )) as PreviewState | undefined;
    state = saved?.version === 1 ? saved : seed();
    const files = (await request(
      database.transaction("files").objectStore("files").getAll(),
    )) as { id: string; blob: Blob }[];
    for (const f of files) urls.set(f.id, URL.createObjectURL(f.blob));
    if (!saved) await save();
  })();
  try {
    await ready;
  } catch {
    ready = undefined;
    throw new Error(
      "تعذّر فتح التخزين المحلي. اسمح بحفظ بيانات الموقع لتجربة نسخة العرض.",
    );
  }
}
export function dbState() {
  if (!state) throw new Error("لم تُجهز بيانات العرض بعد.");
  return state;
}
export async function save() {
  if (!database || !state) throw new Error("التخزين المحلي غير جاهز.");
  const tx = database.transaction("state", "readwrite");
  tx.objectStore("state").put(clone(state), "main");
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(new Error("تعذّر الحفظ. قد تكون مساحة المتصفح ممتلئة."));
  });
}
export function sessionUser() {
  const role = sessionStorage.getItem(ROLE_KEY);
  return state?.users.find((u) => u.role === role && u.active) ?? null;
}
export function setRole(role: Role | null) {
  if (role) sessionStorage.setItem(ROLE_KEY, role);
  else sessionStorage.removeItem(ROLE_KEY);
}
export function fileUrl(id: string) {
  return urls.get(id) ?? "#file-unavailable";
}
export async function saveFile(id: string, blob: Blob) {
  if (!database) throw new Error("التخزين غير جاهز.");
  const tx = database.transaction("files", "readwrite");
  tx.objectStore("files").put({ id, blob });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  urls.set(id, URL.createObjectURL(blob));
}
export async function reset() {
  await initialize();
  if (!database) return;
  const tx = database.transaction(["state", "files"], "readwrite");
  tx.objectStore("state").clear();
  tx.objectStore("files").clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls.clear();
  state = seed();
  setRole(null);
  await save();
}
