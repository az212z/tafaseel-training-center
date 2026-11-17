import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, get } from "../api";
import { useApp, ar, downloadCsv } from "../context";
import { useRemote, RemoteState, Pagination } from "../components/remote";
import {
  Badge,
  Button,
  Empty,
  Field,
  Form,
  Modal,
  PageHead,
  Panel,
  Progress,
  Table,
} from "../components/ui";
import type { PageResult } from "../types";

type Path = {
  id: string;
  title: string;
  description: string;
  level: string;
  goals: string;
  status: string;
  courses: { id: string; title: string; duration: number }[];
  completed: string[];
};
export function PublicPathDirectory() {
  return (
    <div className="site-container learning-directory">
      <h1>مسارات التعلم</h1>
      <p>
        دورات مترابطة بترتيب مقترح، وأهداف واضحة لكل رحلة. التسجيل والرسوم
        مستقلان لكل دورة، ويظهر اجتيازها بعد إصدار شهادة إتمامها.
      </p>
      <PathDirectory />
    </div>
  );
}
export function Paths() {
  const { user } = useApp();
  const [edit, setEdit] = useState<Path | null | undefined>(undefined);
  const [revision, setRevision] = useState(0);
  return (
    <>
      <PageHead
        title="مسارات التعلم"
        subtitle="رحلة واضحة من البداية إلى اجتياز الدورات."
      >
        {user.role === "admin" && (
          <Button onClick={() => setEdit(null)}>إنشاء مسار</Button>
        )}
      </PageHead>
      <PathDirectory
        key={revision}
        manage={user.role === "admin"}
        onEdit={setEdit}
      />
      {edit !== undefined && (
        <PathEditor
          path={edit}
          onClose={() => setEdit(undefined)}
          onSaved={() => {
            setEdit(undefined);
            setRevision((x) => x + 1);
          }}
        />
      )}
    </>
  );
}
function PathDirectory({
  manage = false,
  onEdit,
}: {
  manage?: boolean;
  onEdit?: (p: Path) => void;
}) {
  const [page, setPage] = useState(1);
  const remote = useRemote<PageResult<Path>>("learning.paths", {
    page: String(page),
  });
  return (
    <>
      <RemoteState {...remote} />
      <div className="learning-path-grid">
        {remote.result?.items.map((p) => (
          <Panel key={p.id}>
            <div className="inline-badges">
              <Badge>{p.level}</Badge>
              {manage && (
                <Badge>
                  {p.status === "published"
                    ? "منشور"
                    : p.status === "draft"
                      ? "مسودة"
                      : "مؤرشف"}
                </Badge>
              )}
            </div>
            <h2>{p.title}</h2>
            <p>{p.description}</p>
            <div className="path-goals">{p.goals}</div>
            <ol className="path-course-list">
              {p.courses.map((c) => (
                <li key={c.id}>
                  <Link
                    to={manage ? "/courses/" + c.id : "/catalog?course=" + c.id}
                  >
                    {c.title}
                  </Link>
                  <small>
                    {ar(c.duration)} ساعة
                    {p.completed.includes(c.id) ? " · مجتاز بشهادة" : ""}
                  </small>
                </li>
              ))}
            </ol>
            {p.completed.length > 0 && (
              <Progress
                value={Math.round(
                  (100 * p.completed.length) / p.courses.length,
                )}
              />
            )}{" "}
            {manage && (
              <Button variant="secondary" onClick={() => onEdit?.(p)}>
                تعديل وترتيب المسار
              </Button>
            )}
          </Panel>
        ))}
      </div>
      {remote.result && !remote.result.total && (
        <Empty
          title="نجهّز مسارات التعلم"
          text="تظهر هنا المسارات بعد نشرها مع دوراتها."
        />
      )}
      {remote.result && (
        <Pagination page={page} total={remote.result.total} onPage={setPage} />
      )}
    </>
  );
}
function PathEditor({
  path,
  onClose,
  onSaved,
}: {
  path: Path | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data } = useApp();
  const [ids, setIds] = useState(path?.courses.map((c) => c.id) ?? []);
  const [choice, setChoice] = useState("");
  return (
    <Modal
      title={path ? "تعديل المسار" : "مسار تعليمي جديد"}
      onClose={onClose}
      wide
    >
      <Form
        onCancel={onClose}
        onSubmit={async (d) => {
          await api("path.save", { ...d, id: path?.id, course_ids: ids });
          onSaved();
        }}
      >
        <Field label="اسم المسار">
          <input
            required
            name="title"
            maxLength={200}
            defaultValue={path?.title}
          />
        </Field>
        <Field label="وصف المسار">
          <textarea
            required
            name="description"
            maxLength={5000}
            defaultValue={path?.description}
          />
        </Field>
        <Field label="المستوى">
          <input
            required
            name="level"
            maxLength={60}
            defaultValue={path?.level ?? "مبتدئ"}
          />
        </Field>
        <Field label="المهارات والأهداف">
          <textarea
            required
            name="goals"
            maxLength={3000}
            defaultValue={path?.goals}
          />
        </Field>
        <Field label="حالة المسار">
          <select name="status" defaultValue={path?.status ?? "draft"}>
            <option value="draft">مسودة</option>
            <option value="published">منشور</option>
            <option value="archived">مؤرشف</option>
          </select>
        </Field>
        <Field label="إضافة دورة إلى المسار">
          <select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">اختر دورة</option>
            {data.courses
              .filter((c) => !ids.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}{" "}
                  {c.status !== "published" ? "(مسودة أو مؤرشفة)" : ""}
                </option>
              ))}
          </select>
        </Field>
        <Button
          type="button"
          variant="secondary"
          disabled={!choice || ids.length >= 50}
          onClick={() => {
            setIds([...ids, choice]);
            setChoice("");
          }}
        >
          إضافة إلى الترتيب
        </Button>
        <ol className="path-course-list">
          {ids.map((id, i) => (
            <li key={id}>
              <strong>{data.courses.find((c) => c.id === id)?.title}</strong>
              <div className="head-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={i === 0}
                  onClick={() => {
                    const a = [...ids];
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    setIds(a);
                  }}
                >
                  تقديم
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIds(ids.filter((x) => x !== id))}
                >
                  إزالة
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <p className="muted">
          لا يُنشر المسار حتى تُنشر دوراته. ترتيب التعلم إرشادي، ولا يسجّل الطلاب
          في دورة مدفوعة تلقائيًا.
        </p>
      </Form>
    </Modal>
  );
}

