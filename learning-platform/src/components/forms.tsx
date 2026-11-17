import { isStaticPreview } from "../environment";
import { useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { api, get } from "../api";
import { useApp } from "../context";
import type { Course, Profile, Student, User } from "../types";
import { Field, Form, Modal, Button, FileUpload } from "./ui";
export function CourseSelect({
  value,
  name = "course_id",
  optional = false,
}: {
  value?: string;
  name?: string;
  optional?: boolean;
}) {
  const { data } = useApp();
  return (
    <select name={name} required={!optional} defaultValue={value ?? ""}>
      <option value="">{optional ? "جميع طلاب المنصة" : "اختر الدورة"}</option>
      {data.courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.title}
        </option>
      ))}
    </select>
  );
}
export function CourseForm({
  course,
  onClose,
}: {
  course?: Course;
  onClose: () => void;
}) {
  const { data, refresh, notify, user } = useApp();
  const images = [
    ["foundation", "القدرات العامة"],
    ["step", "اللغة الإنجليزية"],
    ["teacher-competencies", "الرخصة المهنية"],
    ["self-development", "تطوير الذات"],
    ["interior-design", "التصميم"],
    ["drawing-painting", "الفنون"],
    ["ielts", "آيلتس"],
    ["digital-art", "الفن الرقمي"],
  ];
  return (
    <Modal
      title={course ? "تعديل الدورة" : "إضافة دورة تدريبية"}
      onClose={onClose}
      wide
    >
      <Form
        onCancel={onClose}
        submitLabel={course ? "حفظ التعديلات" : "إنشاء الدورة"}
        onSubmit={async (d) => {
          await api("course.save", {
            ...d,
            id: course?.id,
            duration: Number(d.duration),
            capacity: Number(d.capacity),
          });
          await refresh();
          notify("تم حفظ الدورة.");
          onClose();
        }}
      >
        <Field label="اسم الدورة">
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={course?.title}
            placeholder="مثال: القدرات العامة – المستوى التأسيسي"
          />
        </Field>
        <Field label="وصف الدورة">
          <textarea
            name="description"
            required
            rows={3}
            maxLength={5000}
            defaultValue={course?.description}
          />
        </Field>
        <div className="form-grid">
          <Field label="المسار التدريبي">
            <input
              name="category"
              list="categories"
              required
              defaultValue={course?.category}
            />
            <datalist id="categories">
              {[
                "القدرات العامة",
                "اللغة الإنجليزية",
                "قياس والاختبارات التعليمية",
                "التطوير الذاتي والمهني",
                "الفنون والتصميم",
                "دورات الأطفال",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </datalist>
          </Field>
          <Field label="المدرب">
            <select
              name="instructor_id"
              defaultValue={
                course?.instructor_id ??
                (user.role === "instructor" ? user.id : "")
              }
              required
            >
              <option value="">اختر المدرب</option>
              {data.instructors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="مدة الدورة بالساعات">
            <input
              name="duration"
              type="number"
              min={1}
              max={2000}
              defaultValue={course?.duration ?? 12}
              required
            />
          </Field>
          <Field label="عدد المقاعد">
            <input
              name="capacity"
              type="number"
              min={1}
              max={500}
              defaultValue={course?.capacity ?? 20}
              required
            />
          </Field>
          <Field label="حالة الدورة">
            <select name="status" defaultValue={course?.status ?? "draft"}>
              <option value="draft">مسودة</option>
              <option value="published">منشورة للطلاب المسجلين</option>
              <option value="archived">مؤرشفة</option>
            </select>
          </Field>
          <Field label="غلاف الدورة">
            <select
              name="image"
              defaultValue={course?.image ?? "/images/courses/foundation.webp"}
            >
              {images.map(([id, label]) => (
                <option key={id} value={`/images/courses/${id}.webp`}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Form>
    </Modal>
  );
}
export function UserForm({
  user: target,
  profile,
  defaultRole = "student",
  onClose,
}: {
  user?: User | Student;
  profile?: Profile;
  defaultRole?: string;
  onClose: () => void;
}) {
  const { data, refresh, notify } = useApp();
  const [role, setRole] = useState(target?.role ?? defaultRole);
  return (
    <Modal
      title={target ? "تعديل بيانات الحساب" : "إضافة حساب جديد"}
      onClose={onClose}
      wide
    >
      <Form
        onCancel={onClose}
        submitLabel={target ? "حفظ بيانات الحساب" : "إنشاء الحساب"}
        onSubmit={async (d) => {
          await api("user.save", {
            ...d,
            id: target?.id,
            role,
            consent: d.consent === "on",
          });
          await refresh();
          notify("تم حفظ الحساب.");
          onClose();
        }}
      >
        {isStaticPreview && (
          <div className="alert">
            استخدم بيانات وهمية فقط. هذا حساب داخل التجربة المحلية في المتصفح،
            ولا ينشئ تسجيل دخول حقيقيًا.
          </div>
        )}
        <div className="form-grid">
          <Field label="نوع الحساب">
            <select
              name="role"
              value={role}
              disabled={!!target}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="student">طالب</option>
              <option value="instructor">مدرب</option>
              <option value="guardian">ولي أمر</option>
            </select>
          </Field>
          <Field label="الاسم الكامل">
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={target?.name}
            />
          </Field>
          <Field label="البريد الإلكتروني">
            <input
              name="email"
              type="email"
              required
              dir="ltr"
              defaultValue={target?.email}
              autoComplete="off"
            />
          </Field>
          {!isStaticPreview && (
            <>
              <Field
                label={target ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}
                hint="١٢ حرفًا على الأقل. تُسلّم لصاحب الحساب بشكل خاص."
              >
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={72}
                  required={!target}
                  autoComplete="new-password"
                />
              </Field>
            </>
          )}
          {role === "student" && (
            <>
              <Field label="تاريخ الميلاد">
                <input
                  name="birth_date"
                  type="date"
                  required
                  defaultValue={profile?.birth_date}
                />
              </Field>
              <Field label="جوال الطالب">
                <input
                  name="phone"
                  type="tel"
                  dir="ltr"
                  defaultValue={profile?.phone}
                  placeholder="05xxxxxxxx"
                />
              </Field>
              <Field label="المدينة">
                <input
                  name="city"
                  maxLength={100}
                  defaultValue={profile?.city}
                />
              </Field>
              {!isStaticPreview && (
                <>
                  <Field
                    label="رقم الهوية / الإقامة (اختياري)"
                    hint="يُحفظ مشفرًا. اجمعه عند الحاجة فقط."
                  >
                    <input
                      name="identity_number"
                      inputMode="numeric"
                      maxLength={10}
                      dir="ltr"
                      defaultValue={profile?.identity_number}
                    />
                  </Field>
                </>
              )}
              <Field label="اسم ولي الأمر" hint="مطلوب لمن هم دون ١٨ سنة.">
                <input
                  name="guardian_name"
                  maxLength={120}
                  defaultValue={profile?.guardian_name}
                />
              </Field>
              <Field label="جوال ولي الأمر">
                <input
                  name="guardian_phone"
                  type="tel"
                  dir="ltr"
                  defaultValue={profile?.guardian_phone}
                  placeholder="05xxxxxxxx"
                />
              </Field>
              <Field
                label="ربط حساب ولي الأمر"
                hint="يسمح له بمتابعة هذا الطالب فقط."
              >
                <select
                  name="guardian_id"
                  defaultValue={profile?.guardian_id ?? ""}
                >
                  <option value="">بدون حساب مرتبط</option>
                  {data.users
                    ?.filter((u) => u.role === "guardian" && u.active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.email}
                      </option>
                    ))}
                </select>
              </Field>
            </>
          )}
        </div>
        {role === "student" && (
          <label className="check-label">
            <input type="checkbox" name="consent" required />
            {isStaticPreview
              ? "أؤكد أن المدخلات بيانات وهمية للتجربة."
              : "تم الحصول على موافقة الطالب أو ولي أمره على حفظ البيانات لأغراض التدريب."}
          </label>
        )}
      </Form>
    </Modal>
  );
}
export function LessonForm({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) {
  const { refresh, notify } = useApp();
  const [kind, setKind] = useState("text");
  const [file, setFile] = useState("");
  return (
    <Modal title="إضافة درس جديد" onClose={onClose} wide>
      <Form
        onCancel={onClose}
        onSubmit={async (d) => {
          await api("lesson.save", {
            ...d,
            kind,
            course_id: courseId,
            file_id: file || null,
            duration: Number(d.duration),
            sort_order: Number(d.sort_order),
          });
          await refresh();
          notify("تمت إضافة الدرس.");
          onClose();
        }}
      >
        <Field label="عنوان الدرس">
          <input name="title" required maxLength={200} />
        </Field>
        <div className="form-grid">
          <Field label="نوع المحتوى">
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setFile("");
              }}
            >
              <option value="text">درس نصّي</option>
              <option value="video">فيديو مسجل</option>
              <option value="file">ملف تدريبي</option>
            </select>
          </Field>
          <Field label="المدة بالدقائق">
            <input
              name="duration"
              type="number"
              min={0}
              max={10000}
              defaultValue={20}
            />
          </Field>
          <Field label="ترتيب الدرس">
            <input name="sort_order" type="number" min={0} defaultValue={1} />
          </Field>
        </div>
        {kind === "video" && (
          <Field
            label="رابط الفيديو"
            hint="YouTube أو Vimeo. أو ارفع MP4 أدناه؛ للمقاطع الطويلة استخدم استضافة فيديو."
          >
            <input
              name="video_url"
              type="url"
              dir="ltr"
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </Field>
        )}
        {kind !== "text" && (
          <FileUpload
            key={kind}
            purpose="resource"
            courseId={courseId}
            onUploaded={(id) => setFile(id)}
            accept={kind === "video" ? ".mp4" : ".pdf,.jpg,.jpeg,.png,.webp"}
          />
        )}
        <Field
          label={kind === "text" ? "محتوى الدرس" : "ملاحظات الدرس (اختياري)"}
        >
          <textarea
            name="body"
            rows={6}
            maxLength={20000}
            required={kind === "text"}
          />
        </Field>
      </Form>
    </Modal>
  );
}
export function AssignmentForm({
  courseId,
  onClose,
}: {
  courseId?: string;
  onClose: () => void;
}) {
  const { refresh, notify } = useApp();
  return (
    <Modal title="إضافة واجب" onClose={onClose}>
      <Form
        onCancel={onClose}
        onSubmit={async (d) => {
          await api("assignment.save", {
            ...d,
            points: Number(d.points),
            due_at: new Date(d.due_at as string).toISOString(),
          });
          await refresh();
          notify("تمت إضافة الواجب.");
          onClose();
        }}
      >
        <Field label="الدورة">
          <CourseSelect value={courseId} />
        </Field>
        <Field label="عنوان الواجب">
          <input name="title" required maxLength={200} />
        </Field>
        <Field label="التعليمات">
          <textarea name="description" rows={4} required />
        </Field>
        <div className="form-grid">
          <Field label="آخر موعد للتسليم">
            <input name="due_at" type="datetime-local" required />
          </Field>
          <Field label="الدرجة الكاملة">
            <input
              name="points"
              type="number"
              min={1}
              max={1000}
              defaultValue={20}
              required
            />
          </Field>
        </div>
      </Form>
    </Modal>
  );
}
export function ClassForm({
  onClose,
  courseId,
}: {
  onClose: () => void;
  courseId?: string;
}) {
  const { refresh, notify } = useApp();
  return (
    <Modal title="جدولة حصة تدريبية" onClose={onClose}>
      <Form
        onCancel={onClose}
        onSubmit={async (d) => {
          await api("class.save", {
            ...d,
            starts_at: new Date(d.starts_at as string).toISOString(),
            ends_at: new Date(d.ends_at as string).toISOString(),
          });
          await refresh();
          notify("تمت جدولة الحصة.");
          onClose();
        }}
      >
        <Field label="الدورة">
          <CourseSelect value={courseId} />
        </Field>
        <Field label="عنوان الحصة">
          <input name="title" required maxLength={200} />
        </Field>
        <div className="form-grid">
          <Field label="بداية الحصة">
            <input name="starts_at" type="datetime-local" required />
          </Field>
          <Field label="نهاية الحصة">
            <input name="ends_at" type="datetime-local" required />
          </Field>
        </div>
        <Field label="مكان الحصة">
          <input name="location" required placeholder="قاعة تفاصيل / عن بُعد" />
        </Field>
        <Field
          label="رابط اللقاء (اختياري)"
          hint="رابط اجتماع HTTPS من مزود اللقاءات الذي يستخدمه المركز."
        >
          <input name="join_url" type="url" dir="ltr" />
        </Field>
      </Form>
    </Modal>
  );
}
export function QuizForm({
  onClose,
  courseId,
}: {
  onClose: () => void;
  courseId?: string;
}) {
  const { refresh, notify } = useApp();
  const [questions, setQuestions] = useState([
    { text: "", options: ["", "", "", ""], correct: 0 },
  ]);
  return (
    <Modal title="إنشاء اختبار" onClose={onClose} wide>
      <Form
        onCancel={onClose}
        submitLabel="نشر الاختبار"
        onSubmit={async (d) => {
          await api("quiz.save", {
            ...d,
            minutes: Number(d.minutes),
            passing: Number(d.passing),
            max_attempts: Number(d.max_attempts),
            questions,
          });
          await refresh();
          notify("تم إنشاء الاختبار.");
          onClose();
        }}
      >
        <Field label="الدورة">
          <CourseSelect value={courseId} />
        </Field>
        <Field label="اسم الاختبار">
          <input name="title" required />
        </Field>
        <div className="form-grid three">
          <Field label="المدة بالدقائق">
            <input
              name="minutes"
              type="number"
              min={1}
              max={180}
              defaultValue={30}
            />
          </Field>
          <Field label="نسبة الاجتياز">
            <input
              name="passing"
              type="number"
              min={1}
              max={100}
              defaultValue={60}
            />
          </Field>
          <Field label="عدد المحاولات">
            <input
              name="max_attempts"
              type="number"
              min={1}
              max={10}
              defaultValue={2}
            />
          </Field>
        </div>
        <h3>أسئلة الاختبار</h3>
        {questions.map((q, i) => (
          <div className="question-editor" key={i}>
            <div className="row-between">
              <strong>السؤال {i + 1}</strong>
              {questions.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`حذف السؤال ${i + 1}`}
                  onClick={() =>
                    setQuestions(questions.filter((_, j) => i !== j))
                  }
                >
                  <Trash size={18} />
                </button>
              )}
            </div>
            <input
              required
              aria-label={`نص السؤال ${i + 1}`}
              placeholder="اكتب السؤال هنا"
              value={q.text}
              onChange={(e) =>
                setQuestions(
                  questions.map((v, j) =>
                    j === i ? { ...v, text: e.target.value } : v,
                  ),
                )
              }
            />
            <small>حدد الإجابة الصحيحة من الدائرة بجانب الخيار.</small>
            {q.options.map((o, j) => (
              <label className="option-editor" key={j}>
                <input
                  type="radio"
                  name={`correct-${i}`}
                  checked={q.correct === j}
                  onChange={() =>
                    setQuestions(
                      questions.map((v, k) =>
                        k === i ? { ...v, correct: j } : v,
                      ),
                    )
                  }
                  aria-label={`الخيار الصحيح ${j + 1} للسؤال ${i + 1}`}
                />
                <input
                  required
                  aria-label={`الخيار ${j + 1} للسؤال ${i + 1}`}
                  value={o}
                  placeholder={`الخيار ${j + 1}`}
                  onChange={(e) =>
                    setQuestions(
                      questions.map((v, k) =>
                        k === i
                          ? {
                              ...v,
                              options: v.options.map((s, l) =>
                                j === l ? e.target.value : s,
                              ),
                            }
                          : v,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
        ))}
        {questions.length < 50 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setQuestions([
                ...questions,
                { text: "", options: ["", "", "", ""], correct: 0 },
              ])
            }
          >
            <Plus size={18} />
            إضافة سؤال
          </Button>
        )}
      </Form>
    </Modal>
  );
}
export function EnrollForm({
  courseId,
  studentId,
  onClose,
}: {
  courseId?: string;
  studentId?: string;
  onClose: () => void;
}) {
  const { data, refresh, notify } = useApp();
  return (
    <Modal title="تسجيل طالب في دورة" onClose={onClose}>
      <Form
        onCancel={onClose}
        onSubmit={async (d) => {
          await api("enroll", d);
          await refresh();
          notify("تم تسجيل الطالب في الدورة.");
          onClose();
        }}
      >
        <Field label="الدورة">
          <CourseSelect value={courseId} />
        </Field>
        <Field label="الطالب">
          <select name="student_id" required defaultValue={studentId ?? ""}>
            <option value="">اختر الطالب</option>
            {data.students
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </Field>
      </Form>
    </Modal>
  );
}
export async function fetchProfile(id: string) {
  return get<{ student: Student; profile: Profile }>("student", { id });
}
