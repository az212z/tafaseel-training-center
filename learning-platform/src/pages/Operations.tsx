import { TrashButton } from "../components/TrashButton";
import { ResourcePreview, canPreview } from "../components/ResourcePreview";
import { TrainingReport } from "./LearningTools";
import { ZoomControl } from "./Communication";
import { asset, isStaticPreview } from "../environment";
import { useEffect, useState } from "react";
import { useDurableChanges } from "../hooks/useDurableChanges";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  VideoCamera,
  CalendarBlank,
  Clock,
  ArrowSquareOut,
  DownloadSimple,
  CheckCircle,
  UserCheck,
  FileText,
  LockKey,
  FolderOpen,
  Certificate as CertificateIcon,
  Printer,
  ChartBar,
  UsersThree,
  BookOpen,
} from "@phosphor-icons/react";
import {
  useApp,
  ar,
  date,
  time,
  downloadCsv,
  progressPercent,
  attendancePercent,
} from "../context";
import { api, get, fileUrl } from "../api";
import type { Certificate, Data, FileRecord } from "../types";
import {
  PageHead,
  Panel,
  Empty,
  Button,
  Badge,
  Modal,
  Form,
  Field,
  Search,
  FileUpload,
  Table,
  Status,
  Avatar,
  Progress,
} from "../components/ui";
import { ClassForm } from "../components/forms";
import { AttendanceAutomation } from "../components/AttendanceAutomation";
export function Schedule() {
  const { data, user } = useApp();
  const [params] = useSearchParams();
  const [add, setAdd] = useState(false);
  const [filter, setFilter] = useState("upcoming");
  const [course, setCourse] = useState(params.get("course") ?? "");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(clock);
  }, []);
  const staff = ["admin", "instructor"].includes(user.role);
  const classes = data.classes.filter(
    (c) =>
      (!course || c.course_id === course) &&
      (filter === "all" ||
        (filter === "upcoming"
          ? Date.parse(c.ends_at) >= now
          : Date.parse(c.ends_at) < now)),
  );
  return (
    <>
      <PageHead title={staff ? "جدول الحصص" : "حصصي"}>
        {staff && (
          <Button onClick={() => setAdd(true)}>
            <Plus size={18} />
            جدولة حصة
          </Button>
        )}
      </PageHead>
      <div className="filter-bar">
        <div className="segmented">
          {[
            ["upcoming", "القادمة"],
            ["past", "السابقة"],
            ["all", "جميع الحصص"],
          ].map(([k, l]) => (
            <button
              key={k}
              className={filter === k ? "active" : ""}
              onClick={() => setFilter(k)}
            >
              {l}
            </button>
          ))}
        </div>
        <select
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          aria-label="الدورة"
        >
          <option value="">جميع الدورات</option>
          {data.courses.map((c) => (
            <option value={c.id} key={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="schedule-list">
        {classes.map((c) => {
          const opens = Date.parse(c.starts_at) - 30 * 60 * 1000;
          const closed = now > Date.parse(c.ends_at) + 60 * 60 * 1000;
          const showZoom = c.zoom_status === "ready" || !c.join_url;
          return (
            <Panel key={c.id}>
              <div className="schedule-row">
                <div className="date-tile">
                  <strong>{date(c.starts_at, { day: "numeric" })}</strong>
                  <span>{date(c.starts_at, { month: "short" })}</span>
                </div>
                <div className="schedule-main">
                  <Badge tone="green">
                    {data.courses.find((x) => x.id === c.course_id)?.category}
                  </Badge>
                  <h2>{c.title}</h2>
                  <p>{data.courses.find((x) => x.id === c.course_id)?.title}</p>
                  <div className="schedule-meta">
                    <span>
                      <CalendarBlank size={17} />
                      {date(c.starts_at, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                    <span>
                      <Clock size={17} />
                      {time(c.starts_at)} – {time(c.ends_at)}
                    </span>
                    <span>
                      <VideoCamera size={17} />
                      {c.location}
                    </span>
                  </div>
                </div>
                <div className="schedule-actions">
                  {staff && (
                    <TrashButton kind="class" id={c.id} title={c.title} />
                  )}
                  {showZoom && (staff || user.role === "student") && (
                    <ZoomControl
                      classId={c.id}
                      status={c.zoom_status}
                      canHost={staff}
                      opensAt={
                        now < opens ? new Date(opens).toISOString() : undefined
                      }
                      closed={closed}
                    />
                  )}
                  {c.join_url && c.zoom_status !== "ready" && !closed ? (
                    <a
                      href={c.join_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn btn-primary"
                    >
                      دخول اللقاء
                      <ArrowSquareOut size={17} />
                    </a>
                  ) : null}
                  {staff && (
                    <Link
                      to={`/attendance?class=${c.id}`}
                      className="text-link"
                    >
                      <UserCheck size={18} />
                      رصد الحضور
                    </Link>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
      {!classes.length && (
        <Empty
          title="لا توجد حصص في هذه الفترة"
          text="ستظهر الحصص بعد جدولتها من إدارة المركز أو المدرب."
        />
      )}
      <p className="timezone-note">
        <Clock size={16} />
        جميع المواعيد المعروضة بتوقيت المملكة العربية السعودية.
      </p>
      {add && <ClassForm courseId={course} onClose={() => setAdd(false)} />}
    </>
  );
}
export function AttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data } = useApp();
  const initial =
    searchParams.get("class") ??
    data.classes.filter((c) => new Date(c.starts_at) < new Date()).at(-1)?.id ??
    data.classes[0]?.id ??
    "";
  const [classId, setClassId] = useState(initial);
  return (
    <AttendanceClass
      key={classId}
      classId={classId}
      onClassChange={(next) => {
        setClassId(next);
        const params = new URLSearchParams(searchParams);
        params.set("class", next);
        setSearchParams(params, { replace: true });
      }}
    />
  );
}
type AttendanceChange = {
  status: string;
  note: string;
  expected_status: string | null;
};
function AttendanceClass({
  classId,
  onClassChange,
}: {
  classId: string;
  onClassChange: (id: string) => void;
}) {
  const { data, user, notify, refresh } = useApp();
  const [note, setNote] = useState("");
  const [correction, setCorrection] = useState<{
    students: string[];
    status: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const staff = ["admin", "instructor"].includes(user.role);
  const selected = data.classes.find((c) => c.id === classId);
  const students = data.students.filter((s) =>
    data.enrollments.some(
      (e) => e.student_id === s.id && e.course_id === selected?.course_id,
    ),
  );
  const records = data.attendance.filter((a) => a.class_id === classId);
  const queue = useDurableChanges<AttendanceChange>(
    `tafaseel:attendance:${user.id}:${classId}`,
    async (entries) => {
      await api("attendance.save", {
        class_id: classId,
        autosave: true,
        records: entries.map(([student_id, change]) => ({
          student_id,
          ...change,
        })),
      });
      await refresh();
    },
    staff && !!selected,
  );
  const statusFor = (id: string) =>
    queue.values[id]?.status ??
    records.find((a) => a.student_id === id)?.status ??
    "";
  function stage(ids: string[], status: string, comment: string) {
    queue.enqueue(
      Object.fromEntries(
        ids.map((id) => [
          id,
          {
            status,
            note: comment,
            expected_status:
              records.find((r) => r.student_id === id)?.status ?? null,
          },
        ]),
      ),
    );
  }
  function choose(ids: string[], status: string) {
    const changed = ids.filter((id) => statusFor(id) !== status);
    if (!changed.length) return;
    if (
      changed.some((id) => records.some((r) => r.student_id === id)) &&
      note.trim().length < 3
    ) {
      setReason("");
      setCorrection({ students: changed, status });
    } else stage(changed, status, note);
  }
  async function save() {
    try {
      if (queue.errorStatus === 409 || queue.errorStatus === 422) {
        if (note.trim().length < 3) {
          notify("راجع آخر سجل، وأضف سبب التعديل لإعادة الحفظ.", "error");
          return;
        }
        const latest = await get<Data>("data", {
          course_id: selected!.course_id,
        });
        queue.enqueue(
          Object.fromEntries(
            Object.entries(queue.values).map(([id, change]) => [
              id,
              {
                ...change,
                note,
                expected_status:
                  latest.attendance.find(
                    (r) => r.class_id === classId && r.student_id === id,
                  )?.status ?? null,
              },
            ]),
          ),
        );
      }
      if (await queue.flush()) notify("تم حفظ سجل الحضور.");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  return (
    <>
      <PageHead
        title="الحضور والغياب"
        subtitle="متابعة دقيقة للحضور، بوضوح لكل طالب وحصة."
      >
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(
              "attendance.csv",
              ["الطالب", "الحصة", "الحالة", "الملاحظة"],
              students.map((s) => [
                s.name,
                selected?.title,
                statusFor(s.id),
                records.find((a) => a.student_id === s.id)?.note,
              ]),
            )
          }
        >
          <DownloadSimple size={18} />
          تصدير السجل
        </Button>
      </PageHead>
      {staff && (
        <div className="alert">
          بعد مهلة حضور ٢٠ دقيقة يُسجل الغياب تلقائيًا عند تفعيل المتابعة. تُرسل
          الرسائل إلى أرقام أولياء الأمور المفعّلة؛ تصحيح الغياب قبل الإرسال يلغي
          الرسالة المنتظرة.
        </div>
      )}
      {staff && selected && (
        <AttendanceAutomation key={selected.id} session={selected} />
      )}
      {staff && selected && (
        <div
          className={`alert ${queue.error ? "alert-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {queue.error ||
            (queue.saving || queue.dirty
              ? "جارٍ حفظ تغييرات الحضور… أبقِ الصفحة مفتوحة حتى تأكيد الحفظ."
              : queue.savedAt
                ? "تم حفظ جميع تغييرات الحضور."
                : "يُحفظ تحديد الحضور تلقائيًا. تعديل سجل محفوظ يتطلب سببًا.")}
        </div>
      )}
      <Panel>
        <div className="attendance-toolbar">
          <Field label="اختر الحصة التدريبية">
            <select
              value={classId}
              onChange={async (e) => {
                const next = e.target.value;
                if (await queue.flush()) onClassChange(next);
              }}
            >
              {data.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {data.courses.find((x) => x.id === c.course_id)?.title} —{" "}
                  {date(c.starts_at)} — {time(c.starts_at)}
                </option>
              ))}
            </select>
          </Field>
          {selected && (
            <div>
              <h3>{selected.title}</h3>
              <p>
                {selected.location} • {date(selected.starts_at)}
              </p>
            </div>
          )}
        </div>
        <div className="attendance-summary">
          {[
            ["present", "حاضر"],
            ["absent", "غائب"],
            ["late", "متأخر"],
            ["excused", "بعذر"],
          ].map(([k, l]) => (
            <div key={k}>
              <span className={`attendance-dot ${k}`} />
              <span>{l}</span>
              <strong>
                {ar(students.filter((s) => statusFor(s.id) === k).length)}
              </strong>
            </div>
          ))}
        </div>
        {students.length ? (
          <Table headers={["الطالب", "حالة الحضور", "آخر تحديث"]}>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="person-cell">
                    <Avatar name={s.name} />
                    <strong>{s.name}</strong>
                  </div>
                </td>
                <td>
                  {staff ? (
                    <div className="attendance-options">
                      {[
                        ["present", "حاضر"],
                        ["absent", "غائب"],
                        ["late", "متأخر"],
                        ["excused", "بعذر"],
                      ].map(([k, l]) => (
                        <button
                          className={
                            statusFor(s.id) === k ? `selected ${k}` : ""
                          }
                          onClick={() => choose([s.id], k)}
                          disabled={
                            !!queue.values[s.id] ||
                            (!!selected &&
                              new Date(selected.starts_at).getTime() >
                                Date.now() + 900000)
                          }
                          key={k}
                          aria-label={`${s.name}: ${l}`}
                          aria-pressed={statusFor(s.id) === k}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  ) : statusFor(s.id) ? (
                    <Status value={statusFor(s.id)} />
                  ) : (
                    <Badge>لم يُرصد</Badge>
                  )}
                </td>
                <td>
                  {queue.values[s.id] ? (
                    <Badge tone={queue.error ? "red" : "amber"}>
                      {queue.error ? "لم يؤكد الحفظ" : "جارٍ الحفظ"}
                    </Badge>
                  ) : records.find((a) => a.student_id === s.id) ? (
                    date(records.find((a) => a.student_id === s.id)!.updated_at)
                  ) : (
                    "لم يُرصد بعد"
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title="لا يوجد طلاب لهذه الحصة"
            text="اختر حصة أخرى أو سجّل الطلاب في دورتهم أولًا."
          />
        )}
        {staff && students.length > 0 && (
          <div className="attendance-save">
            <Field
              label="ملاحظة / سبب التعديل"
              hint="السبب مطلوب عند تعديل حضور محفوظ سابقًا."
            >
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="اكتب سبب تعديل الحضور…"
                maxLength={500}
              />
            </Field>
            <Button
              variant="secondary"
              disabled={queue.dirty || queue.saving}
              onClick={() =>
                choose(
                  students.map((s) => s.id),
                  "present",
                )
              }
            >
              <CheckCircle size={18} />
              تحديد الجميع حاضرًا
            </Button>
            <Button disabled={!queue.dirty || queue.saving} onClick={save}>
              {queue.saving
                ? "جارٍ الحفظ…"
                : queue.error
                  ? "إعادة محاولة الحفظ"
                  : "حفظ سجل الحضور"}
              <CheckCircle size={18} />
            </Button>
          </div>
        )}
      </Panel>
      {correction && (
        <Modal title="سبب تعديل الحضور" onClose={() => setCorrection(null)}>
          <Form
            submitLabel="تأكيد التعديل وحفظه"
            onSubmit={async () => {
              if (reason.trim().length < 3) return;
              stage(correction.students, correction.status, reason);
              setCorrection(null);
            }}
          >
            <p>هذا سجل محفوظ. أضف سببًا واضحًا لتوثيق التعديل قبل اعتماده.</p>
            <Field label="سبب التعديل">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={3}
                maxLength={500}
                required
                autoFocus
              />
            </Field>
          </Form>
        </Modal>
      )}
      <div className="alert">
        <LockKey size={19} />
        رصد الحضور متاح قبل بداية الحصة بـ١٥ دقيقة. التعديلات محفوظة باسم
        المسؤول وتاريخها.
      </div>
    </>
  );
}
export function FilesPage() {
  const { data, user, refresh } = useApp();
  const [term, setTerm] = useState("");
  const [course, setCourse] = useState("");
  const [add, setAdd] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [uploadCourse, setUploadCourse] = useState("");
  const staff = ["admin", "instructor"].includes(user.role);
  const files = data.files.filter(
    (f) => f.name.includes(term) && (!course || f.course_id === course),
  );
  return (
    <>
      <PageHead
        title="مكتبة الملفات"
        subtitle="المواد التدريبية والمرفقات، منظمة وفي متناولك."
      >
        {staff && (
          <Button onClick={() => setAdd(true)}>
            <Plus size={18} />
            رفع ملف تدريبي
          </Button>
        )}
      </PageHead>
      <div className="filter-bar">
        <Search
          value={term}
          onChange={setTerm}
          placeholder="ابحث باسم الملف…"
        />
        <select
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          aria-label="تصفية الملفات"
        >
          <option value="">جميع الملفات المسموحة</option>
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      {files.length ? (
        <Panel>
          <Table
            headers={[
              "الملف",
              "التصنيف",
              "الدورة / الطالب",
              "الحجم",
              "تاريخ الإضافة",
              "",
            ]}
          >
            {files.map((f) => (
              <tr key={f.id}>
                <td>
                  <div className="file-cell">
                    <span
                      className={
                        f.purpose === "identity"
                          ? "file-icon private"
                          : "file-icon"
                      }
                    >
                      {f.purpose === "identity" ? (
                        <LockKey size={24} />
                      ) : (
                        <FileText size={24} />
                      )}
                    </span>
                    <strong>{f.name}</strong>
                  </div>
                </td>
                <td>
                  <Badge tone={f.purpose === "identity" ? "amber" : "green"}>
                    {f.purpose === "identity"
                      ? "ملف خاص"
                      : f.purpose === "submission"
                        ? "تسليم واجب"
                        : "مادة تدريبية"}
                  </Badge>
                </td>
                <td>
                  {data.courses.find((c) => c.id === f.course_id)?.title ??
                    data.students.find((s) => s.id === f.student_id)?.name ??
                    "خاص"}
                </td>
                <td dir="ltr">{(f.bytes / 1024 / 1024).toFixed(2)} MB</td>
                <td>{date(f.created_at)}</td>
                <td>
                  <div className="table-actions">
                    {(user.role === "admin" ||
                      (staff && f.purpose === "resource")) && (
                      <TrashButton kind="file" id={f.id} title={f.name} />
                    )}
                    {canPreview(f) && (
                      <button
                        className="text-link"
                        onClick={() => setPreviewFile(f)}
                      >
                        فتح
                      </button>
                    )}
                    <a className="text-link" href={fileUrl(f.id)} download>
                      <DownloadSimple size={18} />
                      تنزيل
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      ) : (
        <Panel>
          <Empty
            title="مساحة لكل معرفة"
            text={
              isStaticPreview
                ? "جرّب إضافة PDF أو صور أو فيديو وهمي. تُحفظ الملفات في متصفحك فقط."
                : "أضف ملفات PDF والصور والفيديو من هنا أو من محتوى الدورة. تُرفع ملفات الهوية من ملف الطالب."
            }
            action={
              staff && (
                <Button onClick={() => setAdd(true)}>
                  <FolderOpen size={19} />
                  إضافة أول ملف
                </Button>
              )
            }
          />
        </Panel>
      )}
      <div className="alert">
        <ShieldNote />
        {isStaticPreview
          ? "الملفات التجريبية تُحفظ في هذا المتصفح فقط. رفع الهويات معطّل، ولا توجد حماية ملفات من خادم في نسخة العرض."
          : "ملفات الهوية مشفرة، والوصول إليها مقصور على الإدارة والطالب وولي أمره المرتبط."}
      </div>
      {previewFile && (
        <Modal title="عرض الملف" onClose={() => setPreviewFile(null)} wide>
          <ResourcePreview file={previewFile} />
        </Modal>
      )}
      {add && (
        <Modal title="رفع مادة تدريبية" onClose={() => setAdd(false)}>
          <Field label="الدورة التدريبية">
            <select
              value={uploadCourse}
              onChange={(e) => setUploadCourse(e.target.value)}
            >
              <option value="">اختر الدورة أولًا</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          {uploadCourse && (
            <FileUpload
              purpose="resource"
              courseId={uploadCourse}
              onUploaded={async () => {
                await refresh();
                setAdd(false);
              }}
            />
          )}
          <p className="muted">
            للفيديوهات الطويلة استخدم رابط YouTube أو Vimeo في إضافة الدروس.
          </p>
        </Modal>
      )}
    </>
  );
}
function ShieldNote() {
  return <LockKey size={19} />;
}
export function Certificates() {
  const { data, user } = useApp();
  const [selected, setSelected] = useState<Certificate | null>(null);
  const staff = ["admin", "instructor"].includes(user.role);
  return (
    <>
      <PageHead
        title="الشهادات"
        subtitle="توثيق للإنجاز، وذكرى لرحلة تعلّم تستحق الفخر."
      >
        {staff && (
          <Link className="btn btn-primary" to="/students">
            <Plus size={18} /> مراجعة طالب وإصدار شهادة
          </Link>
        )}
      </PageHead>
      {data.certificates.length ? (
        <div className="certificate-grid">
          {data.certificates.map((c) => (
            <Panel key={c.id}>
              <span className="certificate-symbol">
                <CertificateIcon size={42} weight="duotone" />
              </span>
              <Badge tone="green">شهادة إتمام</Badge>
              <h2>{c.course_title}</h2>
              {user.role === "admin" && (
                <TrashButton
                  kind="certificate"
                  id={c.id}
                  title={c.course_title}
                />
              )}
              <p>{c.student_name}</p>
              <small dir="ltr">{c.serial}</small>
              <Button variant="secondary" onClick={() => setSelected(c)}>
                <EyeIcon />
                عرض وطباعة
              </Button>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty
            title="إنجازاتك القادمة تبدأ من هنا"
            text={
              staff
                ? "تُصدر الشهادة بعد إكمال الدروس واجتياز الواجبات والاختبارات وتحقيق نسبة الحضور المطلوبة."
                : "أكمل دروسك وواجباتك واختباراتك. تصدر الإدارة شهادتك عند استيفاء المتطلبات."
            }
          />
        </Panel>
      )}
      <div className="alert">
        <CertificateIcon size={20} />
        الشهادة توثّق إتمام دورة داخل المركز. لا يُعرض اعتماد خارجي دون توثيقه.
      </div>
      {selected && (
        <Modal
          title="شهادة إتمام الدورة"
          onClose={() => setSelected(null)}
          wide
        >
          <div className="print-certificate" id="certificate">
            <div className="certificate-top">
              <img src={asset("/brand/logo.webp")} alt="مركز تفاصيل للتدريب" />
              <span>{data.settings.name}</span>
            </div>
            <CertificateIcon size={64} weight="duotone" />
            <h2>شهادة إتمام</h2>
            <p>يشهد مركز تفاصيل للتدريب بأن</p>
            <h1>{selected.student_name}</h1>
            <p>قد أتمّ متطلبات الدورة التدريبية</p>
            <h2>{selected.course_title}</h2>
            <p>بواقع {ar(selected.duration)} ساعة تدريبية</p>
            <div className="certificate-bottom">
              <span>
                تاريخ الإصدار
                <br />
                {date(selected.issued_at)}
              </span>
              <span dir="ltr">{selected.serial}</span>
              <span>
                إدارة المركز
                <br />
                مركز تفاصيل للتدريب
              </span>
            </div>
          </div>
          <Button onClick={() => window.print()}>
            <Printer size={18} />
            طباعة أو حفظ PDF
          </Button>
        </Modal>
      )}
    </>
  );
}
function EyeIcon() {
  return <CertificateIcon size={18} />;
}
export function Reports() {
  const { user } = useApp();
  return ["admin", "instructor"].includes(user.role) ? (
    <TrainingReport />
  ) : (
    <LegacyReports />
  );
}
function LegacyReports() {
  const { data, user } = useApp();
  const [course, setCourse] = useState("");
  const courses = data.courses.filter((c) => !course || c.id === course);
  const classes = data.classes.filter((c) => !course || c.course_id === course);
  const attendance = data.attendance.filter((a) =>
    classes.some((c) => c.id === a.class_id),
  );
  const ratio = attendancePercent(attendance);
  return (
    <>
      <PageHead
        title="التقارير والإحصاءات"
        subtitle="نسبة الحضور من السجلات المرصودة؛ المتأخر حاضر، والغياب بعذر مستبعد من النسبة."
      >
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(
              "learning-report.csv",
              ["الدورة", "الطلاب", "الدروس", "متوسط الإنجاز", "الحالة"],
              courses.map((c) => [
                c.title,
                c.students_count,
                c.lessons_count,
                progressPercent(
                  data,
                  c.id,
                  user.role === "student" ? user.id : undefined,
                ) + "%",
                c.status,
              ]),
            )
          }
        >
          <DownloadSimple size={18} />
          تصدير التقرير
        </Button>
      </PageHead>
      <div className="filter-bar">
        <select
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          aria-label="الدورة في التقرير"
        >
          <option value="">جميع الدورات</option>
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="report-stats">
        {[
          [UsersThree, "الطلاب", data.students.length],
          [BookOpen, "الدورات", courses.length],
          [UserCheck, "نسبة الحضور", ratio + "٪"],
          [
            ChartBar,
            "التسليمات المقيمة",
            data.submissions.filter(
              (s) =>
                s.score !== null &&
                data.assignments.some(
                  (a) =>
                    a.id === s.assignment_id &&
                    (!course || a.course_id === course),
                ),
            ).length,
          ],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof UsersThree;
          return (
            <Panel key={String(label)}>
              <I size={27} weight="duotone" />
              <strong>
                {typeof value === "number" ? ar(value) : String(value)}
              </strong>
              <span>{String(label)}</span>
            </Panel>
          );
        })}
      </div>
      <div className="reports-grid">
        <Panel
          title="تقدّم الدورات"
          description="نسبة الدروس التي أكد الطلاب إكمالها"
        >
          {courses
            .filter((c) => c.lessons_count > 0)
            .map((c) => (
              <div className="report-course" key={c.id}>
                <div>
                  <strong>{c.title}</strong>
                  <small>{ar(c.students_count)} طالب</small>
                </div>
                <Progress
                  value={progressPercent(
                    data,
                    c.id,
                    user.role === "student" ? user.id : undefined,
                  )}
                />
              </div>
            ))}
        </Panel>
        <Panel
          title="توزيع الحضور"
          description="للسجلات المرصودة في الدورات المختارة"
        >
          {[
            ["present", "حضور", "#2d7970"],
            ["late", "تأخر", "#bc913b"],
            ["absent", "غياب", "#c76767"],
            ["excused", "بعذر", "#668db2"],
          ].map(([key, label, color]) => {
            const n = attendance.filter((a) => a.status === key).length;
            return (
              <div className="attendance-chart-row" key={key}>
                <span>{label}</span>
                <div>
                  <i
                    style={{
                      width: `${attendance.length ? (n / attendance.length) * 100 : 0}%`,
                      background: color,
                    }}
                  />
                </div>
                <strong>{ar(n)}</strong>
              </div>
            );
          })}
          <div className="report-note">
            الحصص غير المرصودة لا تُحسب غيابًا تلقائيًا. إجمالي السجلات:{" "}
            {ar(attendance.length)}.
          </div>
        </Panel>
      </div>
      <Panel title="تقرير تفصيلي للدورات">
        <Table
          headers={["الدورة", "الطلاب", "الدروس", "متوسط الإنجاز", "الحالة"]}
        >
          {courses.map((c) => (
            <tr key={c.id}>
              <td>
                <Link to={`/courses/${c.id}`}>{c.title}</Link>
              </td>
              <td>{ar(c.students_count)}</td>
              <td>{ar(c.lessons_count)}</td>
              <td>
                <Progress
                  value={progressPercent(
                    data,
                    c.id,
                    user.role === "student" ? user.id : undefined,
                  )}
                />
              </td>
              <td>
                <Status value={c.status} />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