type Discussion = {
  id: string;
  title: string;
  body: string;
  author_name: string;
  author_role: string;
  status: string;
  replies: number;
};
export function CourseCommunity({ courseId }: { courseId: string }) {
  const { user, notify } = useApp();
  const [thread, setThread] = useState<Discussion | null>(null);
  const [page, setPage] = useState(1);
  const remote = useRemote<PageResult<Discussion>>("discussion.list", {
    course_id: courseId,
    parent_id: thread?.id ?? "",
    page: String(page),
  });
  const staff = ["admin", "instructor"].includes(user.role);
  const close = () => {
    setThread(null);
    setPage(1);
  };
  return (
    <Panel
      title="نقاشات الدورة"
      description="اسأل، ناقش التطبيق العملي، واستفد من ردود مدربك وزملائك."
    >
      <RemoteState {...remote} />
      {thread && (
        <article className="discussion-post">
          <Button variant="secondary" onClick={close}>
            العودة لجميع النقاشات
          </Button>
          <h3>{thread.title}</h3>
          <p>{thread.body}</p>
          <small>{thread.author_name}</small>
        </article>
      )}
      {remote.result?.items.map((p) => (
        <article className="discussion-post" key={p.id}>
          <div className="inline-badges">
            <Badge>
              {p.author_role === "instructor"
                ? "المدرب"
                : p.author_role === "admin"
                  ? "الإدارة"
                  : "متدرب"}
            </Badge>
            {p.status === "resolved" && <Badge>تمت الإجابة</Badge>}
          </div>
          {p.title && <h3>{p.title}</h3>}
          <p>{p.body}</p>
          <small>{p.author_name}</small>
          <div className="head-actions">
            {!thread && (
              <Button
                variant="secondary"
                onClick={() => {
                  setThread(p);
                  setPage(1);
                }}
              >
                الردود ({ar(p.replies)})
              </Button>
            )}
            {staff && !thread && (
              <>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await api("discussion.status", {
                        id: p.id,
                        status: p.status === "resolved" ? "open" : "resolved",
                      });
                      remote.reload();
                    } catch (e) {
                      notify((e as Error).message, "error");
                    }
                  }}
                >
                  {p.status === "resolved" ? "فتح النقاش" : "تحديده كمجاب"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await api("discussion.status", {
                        id: p.id,
                        status: "hidden",
                      });
                      remote.reload();
                    } catch (e) {
                      notify((e as Error).message, "error");
                    }
                  }}
                >
                  إخفاء
                </Button>
              </>
            )}
          </div>
        </article>
      ))}
      {remote.result && (
        <Pagination page={page} total={remote.result.total} onPage={setPage} />
      )}{" "}
      {user.role !== "guardian" && (!thread || thread.status === "open") && (
        <Form
          key={thread?.id ?? "new"}
          submitLabel={thread ? "إرسال الرد" : "نشر السؤال"}
          onSubmit={async (d) => {
            await api("discussion.save", {
              ...d,
              course_id: courseId,
              parent_id: thread?.id,
            });
            remote.reload();
            notify("تم نشر المشاركة.");
          }}
        >
          {!thread && (
            <Field label="عنوان السؤال">
              <input name="title" required maxLength={200} />
            </Field>
          )}
          <Field label={thread ? "ردك" : "سؤالك أو موضوع النقاش"}>
            <textarea name="body" required maxLength={3000} rows={3} />
          </Field>
          <p className="muted">
            يرى المشاركات المسجلون في الدورة. تجنب نشر أرقام الهوية أو بيانات
            التواصل الخاصة.
          </p>
        </Form>
      )}
    </Panel>
  );
}

