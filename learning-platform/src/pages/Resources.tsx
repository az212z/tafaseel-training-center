import { TrashButton } from "../components/TrashButton";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Upload } from "tus-js-client";
import {
  FolderOpen,
  Plus,
  DownloadSimple,
  VideoCamera,
  ArrowsClockwise,
  CheckCircle,
  Pause,
  Play,
} from "@phosphor-icons/react";
import { api, fileUrl } from "../api";
import { useApp, date } from "../context";
import { isStaticPreview } from "../environment";
import type { LearningBag, PageResult, VideoAsset } from "../types";
import {
  PageHead,
  Panel,
  Button,
  Modal,
  Form,
  Field,
  Empty,
  Badge,
  FileUpload,
  Progress,
} from "../components/ui";
import { useRemote, RemoteState, Pagination } from "../components/remote";
export function Bags() {
  const { data, user, notify } = useApp();
  const [params] = useSearchParams();
  const [course, setCourse] = useState(
    params.get("course") ?? data.courses[0]?.id ?? "",
  );
  const [edit, setEdit] = useState<LearningBag | "new" | null>(null);
  const [attach, setAttach] = useState<LearningBag | null>(null);
  const [file, setFile] = useState("");
  const remote = useRemote<{ items: LearningBag[] }>(
    "bags",
    {
      course_id: course,
    },
    Boolean(course),
  );
  const staff = ["admin", "instructor"].includes(user.role);
  return (
    <>
      <PageHead
        title="الحقائب التعليمية"
        subtitle="مواد الدورة منظمة، بإصدار واضح وملفات يمكن الرجوع إليها."
      >
        {staff && course && (
          <Button onClick={() => setEdit("new")}>
            <Plus size={18} />
            إنشاء حقيبة تعليمية
          </Button>
        )}
      </PageHead>
      <div className="filter-bar">
        <select
          aria-label="مادة الحقيبة"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          {data.courses.map((c) => (
            <option value={c.id} key={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      {course ? (
        <RemoteState {...remote} />
      ) : (
        <Empty
          title="لا توجد مواد متاحة"
          text="تظهر حقيبة المادة للطالب بعد تسجيله فيها."
        />
      )}
      <div className="bags-grid">
        {remote.result?.items.map((b) => (
          <Panel
            key={b.id}
            title={b.title}
            description={`الإصدار ${b.version} • تحديث ${date(b.updated_at)}`}
            action={
              staff && (
                <div className="table-actions">
                  <Button variant="secondary" onClick={() => setEdit(b)}>
                    تعديل الحقيبة
                  </Button>
                  <TrashButton
                    kind="bag"
                    id={b.id}
                    title={b.title}
                    onRemoved={remote.reload}
                  />
                </div>
              )
            }
          >
            <p className="bag-description">{b.description}</p>
            <div className="simple-list">
              {b.items.map((item) => (
                <div className="bag-item" key={item.id}>
                  <FolderOpen size={25} />
                  <div>
                    <strong>{item.label}</strong>
                    <small className="block muted">
                      {item.name} • {(item.bytes / 1048576).toFixed(2)} MB
                    </small>
                  </div>
                  <a href={fileUrl(item.file_id)} className="btn btn-secondary">
                    <DownloadSimple size={18} />
                    تنزيل
                  </a>
                  {staff && (
                    <button
                      className="text-link"
                      onClick={async () => {
                        try {
                          await api("bag.item.remove", {
                            bag_id: b.id,
                            file_id: item.file_id,
                          });
                          remote.reload();
                          notify("أُزيل رابط الملف من الحقيبة.");
                        } catch (e) {
                          notify((e as Error).message, "error");
                        }
                      }}
                    >
                      إزالة من الحقيبة
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!b.items.length && (
              <p className="compact-empty">
                تُضاف ملفات الحقيبة هنا من إدارة المادة.
              </p>
            )}
            {staff && (
              <Button
                variant="secondary"
                onClick={() => {
                  setAttach(b);
                  setFile("");
                }}
              >
                <Plus size={18} />
                إضافة ملف للحقيبة
              </Button>
            )}
          </Panel>
        ))}
      </div>
      {course &&
        !remote.loading &&
        !remote.error &&
        !remote.result?.items.length && (
          <Empty
            title="لم تُجهز حقيبة هذه المادة بعد"
            text="يمكن جمع دليل المتعلم، أوراق العمل، والملخصات في حقيبة واحدة."
          />
        )}
      {edit && (
        <Modal
          title={edit === "new" ? "إنشاء حقيبة تعليمية" : "تعديل الحقيبة"}
          onClose={() => setEdit(null)}
        >
          <Form
            onSubmit={async (d) => {
              await api("bag.save", {
                ...d,
                course_id: course,
                id: edit === "new" ? undefined : edit.id,
              });
              remote.reload();
              setEdit(null);
              notify("تم حفظ الحقيبة التعليمية.");
            }}
            onCancel={() => setEdit(null)}
          >
            <Field label="اسم الحقيبة">
              <input
                name="title"
                required
                defaultValue={edit === "new" ? "" : edit.title}
              />
            </Field>
            <Field label="رقم الإصدار">
              <input
                name="version"
                required
                defaultValue={edit === "new" ? "1.0" : edit.version}
              />
            </Field>
            <Field label="وصف وأهداف الحقيبة">
              <textarea
                name="description"
                rows={4}
                defaultValue={edit === "new" ? "" : edit.description}
              />
            </Field>
          </Form>
        </Modal>
      )}
      {attach && (
        <Modal title="إضافة مادة للحقيبة" onClose={() => setAttach(null)}>
          <Form
            onSubmit={async (d) => {
              if (!file) throw new Error("اختر ملفًا أو ارفعه أولًا.");
              await api("bag.item.save", {
                bag_id: attach.id,
                file_id: file,
                label: d.label,
                sort_order: Number(d.sort_order),
              });
              remote.reload();
              setAttach(null);
              notify("تمت إضافة الملف للحقيبة.");
            }}
          >
            <Field label="عنوان المادة">
              <input name="label" required placeholder="مثال: دليل المتعلم" />
            </Field>
            <Field label="ترتيب الملف">
              <input
                name="sort_order"
                type="number"
                min={0}
                max={10000}
                defaultValue={1}
              />
            </Field>
            <Field label="ملف من مكتبة هذه المادة">
              <select value={file} onChange={(e) => setFile(e.target.value)}>
                <option value="">اختر أو ارفع ملفًا جديدًا</option>
                {data.files
                  .filter(
                    (f) => f.course_id === course && f.purpose === "resource",
                  )
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </Field>
            <FileUpload
              purpose="resource"
              courseId={course}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onUploaded={(id) => setFile(id)}
            />
          </Form>
        </Modal>
      )}
    </>
  );
}
interface UploadCredentials {
  id: string;
  video_id: string;
  library_id: string;
  expires: number;
  signature: string;
  endpoint: string;
}
export function VideoUploader({
  courseId,
  onComplete,
}: {
  courseId: string;
  onComplete: () => void;
}) {
  const { notify } = useApp();
  const ref = useRef<Upload | null>(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<
    "idle" | "uploading" | "paused" | "finished" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const videos = useRemote<PageResult<VideoAsset>>(
    "videos",
    {
      course_id: courseId,
      revision: String(refresh),
    },
    Boolean(courseId),
  );
  useEffect(
    () => () => {
      void ref.current?.abort();
    },
    [courseId],
  );
  async function start(file: File) {
    setError("");
    try {
      if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type))
        throw new Error("اختر MP4 أو MOV أو WEBM.");
      if (file.size > 10737418240)
        throw new Error("الحد في هذه الواجهة ١٠ جيجابايت للمقطع.");
      setState("uploading");
      const c = await api<UploadCredentials>(
        resumeId ? "video.credentials" : "video.create",
        resumeId
          ? { id: resumeId }
          : { course_id: courseId, title: file.name, bytes: file.size },
      );
      const upload = new Upload(file, {
        endpoint: c.endpoint,
        chunkSize: 8 * 1024 * 1024,
        retryDelays: [0, 1500, 3000, 5000, 10000],
        headers: {
          AuthorizationSignature: c.signature,
          AuthorizationExpire: String(c.expires),
          VideoId: c.video_id,
          LibraryId: c.library_id,
        },
        metadata: { filetype: file.type, title: file.name },
        fingerprint: async () =>
          `tafaseel-video-${c.id}-${file.name}-${file.size}-${file.lastModified}`,
        removeFingerprintOnSuccess: true,
        onProgress: (sent, total) =>
          setProgress(Math.round((sent / total) * 100)),
        onError: () => {
          setState("error");
          setError(
            "توقف الرفع. يمكنك استئنافه باختيار المقطع المعلق والملف نفسه.",
          );
          setRefresh((x) => x + 1);
        },
        onSuccess: () => {
          void api("video.sync", { id: c.id })
            .then(() => {
              setState("finished");
              setRefresh((x) => x + 1);
              onComplete();
              notify("اكتمل الرفع. انتظر انتهاء تجهيز الفيديو ثم حدّث حالته.");
            })
            .catch((e) => {
              setState("error");
              setError(e.message);
            });
        },
      });
      ref.current = upload;
      const previous = await upload.findPreviousUploads();
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    }
  }
  if (isStaticPreview)
    return (
      <div className="alert">
        رفع الفيديوهات الطويلة يعمل بعد ربط استضافة الفيديو في النسخة الأساسية.
        يمكنك تجربة رفع MP4 صغير من إضافة الدروس في هذا العرض.
      </div>
    );
  return (
    <div className="cloud-upload">
      <Field label="فيديو جديد أو استئناف رفع معلق">
        <select
          value={resumeId}
          disabled={state === "uploading"}
          onChange={(e) => setResumeId(e.target.value)}
        >
          <option value="">بدء فيديو جديد</option>
          {videos.result?.items
            .filter((v) => ["uploading", "processing"].includes(v.status))
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
        </select>
      </Field>
      <label className="upload-zone">
        <VideoCamera size={30} />
        <strong>رفع فيديو طويل مباشرة إلى استضافة الفيديو</strong>
        <small>
          MP4، MOV، WEBM • حتى ١٠ جيجابايت • رفع على أجزاء قابلة للاستئناف
        </small>
        <input
          aria-label="رفع فيديو سحابي"
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          disabled={state === "uploading" || state === "paused"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void start(f);
            e.target.value = "";
          }}
        />
      </label>
      {state !== "idle" && (
        <>
          <Progress value={progress} />
          <p>
            {progress}٪ •{" "}
            {state === "finished"
              ? "اكتمل الرفع"
              : state === "paused"
                ? "الرفع متوقف مؤقتًا"
                : state === "error"
                  ? "توقف الرفع"
                  : "جارٍ رفع الفيديو"}
          </p>
        </>
      )}
      {state === "uploading" && (
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await ref.current?.abort();
            setState("paused");
          }}
        >
          <Pause size={17} />
          إيقاف مؤقت
        </Button>
      )}
      {state === "paused" && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            ref.current?.start();
            setState("uploading");
          }}
        >
          <Play size={17} />
          استئناف
        </Button>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
const videoStatus: Record<string, string> = {
  uploading: "ينتظر اكتمال الرفع",
  processing: "جارٍ تجهيز الفيديو",
  ready: "جاهز",
  failed: "فشل التجهيز",
  rejected: "تجاوز الحجم المعتمد",
};
export function Videos() {
  const { data, user, notify } = useApp();
  const [course, setCourse] = useState(data.courses[0]?.id ?? "");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const [add, setAdd] = useState(false);
  const remote = useRemote<PageResult<VideoAsset>>(
    "videos",
    {
      course_id: course,
      page: String(page),
    },
    Boolean(course),
  );
  return (
    <>
      <PageHead
        title="مكتبة الفيديو السحابي"
        subtitle={
          user.role === "admin"
            ? "رفع قابل للاستئناف وتجهيز للبث، مع روابط تشغيل محددة المدة."
            : "ارفع شروحات دوراتك وأضفها إلى الدروس من مكان واحد."
        }
      >
        <Button
          disabled={!course || !data.capabilities?.video || isStaticPreview}
          onClick={() => setAdd(true)}
        >
          <Plus size={18} />
          رفع فيديو طويل
        </Button>
      </PageHead>
      {!data.capabilities?.video && (
        <div className="alert">
          {user.role === "admin"
            ? "استضافة الفيديو تحتاج إعداد حساب المركز. لا تُحفظ المقاطع الطويلة داخل قاعدة البيانات؛ يمكنك متابعة تجهيز بقية المنصة وإضافة الشروحات النصية والملفات."
            : "رفع الفيديو غير متاح حاليًا. تواصل مع الإدارة لتفعيله، ويمكنك إضافة الشروحات النصية والملفات إلى دروسك الآن."}
        </div>
      )}
      <div className="filter-bar">
        <select
          aria-label="مادة الفيديو"
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            setPage(1);
          }}
        >
          {data.courses.map((c) => (
            <option value={c.id} key={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      {course && <RemoteState {...remote} />}
      <div className="video-assets">
        {remote.result?.items.map((v) => (
          <Panel key={v.id}>
            <div className="row-between">
              <span className="update-icon">
                <VideoCamera size={24} />
              </span>
              <Badge tone={v.status === "ready" ? "green" : "amber"}>
                {videoStatus[v.status] || v.status}
              </Badge>
            </div>
            <h2>{v.title}</h2>
            {!v.lesson_id && (
              <TrashButton
                kind="video"
                id={v.id}
                title={v.title}
                onRemoved={remote.reload}
              />
            )}
            <p className="muted">
              {(v.bytes / 1048576).toFixed(1)} MB •{" "}
              {v.lesson_id
                ? "مرتبط بدرس"
                : "يمكن اختياره من إضافة درس فيديو سحابي بعد تجهيزه"}
            </p>
            <Button
              variant="secondary"
              disabled={!!busy || isStaticPreview}
              onClick={async () => {
                setBusy(v.id);
                try {
                  await api("video.sync", { id: v.id });
                  remote.reload();
                } catch (e) {
                  notify((e as Error).message, "error");
                } finally {
                  setBusy("");
                }
              }}
            >
              <ArrowsClockwise size={17} />
              تحديث الحالة
            </Button>
          </Panel>
        ))}
      </div>
      {!remote.loading && !remote.result?.items.length && (
        <Empty
          title="لا توجد فيديوهات سحابية لهذه المادة"
          text="أضف الفيديو بعد تفعيل الخدمة، ثم اربطه بدرس عند اكتمال تجهيزه."
        />
      )}
      <Pagination
        page={page}
        total={remote.result?.total ?? 0}
        onPage={setPage}
      />
      {add && (
        <Modal
          title="رفع فيديو للمادة"
          onClose={() => {
            setAdd(false);
            remote.reload();
          }}
          wide
        >
          <VideoUploader courseId={course} onComplete={remote.reload} />
        </Modal>
      )}
    </>
  );
}
export function VideoPicker({
  courseId,
  value,
  onChange,
}: {
  courseId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const remote = useRemote<PageResult<VideoAsset>>(
    "videos",
    {
      course_id: courseId,
    },
    Boolean(courseId),
  );
  return (
    <>
      <RemoteState {...remote} />
      <Field label="الفيديو السحابي الجاهز">
        <select
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">اختر فيديو جاهزًا غير مرتبط بدرس</option>
          {remote.result?.items
            .filter((v) => v.status === "ready" && !v.lesson_id)
            .map((v) => (
              <option value={v.id} key={v.id}>
                {v.title}
              </option>
            ))}
        </select>
      </Field>
      <p className="muted">
        ارفع المقاطع الكبيرة أولًا من «مكتبة الفيديو السحابي»، ثم حدّث القائمة
        هنا.
      </p>
      <Button type="button" variant="secondary" onClick={remote.reload}>
        <CheckCircle size={17} />
        تحديث الفيديوهات الجاهزة
      </Button>
    </>
  );
}
