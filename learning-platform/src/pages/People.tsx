import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Plus,
  DownloadSimple,
  ArrowRight,
  ShieldCheck,
  PencilSimple,
  Envelope,
  Phone,
  CalendarBlank,
  UserPlus,
  LockKey,
  CheckCircle,
} from "@phosphor-icons/react";
import {
  useApp,
  ar,
  date,
  progressPercent,
  downloadCsv,
  roles,
} from "../context";
import { api, fileUrl } from "../api";
import type { Profile, Student, User } from "../types";
import {
  PageHead,
  Panel,
  Search,
  Empty,
  Table,
  Avatar,
  Badge,
  Button,
  Progress,
  FileUpload,
} from "../components/ui";
import { UserForm, EnrollForm, fetchProfile } from "../components/forms";
export function Students() {
  const { data, user } = useApp();
  const [term, setTerm] = useState("");
  const [add, setAdd] = useState(false);
  const students = data.students.filter(
    (s) =>
      s.name.includes(term) ||
      s.email.toLowerCase().includes(term.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title={user.role === "guardian" ? "أبنائي" : "الطلاب والمتدربون"}
        subtitle="ملف متكامل لكل طالب، ومتابعة أقرب لكل خطوة."
      >
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(
              "tafaseel-students.csv",
              ["الاسم", "البريد", "الحالة", "الدورات"],
              students.map((s) => [
                s.name,
                s.email,
                s.active ? "نشط" : "موقوف",
                data.enrollments.filter((e) => e.student_id === s.id).length,
              ]),
            )
          }
        >
          <DownloadSimple size={18} />
          تصدير القائمة
        </Button>
        {user.role === "admin" && (
          <Button onClick={() => setAdd(true)}>
            <Plus size={18} />
            إضافة طالب
          </Button>
        )}
      </PageHead>
      <Panel>
        <div className="table-toolbar">
          <Search
            value={term}
            onChange={setTerm}
            placeholder="ابحث باسم الطالب أو بريده…"
          />
          <span className="muted">{ar(students.length)} طالب</span>
        </div>
        {students.length ? (
          <Table
            headers={[
              "الطالب",
              "البريد الإلكتروني",
              "الدورات المسجلة",
              "الحالة",
              "تاريخ الانضمام",
              "",
            ]}
          >
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/students/${s.id}`} className="person-cell">
                    <Avatar name={s.name} />
                    <div>
                      <strong>{s.name}</strong>
                      <small>{s.city || "لم تُحدد المدينة"}</small>
                    </div>
                  </Link>
                </td>
                <td dir="ltr" className="email-cell">
                  {s.email}
                </td>
                <td>
                  {ar(
                    data.enrollments.filter((e) => e.student_id === s.id)
                      .length,
                  )}{" "}
                  دورات
                </td>
                <td>
                  <Badge tone={s.active ? "green" : "gray"}>
                    {s.active ? "نشط" : "موقوف"}
                  </Badge>
                </td>
                <td>{date(s.created_at)}</td>
                <td>
                  <Link to={`/students/${s.id}`} className="text-link">
                    ملف الطالب
                    <ArrowRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title="لا يوجد طلاب هنا بعد"
            text="ستظهر ملفات الطلاب المرتبطين بحسابك في هذه المساحة."
          />
        )}
      </Panel>
      {add && <UserForm onClose={() => setAdd(false)} />}
    </>
  );
}
export function StudentDetail() {
  const { id } = useParams();
  const { data, user, notify, refresh } = useApp();
  const [result, setResult] = useState<{
    student: Student;
    profile: Profile;
  } | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  useEffect(() => {
    if (id)
      fetchProfile(id)
        .then(setResult)
        .catch((e) => setError(e.message));
  }, [id, modal]);
  if (error) return <Empty title="الملف غير متاح" text={error} />;
  if (!result)
    return <div className="compact-empty">جارٍ تحميل ملف الطالب…</div>;
  const { s: student, p: profile } = { s: result.student, p: result.profile };
  const enrollments = data.enrollments.filter((e) => e.student_id === id);
  const courses = data.courses.filter((c) =>
    enrollments.some((e) => e.course_id === c.id),
  );
  const attend = data.attendance.filter((a) => a.student_id === id);
  const rate = attend.length
    ? Math.round(
        (100 *
          attend.filter((a) => ["present", "late"].includes(a.status)).length) /
          attend.length,
      )
    : 0;
  const privateAccess = user.role !== "instructor";
  return (
    <>
      <Link to="/students" className="back-link">
        <ArrowRight size={17} />
        الطلاب والمتدربون
      </Link>
      <div className="student-hero">
        <Avatar size="lg" name={student.name} />
        <div>
          <h1>{student.name}</h1>
          <p>{student.email}</p>
          <Badge tone={student.active ? "green" : "gray"}>
            {student.active ? "حساب نشط" : "حساب موقوف"}
          </Badge>
        </div>
        {user.role === "admin" && (
          <div className="head-actions">
            <Button variant="secondary" onClick={() => setModal("edit")}>
              <PencilSimple size={18} />
              تعديل الملف
            </Button>
            <Button onClick={() => setModal("enroll")}>
              <UserPlus size={18} />
              تسجيل في دورة
            </Button>
          </div>
        )}
      </div>
      <div className="profile-grid">
        <div>
          <Panel
            title="المعلومات الأساسية"
            action={<ShieldCheck size={20} className="muted" />}
          >
            <dl className="details-list">
              <div>
                <dt>
                  <Envelope size={17} />
                  البريد الإلكتروني
                </dt>
                <dd dir="ltr">{student.email}</dd>
              </div>
              {privateAccess && (
                <div>
                  <dt>
                    <Phone size={17} />
                    جوال الطالب
                  </dt>
                  <dd dir="ltr">{profile.phone || "غير مضاف"}</dd>
                </div>
              )}
              {privateAccess && profile.legacy_contact && (
                <div>
                  <dt>جوال التواصل السابق (يتطلب مراجعة)</dt>
                  <dd dir="ltr">{profile.legacy_contact}</dd>
                </div>
              )}
              <div>
                <dt>
                  <CalendarBlank size={17} />
                  تاريخ الميلاد
                </dt>
                <dd>
                  {profile.birth_date ? date(profile.birth_date) : "غير مضاف"}
                </dd>
              </div>
              <div>
                <dt>المدينة</dt>
                <dd>{profile.city || "غير مضافة"}</dd>
              </div>
              {privateAccess && (
                <div>
                  <dt>
                    <LockKey size={17} />
                    رقم الهوية / الإقامة
                  </dt>
                  <dd dir="ltr">
                    {profile.identity_number || "لم تُجمع هذه المعلومة"}
                  </dd>
                </div>
              )}
            </dl>
            {privateAccess && (
              <p className="private-note">
                <LockKey size={15} />
                عرض هذه البيانات مسجل في سجل العمليات.
              </p>
            )}
          </Panel>
          {privateAccess && (
            <Panel title="بيانات ولي الأمر">
              <dl className="details-list">
                <div>
                  <dt>اسم ولي الأمر</dt>
                  <dd>{profile.guardian_name || "غير مضاف"}</dd>
                </div>
                <div>
                  <dt>جوال ولي الأمر</dt>
                  <dd dir="ltr">{profile.guardian_phone || "غير مضاف"}</dd>
                </div>
                <div>
                  <dt>حساب المتابعة</dt>
                  <dd>
                    <Badge tone={profile.guardian_id ? "green" : "gray"}>
                      {profile.guardian_id
                        ? "مرتبط بحساب ولي أمر"
                        : "لا يوجد حساب مرتبط"}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </Panel>
          )}
        </div>
        <div>
          <Panel title="ملخص الرحلة التدريبية">
            <div className="profile-stats">
              <div>
                <strong>{ar(courses.length)}</strong>
                <span>دورات مسجلة</span>
              </div>
              <div>
                <strong>{ar(rate)}٪</strong>
                <span>نسبة الحضور</span>
              </div>
              <div>
                <strong>
                  {ar(
                    data.certificates.filter((c) => c.student_id === id).length,
                  )}
                </strong>
                <span>شهادات مستحقة</span>
              </div>
            </div>
          </Panel>
          <Panel title="الدورات المسجلة">
            {courses.length ? (
              courses.map((c) => (
                <Link
                  to={`/courses/${c.id}`}
                  className="profile-course"
                  key={c.id}
                >
                  <img src={c.image} alt="" />
                  <div>
                    <h3>{c.title}</h3>
                    <Progress value={progressPercent(data, c.id, id)} />
                  </div>
                  <ArrowRight size={19} />
                </Link>
              ))
            ) : (
              <Empty
                title="لم يُسجل في دورة بعد"
                text="تضيف الإدارة الطالب إلى دورته من زر التسجيل."
              />
            )}
          </Panel>
          {privateAccess && (
            <Panel
              title="الملفات الخاصة"
              description="مرفقات الهوية متاحة للإدارة والطالب وولي أمره فقط."
            >
              <div className="simple-list">
                {data.files
                  .filter(
                    (f) => f.student_id === id && f.purpose === "identity",
                  )
                  .map((f) => (
                    <a key={f.id} href={fileUrl(f.id)}>
                      <LockKey size={22} />
                      <div>
                        <h3>{f.name}</h3>
                        <p>{date(f.created_at)}</p>
                      </div>
                      <DownloadSimple size={20} />
                    </a>
                  ))}
              </div>
              <FileUpload
                purpose="identity"
                studentId={id}
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onUploaded={() => {
                  refresh();
                  notify("تمت إضافة المرفق الخاص.");
                }}
              />
            </Panel>
          )}
        </div>
      </div>
      {modal === "edit" && (
        <UserForm
          user={student}
          profile={profile}
          onClose={() => setModal("")}
        />
      )}
      {modal === "enroll" && (
        <EnrollForm studentId={id} onClose={() => setModal("")} />
      )}
    </>
  );
}
export function Users() {
  const { data, notify, refresh } = useApp();
  const [term, setTerm] = useState("");
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const users = (data.users ?? []).filter(
    (u) => u.name.includes(term) || u.email.includes(term),
  );
  return (
    <>
      <PageHead
        title="الحسابات والصلاحيات"
        subtitle="وصول واضح، ومسؤولية محددة لكل عضو في المنصة."
      >
        <Button onClick={() => setAdd(true)}>
          <Plus size={18} />
          إضافة حساب
        </Button>
      </PageHead>
      <div className="permission-cards">
        {Object.entries(roles).map(([role, label]) => (
          <div key={role}>
            <ShieldCheck size={24} weight="duotone" />
            <strong>{label}</strong>
            <span>
              {ar(data.users?.filter((u) => u.role === role).length ?? 0)} حساب
            </span>
            <small>
              {role === "admin"
                ? "إدارة جميع أقسام المنصة"
                : role === "instructor"
                  ? "إدارة الدورات المسندة إليه"
                  : role === "student"
                    ? "التعلم في الدورات المسجلة"
                    : "متابعة الأبناء المرتبطين فقط"}
            </small>
          </div>
        ))}
      </div>
      <Panel>
        <div className="table-toolbar">
          <Search
            value={term}
            onChange={setTerm}
            placeholder="ابحث في الحسابات…"
          />
        </div>
        <Table
          headers={[
            "الاسم",
            "البريد الإلكتروني",
            "الدور",
            "الحالة",
            "الإجراءات",
          ]}
        >
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div className="person-cell">
                  <Avatar name={u.name} />
                  <strong>{u.name}</strong>
                </div>
              </td>
              <td dir="ltr">{u.email}</td>
              <td>{roles[u.role]}</td>
              <td>
                <Badge tone={u.active ? "green" : "gray"}>
                  {u.active ? "نشط" : "موقوف"}
                </Badge>
              </td>
              <td>
                {u.role === "admin" ? (
                  <span className="muted">
                    <LockKey size={17} /> مدير النظام
                  </span>
                ) : (
                  <div className="table-actions">
                    <button
                      className="text-link"
                      onClick={() => {
                        if (u.role === "student") {
                          notify("يمكن تعديل بيانات الطالب من ملفه الكامل.");
                          location.href = `/students/${u.id}`;
                        } else setEdit(u);
                      }}
                    >
                      تعديل
                    </button>
                    <button
                      className="text-link"
                      onClick={async () => {
                        try {
                          await api("user.toggle", { id: u.id });
                          await refresh();
                          notify(
                            u.active
                              ? "تم إيقاف الحساب وإبطال جلساته."
                              : "تم تفعيل الحساب.",
                          );
                        } catch (e) {
                          notify((e as Error).message, "error");
                        }
                      }}
                    >
                      {u.active ? "إيقاف" : "تفعيل"}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      <div className="alert">
        <CheckCircle size={21} />
        إيقاف الحساب يمنع تسجيل الدخول ويبطل جلساته الحالية. تبقى السجلات
        التعليمية محفوظة.
      </div>
      {add && (
        <UserForm defaultRole="instructor" onClose={() => setAdd(false)} />
      )}
      {edit && <UserForm user={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