export function LessonNotebook({
  lessonId,
  video,
}: {
  lessonId: string;
  video: HTMLVideoElement | null;
}) {
  const { notify } = useApp();
  const [body, setBody] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    setReady(false);
    get<{ note: { body: string; bookmarked: number; seconds: number } | null }>(
      "lesson.note",
      { lesson_id: lessonId },
    )
      .then((r) => {
        if (alive.current) {
          setBody(r.note?.body ?? "");
          setBookmarked(Boolean(r.note?.bookmarked));
          setSeconds(r.note?.seconds ?? 0);
          setReady(true);
        }
      })
      .catch((e) => {
        if (alive.current) setError(e.message);
      });
    return () => {
      alive.current = false;
    };
  }, [lessonId]);
  return (
    <section className="lesson-notebook">
      <h3>دفتر الدرس الخاص</h3>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {ready && (
        <Form
          submitLabel="حفظ ملاحظاتي"
          onSubmit={async () => {
            const position = video ? Math.floor(video.currentTime) : seconds;
            await api("lesson.note.save", {
              lesson_id: lessonId,
              body,
              bookmarked,
              seconds: position,
            });
            setSeconds(position);
            notify("حُفظت ملاحظاتك الخاصة.");
          }}
        >
          <Field label="ملاحظاتي">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={3}
            />
          </Field>
          <label className="check-label">
            <input
              type="checkbox"
              checked={bookmarked}
              onChange={(e) => setBookmarked(e.target.checked)}
            />
            حفظ الدرس للمراجعة
          </label>
          {video && seconds > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                video.currentTime = seconds;
              }}
            >
              استئناف من {Math.floor(seconds / 60)}:
              {String(seconds % 60).padStart(2, "0")}
            </Button>
          )}
          <small>
            الملاحظات تخص حسابك وحده. يُحفظ موضع الفيديو المرفوع عند الضغط على
            الحفظ.
          </small>
        </Form>
      )}
    </section>
  );
}

