import { useEffect, useState } from "react";
import {
  Bell,
  CheckCircle,
  WarningCircle,
  ArrowSquareOut,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { api, get } from "../api";
import { date, useApp } from "../context";
import { isStaticPreview } from "../environment";
import type { NotificationRecord, PageResult } from "../types";
import {
  PageHead,
  Panel,
  Button,
  Modal,
  Form,
  Field,
  Empty,
  Badge,
  Table,
} from "../components/ui";
import { useRemote, RemoteState, Pagination } from "../components/remote";
const notificationStatus: Record<string, string> = {
  blocked: "بانتظار تفعيل المزود",
  pending: "قيد الانتظار",
  retry: "إعادة محاولة مجدولة",
  sending: "جارٍ الطلب من المزود",
  accepted: "قبله مزود الرسائل",
  uncertain: "غير مؤكد — مراجعة يدوية",
  failed: "رفض الإرسال",
  cancelled: "أُلغي قبل الإرسال",
};
export function GuardianPreference({ studentId }: { studentId: string }) {
  const { notify } = useApp();
  const remote = useRemote<{ sms_enabled: boolean; consent_at: string | null }>(
    "guardian.preference",
    { student_id: studentId },
  );
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(remote.result?.sms_enabled ?? false);
  }, [remote.result]);
  return (
    <Panel
      title="إشعارات غياب ولي الأمر"
      description="تُرسل الرسالة إلى رقم ولي الأمر المسجل بعد توثيق موافقته."
    >
      <RemoteState {...remote} />
      {remote.result && (
        <Form
          submitLabel="حفظ تفضيل إشعارات الغياب"
          onSubmit={async (d) => {
            await api("guardian.preference.save", {
              student_id: studentId,
              sms_enabled: enabled,
              consent: d.consent === "on",
            });
            remote.reload();
            notify("تم تحديث تفضيل إشعارات ولي الأمر.");
          }}
        >
          <label className="check-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            تفعيل SMS عند تسجيل الغياب
          </label>
          {enabled && (
            <label className="check-label">
              <input type="checkbox" name="consent" required />
              {isStaticPreview
                ? "تأكيد تجربة محلية ببيانات وهمية"
                : "تم توثيق موافقة ولي الأمر على رسائل متابعة التدريب"}
            </label>
          )}
          {remote.result.consent_at && (
            <small className="muted">
              آخر توثيق: {date(remote.result.consent_at)}
            </small>
          )}
          <p className="muted">
            يُمهل الرصد خمس دقائق للمراجعة. تصحيح الغياب أو إلغاء الاشتراك يلغي
            الرسالة المنتظرة. لا يمكن إلغاء رسالة قبلها المزود.
          </p>
        </Form>
      )}
    </Panel>
  );
}
export function Notifications() {
  const { user, notify } = useApp();
  const [page, setPage] = useState(1);
  const remote = useRemote<PageResult<NotificationRecord>>("notifications", {
    page: String(page),
  });
  return (
    <>
      <PageHead
        title="رسائل الغياب"
        subtitle="سجل واضح للانتظار والقبول والفشل، مع إخفاء معظم رقم ولي الأمر."
      >
        <Button variant="secondary" onClick={remote.reload}>
          <ArrowsClockwise size={18} />
          تحديث السجل
        </Button>
      </PageHead>
      {isStaticPreview && (
        <div className="alert">
          محاكاة محلية فقط. لا تُرسل أي رسالة من نسخة GitHub.
        </div>
      )}
      <div className="alert">
        <Bell size={20} />
        تُنشأ الرسالة عند رصد الغياب لطالب فُعّلت رسائله بموافقة ولي الأمر. «قبله
        المزود» يعني قبول طلب الإرسال، ولا يثبت وصول الرسالة إلى الهاتف.
      </div>
      <RemoteState {...remote} />
      <Panel>
        {remote.result?.items.length ? (
          <Table
            headers={[
              "الطالب",
              "الحصة",
              "المستلم",
              "الحالة",
              "المحاولات",
              "التاريخ",
              "",
            ]}
          >
            {remote.result.items.map((n) => (
              <tr key={n.id}>
                <td>{n.student_name}</td>
                <td>{n.class_title}</td>
                <td dir="ltr">{n.recipient}</td>
                <td>
                  <Badge
                    tone={
                      n.status === "accepted"
                        ? "green"
                        : n.status === "failed"
                          ? "red"
                          : "amber"
                    }
                  >
                    {notificationStatus[n.status] || n.status}
                  </Badge>
                  {n.status === "uncertain" && (
                    <small className="block muted">
                      لا تُكرر تلقائيًا لتجنّب تكرار الرسالة؛ راجع لوحة المزود.
                    </small>
                  )}
                </td>
                <td>{n.attempts}</td>
                <td>{date(n.created_at)}</td>
                <td>
                  {user.role === "admin" &&
                    ["blocked", "failed"].includes(n.status) && (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await api("notification.retry", { id: n.id });
                            remote.reload();
                            notify("جُدولت إعادة المحاولة.");
                          } catch (e) {
                            notify((e as Error).message, "error");
                          }
                        }}
                      >
                        إعادة المحاولة
                      </Button>
                    )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          !remote.loading && (
            <Empty
              title="لا توجد إشعارات غياب"
              text="فعّل الرسائل من ملف الطالب، ثم احفظ سجل الغياب. تظهر حالة الرسالة هنا."
            />
          )
        )}
      </Panel>
      <Pagination
        page={page}
        total={remote.result?.total ?? 0}
        onPage={setPage}
      />
    </>
  );
}
const serviceLabels: Record<string, string> = {
  moyasar: "بوابة ميسر للدفع",
  sms: "SMS لإشعارات الغياب",
  zoom: "لقاءات زوم المباشرة",
  video: "استضافة الفيديو السحابي",
  s3: "التخزين الخاص للملفات",
};
export function Integrations() {
  const remote = useRemote<{
    services: Record<string, { configured: boolean; mode: string }>;
    storage: {
      driver: string;
      file_limit_bytes: number;
      storage_quota_bytes: number;
    };
    registration_enabled: boolean;
    worker_last_run?: string | null;
  }>("integrations");
  return (
    <>
      <PageHead
        title="الخدمات والتشغيل"
        subtitle="حالة الإعداد ومتطلبات التفعيل. المفاتيح السرية تبقى خارج الواجهة."
      >
        <Button variant="secondary" onClick={remote.reload}>
          تحديث الحالة
        </Button>
      </PageHead>
      <RemoteState {...remote} />
      {isStaticPreview && (
        <div className="alert">
          هذا عرض للحالة فقط؛ التكاملات الخارجية تُفعّل في النسخة التي تعمل
          بالخادم.
        </div>
      )}
      <div className="integrations-grid">
        {Object.entries(remote.result?.services ?? {}).map(([key, s]) => (
          <Panel key={key}>
            <span className={`integration-icon ${s.configured ? "ready" : ""}`}>
              {s.configured ? (
                <CheckCircle size={29} />
              ) : (
                <WarningCircle size={29} />
              )}
            </span>
            <h2>{serviceLabels[key]}</h2>
            <Badge tone={s.configured ? "green" : "amber"}>
              {s.configured
                ? s.mode === "test"
                  ? "إعداد بمفاتيح الاختبار"
                  : "الإعداد موجود — يلزم اختبار حي"
                : "بانتظار إعداد حساب المركز"}
            </Badge>
            <p>
              {key === "moyasar"
                ? "صفحة دفع مستضافة والتحقق من الفاتورة قبل تسجيل الطالب."
                : key === "sms"
                  ? "اسم مرسل معتمد ورصيد رسائل، مع تشغيل المهمة المجدولة للرسائل."
                  : key === "zoom"
                    ? "تطبيق Server-to-Server OAuth بصلاحيات اللقاءات وإشعارات الأحداث."
                    : key === "video"
                      ? "مكتبة فيديو مع تفعيل توقيع المشغل، وتقييد نطاق العرض."
                      : "حاوية S3 خاصة مع منع الوصول العام ومفاتيح محدودة الصلاحية."}
            </p>
          </Panel>
        ))}
      </div>
      <Panel title="متطلبات بدء التشغيل">
        <div className="security-list">
          <p>
            <CheckCircle size={20} />
            <span>
              إعداد حسابات الخدمات والمفاتيح يتم في ملف الإعداد الخاص على
              الاستضافة. لا تُرسل المفاتيح في المحادثة ولا تُرفع إلى GitHub.
            </span>
          </p>
          <p>
            <CheckCircle size={20} />
            <span>
              تحقق من المهمة المجدولة للرسائل والنسخ الاحتياطية، ومن SSL
              وصلاحيات التخزين.
            </span>
          </p>
          <p>
            <WarningCircle size={20} />
            <span>
              وجود الإعداد لا يثبت نجاح الاتصال أو وصول الرسائل. يُجرى اختبار حي
              مع حسابات المركز قبل استقبال بيانات حقيقية.
            </span>
          </p>
        </div>
        {remote.result?.worker_last_run && (
          <p>
            آخر تشغيل لعامل الرسائل:{" "}
            {date(remote.result.worker_last_run, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
      </Panel>
    </>
  );
}
export function ZoomControl({
  classId,
  ready,
  canHost,
}: {
  classId: string;
  ready: boolean;
  canHost: boolean;
}) {
  const { data, user, refresh, notify } = useApp();
  const [create, setCreate] = useState(false);
  const [link, setLink] = useState<{ url: string; host: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [presence, setPresence] = useState<{
    items: {
      student_id: string;
      name: string;
      joined_at: string;
      left_at: string | null;
    }[];
  } | null>(null);
  async function open(host: boolean) {
    setBusy(true);
    try {
      const r = await api<{ url: string }>("zoom.link", {
        class_id: classId,
        host,
      });
      setLink({ ...r, host });
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {ready ? (
        <>
          <Button
            disabled={busy || isStaticPreview}
            onClick={() => open(false)}
          >
            دخول زوم
          </Button>
          {canHost && (
            <>
              <Button
                variant="secondary"
                disabled={busy || isStaticPreview}
                onClick={() => open(true)}
              >
                بدء اللقاء كمدرّب
              </Button>
              <button
                className="text-link"
                onClick={async () => {
                  try {
                    setPresence(
                      await get("zoom.presence", { class_id: classId }),
                    );
                  } catch (e) {
                    notify((e as Error).message, "error");
                  }
                }}
              >
                سجل الاتصال بزوم
              </button>
            </>
          )}
        </>
      ) : (
        canHost && (
          <Button
            variant="secondary"
            disabled={!data.capabilities?.zoom || isStaticPreview}
            onClick={() => setCreate(true)}
          >
            إنشاء لقاء زوم
          </Button>
        )
      )}
      {create && (
        <Modal title="إنشاء لقاء زوم" onClose={() => setCreate(false)}>
          <Form
            submitLabel="إنشاء اللقاء على حساب المركز"
            onSubmit={async (d) => {
              await api("zoom.create", {
                class_id: classId,
                host_email: d.host_email,
              });
              await refresh();
              notify("تم إنشاء لقاء زوم.");
              setCreate(false);
            }}
          >
            {user.role === "admin" ? (
              <Field label="بريد مضيف زوم في حساب المركز">
                <input name="host_email" type="email" required dir="ltr" />
              </Field>
            ) : (
              <p>
                يُستخدم بريد المدرّب {user.email} مضيفًا في حساب زوم الخاص بالمركز.
              </p>
            )}
            <p className="muted">
              يُنشأ لقاء بقاعة انتظار ورمز دخول، ويُمنع الدخول قبل المضيف. تسجيل
              الفيديو التلقائي مغلق. افتح البدء قبل الحصة بنصف ساعة.
            </p>
          </Form>
        </Modal>
      )}
      {link && (
        <Modal
          title={link.host ? "رابط بدء اللقاء" : "رابط الانضمام للقاء"}
          onClose={() => setLink(null)}
        >
          <p>
            {link.host
              ? "هذا رابط خاص بالمضيف، لا تشاركه مع الطلاب."
              : "يتيح الرابط الانضمام إلى اللقاء. تسجيل الحضور يعتمد على رصد المدرب."}
          </p>
          <a
            className="btn btn-primary"
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            فتح زوم
            <ArrowSquareOut size={18} />
          </a>
        </Modal>
      )}
      {presence && (
        <Modal title="سجل الاتصال بزوم" onClose={() => setPresence(null)} wide>
          <div className="alert">
            هذه اتصالات وصلت عبر إشعارات زوم الموقعة وتم ربطها بالبريد. قد لا
            يتاح بريد بعض المشاركين، وربط البريد وحده لا يثبت هوية الحاضر؛ راجع
            الحضور يدويًا. فتح رابط اللقاء وحده لا يُسجّل حضورًا.
          </div>
          <Table headers={["الطالب", "الدخول", "الخروج"]}>
            {presence.items.map((p, i) => (
              <tr key={i}>
                <td>{p.name}</td>
                <td>
                  {date(p.joined_at, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td>
                  {p.left_at
                    ? date(p.left_at, { timeStyle: "short" })
                    : "لم يصل إشعار خروج"}
                </td>
              </tr>
            ))}
          </Table>
          {!presence.items.length && (
            <p className="compact-empty">لا توجد اتصالات موثقة بعد.</p>
          )}
        </Modal>
      )}
    </>
  );
}