export function CourseSurvey({ courseId }: { courseId: string }) {
  const { user, notify } = useApp();
  const staff = ["admin", "instructor"].includes(user.role);
  const remote = useRemote<{
    response?: unknown;
    summary?: {
      responses: number;
      content_rating: number | null;
      trainer_rating: number | null;
      experience_rating: number | null;
    };
  }>("survey", { course_id: courseId }, user.role !== "guardian");
  return (
    <Panel
      title="تقييم التجربة التدريبية"
      description="يساعدنا رأيك بعد إكمال دروس الدورة في تحسين المحتوى والتدريب والخدمة."
    >
      <RemoteState {...remote} />
      {staff ? (
        <div className="report-stats">
          {[
            ["responses", "عدد التقييمات"],
            ["content_rating", "المحتوى من ٥"],
            ["trainer_rating", "المدرب من ٥"],
            ["experience_rating", "التجربة من ٥"],
          ].map(([key, label]) => (
            <div key={key}>
              <strong>
                {remote.result?.summary?.[
                  key as keyof NonNullable<typeof remote.result>["summary"]
                ] ?? "—"}
              </strong>
              <p>{label}</p>
            </div>
          ))}
        </div>
      ) : user.role === "guardian" ? (
        <p>التقييم يرسله المتدرب من حسابه.</p>
      ) : remote.result?.response ? (
        <div className="alert">وصلنا تقييمك. شكرًا لمساعدتنا في التطوير.</div>
      ) : (
        !remote.loading && (
          <Form
            submitLabel="إرسال التقييم"
            onSubmit={async (d) => {
              await api("survey.save", {
                course_id: courseId,
                content_rating: Number(d.content_rating),
                trainer_rating: Number(d.trainer_rating),
                experience_rating: Number(d.experience_rating),
                comment: d.comment,
              });
              remote.reload();
              notify("شكرًا لك، وصلنا تقييمك.");
            }}
          >
            {[
              ["content_rating", "جودة المحتوى"],
              ["trainer_rating", "أداء المدرب"],
              ["experience_rating", "سهولة التجربة"],
            ].map(([key, label]) => (
              <Field label={label} key={key}>
                <select required name={key} defaultValue="">
                  <option value="">اختر تقييمك</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} من ٥
                    </option>
                  ))}
                </select>
              </Field>
            ))}
            <Field label="تعليق أو اقتراح (اختياري)">
              <textarea name="comment" maxLength={2000} />
            </Field>
          </Form>
        )
      )}
    </Panel>
  );
}

type Batch = {
  items: { email: string; name: string; status: string }[];
  duplicates: number;
  ready: number;
  available: number;
  can_apply: boolean;
  enrolled: number;
};
export function BatchEnrollment({ onClose }: { onClose: () => void }) {
  const { data, refresh, notify } = useApp();
  const [course, setCourse] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Batch | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (apply = false) => {
    setBusy(true);
    setError("");
    try {
      const r = await api<Batch>(
        apply ? "enrollment.batch" : "enrollment.preview",
        { course_id: course, csv },
      );
      setPreview(r);
      if (apply) {
        await refresh();
        notify(
          `تم تسجيل ${ar(r.enrolled)} طالب. الحسابات المسجلة سابقًا لم تتكرر.`,
        );
        onClose();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="تسجيل مجموعة في دورة" onClose={onClose} wide>
      <p>
        استخدم عمود بريد إلكتروني واحدًا لحسابات طلاب نشطة موجودة. راجع المعاينة
        قبل التسجيل؛ الدفعة الواحدة حتى ١٠٠ طالب.
      </p>
      <Field label="الدورة">
        <select
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            setPreview(null);
          }}
        >
          <option value="">اختر الدورة</option>
          {data.courses
            .filter((c) => c.status === "published")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
        </select>
      </Field>
      <Field label="ملف CSV (اختياري)">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 32000) {
                setError("الملف أكبر من ٣٢ كيلوبايت.");
                return;
              }
              setCsv(await file.text());
              setPreview(null);
            }
          }}
        />
      </Field>
      <Field label="البريد الإلكتروني، سطر لكل طالب">
        <textarea
          rows={7}
          value={csv}
          maxLength={16000}
          dir="ltr"
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
        />
      </Field>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <Button disabled={!course || !csv || busy} onClick={() => run()}>
        فحص ومعاينة الدفعة
      </Button>
      {preview && (
        <>
          <p>
            {ar(preview.ready)} جاهز للتسجيل · {ar(preview.available)} مقعد متاح
            · {ar(preview.duplicates)} بريد مكرر أُزيل
          </p>
          <Table headers={["البريد", "الطالب", "النتيجة"]}>
            {preview.items.map((i) => (
              <tr key={i.email}>
                <td dir="ltr">{i.email}</td>
                <td>{i.name || "—"}</td>
                <td>
                  {
                    {
                      ready: "جاهز",
                      enrolled: "مسجل سابقًا",
                      unknown: "غير موجود",
                      inactive: "غير نشط",
                    }[i.status]
                  }
                </td>
              </tr>
            ))}
          </Table>
          <Button
            disabled={!preview.can_apply || busy}
            onClick={() => run(true)}
          >
            اعتماد تسجيل المجموعة
          </Button>
        </>
      )}
    </Modal>
  );
}

type ReportRow = {
  id: string;
  title: string;
  status: string;
  students: number;
  lessons: number;
  completed: number;
  certificates: number;
  graded: number;
  survey_responses: number;
  satisfaction: number | null;
};
type Report = PageResult<ReportRow> & {
  attendance: { status: string; records: number }[];
  summary: { students: number; enrollments: number };
};
export function TrainingReport() {
  const { data } = useApp();
  const [course, setCourse] = useState("");
  const [page, setPage] = useState(1);
  const remote = useRemote<Report>("training.report", {
    course_id: course,
    page: String(page),
  });
  const r = remote.result;
  const percent = (x: ReportRow) =>
    Number(x.students) * Number(x.lessons)
      ? Math.round(
          (100 * Number(x.completed)) /
            (Number(x.students) * Number(x.lessons)),
        )
      : 0;
  return (
    <>
      <PageHead
        title="التقارير وقياس أثر التدريب"
        subtitle="حساب مباشر من جميع سجلات الدورات المتاحة لك، مع عرض النتائج على صفحات."
      >
        <Button
          variant="secondary"
          disabled={!r}
          onClick={() =>
            downloadCsv(
              "training-report-page.csv",
              [
                "الدورة",
                "الطلاب",
                "الدروس",
                "إنجاز الدروس",
                "الشهادات",
                "واجبات مقيمة",
                "عدد التقييمات",
                "الرضا من 5",
              ],
              r?.items.map((x) => [
                x.title,
                x.students,
                x.lessons,
                percent(x) + "%",
                x.certificates,
                x.graded,
                x.survey_responses,
                x.satisfaction,
              ]) ?? [],
            )
          }
        >
          تصدير صفحة التقرير
        </Button>
      </PageHead>
      <Field label="الدورة في التقرير">
        <select
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل الدورات</option>
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </Field>
      <RemoteState {...remote} />
      {r && (
        <>
          <div className="report-stats">
            <Panel title="الطلاب">
              <strong>{ar(Number(r.summary.students))}</strong>
            </Panel>
            <Panel title="التسجيلات">
              <strong>{ar(Number(r.summary.enrollments))}</strong>
            </Panel>
            <Panel title="الدورات">
              <strong>{ar(r.total)}</strong>
            </Panel>
            <Panel title="الحضور المرصود">
              <strong>
                {ar(r.attendance.reduce((n, x) => n + Number(x.records), 0))}
              </strong>
            </Panel>
          </div>
          <Panel title="نتائج الدورات">
            <Table
              headers={[
                "الدورة",
                "الطلاب",
                "إنجاز الدروس",
                "الشهادات",
                "التقييمات",
                "الرضا من ٥",
              ]}
            >
              {r.items.map((x) => (
                <tr key={x.id}>
                  <td>
                    <Link to={"/courses/" + x.id}>{x.title}</Link>
                  </td>
                  <td>{ar(Number(x.students))}</td>
                  <td>
                    <Progress value={percent(x)} />
                  </td>
                  <td>{ar(Number(x.certificates))}</td>
                  <td>{ar(Number(x.survey_responses))}</td>
                  <td>
                    {x.satisfaction ? Number(x.satisfaction).toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} total={r.total} onPage={setPage} />
          </Panel>
          <Panel title="توزيع سجلات الحضور">
            <div className="inline-badges">
              {r.attendance.map((x) => (
                <Badge key={x.status}>
                  {
                    {
                      present: "حاضر",
                      absent: "غائب",
                      late: "متأخر",
                      excused: "بعذر",
                    }[x.status]
                  }
                  : {ar(Number(x.records))}
                </Badge>
              ))}
            </div>
            <p className="muted">
              السجلات غير المرصودة لا تُعد غيابًا. إنجاز الدروس تأكيد من المتدرب
              ولا يُثبت مدة مشاهدة الفيديو أو اعتماد الشهادة.
            </p>
          </Panel>
        </>
      )}
    </>
  );
}

export function LaunchChecklist() {
  const remote = useRemote<{
    services: Record<
      string,
      { enabled: boolean; configured: boolean; mode?: string }
    >;
    worker_last_run: unknown;
    published_courses: number;
    courses_with_content: number;
    pending_accounts: number;
    review_payments: number;
    demo: boolean;
    environment: string;
  }>("launch.checklist");
  const r = remote.result;
  return (
    <>
      <PageHead
        title="مركز الجاهزية والتشغيل"
        subtitle="مؤشرات تشغيلية مباشرة. إعداد بيانات الخدمة يحتاج تجربة حقيقية قبل اعتماد جاهزيتها."
      />
      <RemoteState {...remote} />
      {r && (
        <>
          <div className="report-stats">
            <Panel title="الدورات المنشورة">
              <strong>{ar(r.published_courses)}</strong>
            </Panel>
            <Panel title="منشور وله محتوى">
              <strong>{ar(r.courses_with_content)}</strong>
            </Panel>
            <Panel title="حسابات تنتظر المراجعة">
              <strong>{ar(r.pending_accounts)}</strong>
            </Panel>
            <Panel title="مدفوعات تحتاج متابعة">
              <strong>{ar(r.review_payments)}</strong>
            </Panel>
          </div>
          <Panel title="الخدمات الخارجية">
            <Table
              headers={["الخدمة", "إعداد الاتصال", "الاحتياج قبل التشغيل"]}
            >
              {Object.entries(r.services).map(([key, status]) => (
                <tr key={key}>
                  <td>
                    {{
                      moyasar: "الدفع الإلكتروني",
                      sms: "الرسائل النصية",
                      zoom: "اللقاءات المباشرة",
                      video: "بث الفيديو",
                      s3: "تخزين الملفات",
                    }[key] ?? key}
                  </td>
                  <td>
                    {status.configured ? "مهيأ؛ يلزم تحقق خارجي" : "غير مفعّل"}
                    {status.configured && status.mode
                      ? " · " +
                        ({
                          test: "وضع اختبار",
                          live: "وضع حي",
                          configured: "بيانات مدخلة",
                        }[status.mode] ?? "")
                      : ""}
                  </td>
                  <td>
                    {
                      {
                        moyasar: "حساب تجاري وتجربة سداد واسترداد حقيقيين",
                        sms: "حساب رسائل واسم مرسل معتمد وتجربة وصول",
                        zoom: "حساب الجهة وتفويض الاجتماعات وتجربة حضور",
                        video: "مكتبة بث مملوكة للمركز وتجربة رفع وتشغيل",
                        s3: "مساحة تخزين ومفاتيح مقيّدة وتجربة استعادة",
                      }[key]
                    }
                  </td>
                </tr>
              ))}
            </Table>
            <Link to="/integrations" className="text-link">
              عرض تفاصيل الربط
            </Link>
          </Panel>
          <Panel title="متطلبات اعتماد الإطلاق">
            <ul>
              <li>
                نشر محتوى تدريبي نهائي ومراجعة بيانات المدربين والرسوم
                والمواعيد.
              </li>
              <li>
                توثيق استعادة نسخة احتياطية للبيانات والملفات ومفتاح التشفير.
              </li>
              <li>
                تفعيل مهمة المعالجة المجدولة وتجربة المراقبة وتنبيهات الأعطال.
              </li>
              <li>
                اختبار حمل على بيئة مماثلة للاستضافة وإقرار عدد المستخدمين
                المتزامنين.
              </li>
              <li>
                اعتماد سياسات المركز والترخيص والاسترجاع والفوترة المناسبة
                لنشاطه.
              </li>
            </ul>
            <p>
              آخر تشغيل مسجل للمعالجة:{" "}
              {r.worker_last_run
                ? JSON.stringify(r.worker_last_run)
                : "لم يُسجل تشغيل بعد"}
            </p>
          </Panel>
        </>
      )}
    </>
  );
}
