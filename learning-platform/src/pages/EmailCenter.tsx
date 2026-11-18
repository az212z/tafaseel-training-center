import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Envelope,
  PaperPlaneTilt,
  SlidersHorizontal,
  Clock,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { api } from "../api";
import { useApp, date } from "../context";
import { isStaticPreview } from "../environment";
import {
  PageHead,
  Panel,
  Button,
  Badge,
  Form,
  Field,
  Table,
  Empty,
} from "../components/ui";
import { useRemote, RemoteState, Pagination } from "../components/remote";
import type { PageResult } from "../types";
import "../email.css";

type Connection = {
  address: string;
  name: string;
  port: number;
  enabled: boolean;
  configured: boolean;
  has_password: boolean;
  daily_limit: number;
  used_24h: number;
  last_accept: string | null;
  worker_last_run: string | null;
  counts: { status: string; n: number }[];
};
const states: Record<string, string> = {
  pending: "في قائمة الإرسال",
  blocked: "بانتظار ربط البريد",
  retry: "إعادة محاولة مجدولة",
  sending: "جارٍ الإرسال",
  accepted: "قبله خادم البريد",
  failed: "تعذر الإرسال",
  uncertain: "يحتاج مراجعة",
  cancelled: "أُلغي قبل الإرسال",
};
const kinds: Record<string, string> = {
  training: "تنبيه تدريبي",
  marketing: "نشرة المركز",
  class_reminder: "تذكير بموعد",
  registration: "طلب انضمام",
  account: "خدمة الحساب",
  admin_alert: "تنبيه الإدارة",
  test: "اختبار الربط",
};
function EmailPreferences() {
  const { notify } = useApp();
  const remote = useRemote<{
    training_enabled: boolean;
    marketing_enabled: boolean;
  }>("email.preference");
  return (
    <Panel
      title="تفضيلات رسائلي"
      description="اختر الرسائل التي تود استقبالها على بريد حسابك."
    >
      <RemoteState {...remote} />
      {remote.result && (
        <Form
          key={JSON.stringify(remote.result)}
          submitLabel="حفظ تفضيلات البريد"
          onSubmit={async (d) => {
            await api("email.preference.save", {
              training_enabled: d.training === "on",
              marketing_enabled: d.marketing === "on",
            });
            remote.reload();
            notify("حُفظت تفضيلات رسائلك.");
          }}
        >
          <label className="check-label">
            <input
              type="checkbox"
              name="training"
              defaultChecked={remote.result.training_enabled}
            />
            مواعيد التدريب واللقاءات ومستجدات دوراتي
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="marketing"
              defaultChecked={remote.result.marketing_enabled}
            />
            أرغب في استقبال نشرات تفاصيل وأخبار البرامج الجديدة
          </label>
          <p className="muted">
            النشرات العامة تتطلب اختيارك. تبقى رسائل تفعيل الحساب والشهادات
            والردود على طلبات الدعم متاحة لخدمتك.
          </p>
        </Form>
      )}
    </Panel>
  );
}
function EmailConnection({
  connection,
  reload,
}: {
  connection: Connection;
  reload: () => void;
}) {
  const { notify } = useApp();
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function test() {
    setBusy(true);
    setMessage("");
    try {
      const r = await api<{ message: string }>("email.test", {});
      setMessage(r.message);
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="البريد الرسمي"
      description="رسائل تفاصيل تحمل اسم المركز، وتصل الردود إلى صندوق البريد نفسه."
      action={
        <Badge tone={connection.configured ? "green" : "amber"}>
          {connection.configured ? "بيانات الربط محفوظة" : "أكمل الربط"}
        </Badge>
      }
    >
      <div className="email-sender">
        <span className="email-symbol">
          <Envelope size={29} />
        </span>
        <div>
          <strong>{connection.name}</strong>
          <p dir="ltr">{connection.address}</p>
        </div>
      </div>
      <div className="email-buttons">
        <Button variant="secondary" onClick={() => setEdit(!edit)}>
          <SlidersHorizontal size={18} />
          {edit ? "إغلاق الإعدادات" : "إعداد البريد"}
        </Button>
        <Button disabled={!connection.configured || busy} onClick={test}>
          <PaperPlaneTilt size={18} />
          {busy ? "جارٍ الاختبار…" : "إرسال اختبار إلى بريد المركز"}
        </Button>
        <a
          className="btn btn-ghost"
          href="https://mail.hostinger.com/"
          target="_blank"
          rel="noreferrer"
        >
          فتح صندوق البريد
          <ArrowSquareOut size={18} />
        </a>
      </div>
      {message && (
        <div className="alert" role="status">
          {message}
        </div>
      )}
      <p className="muted">
        قبول خادم البريد يعني قبول طلب الإرسال. راجع الوارد والبريد غير المرغوب
        للتحقق من الوصول.
      </p>
      {edit && (
        <div className="email-setup">
          <Form
            submitLabel="حفظ وربط البريد"
            onSubmit={async (d) => {
              await api("email.configure", {
                ...d,
                port: Number(d.port),
                daily_limit: Number(d.daily_limit),
                enabled: d.enabled === "on",
              });
              setEdit(false);
              reload();
              notify("حُفظت بيانات ربط البريد. أرسل اختبارًا للتحقق من الوصول.");
            }}
          >
            <Field label="بريد الإرسال والردود">
              <input
                name="address"
                type="email"
                dir="ltr"
                defaultValue={connection.address}
                required
                autoComplete="off"
              />
            </Field>
            <Field label="اسم المرسل">
              <input
                name="name"
                defaultValue={connection.name}
                required
                maxLength={100}
              />
            </Field>
            <Field
              label={
                connection.has_password
                  ? "كلمة مرور البريد الجديدة (اتركها فارغة للإبقاء على الحالية)"
                  : "كلمة مرور البريد أو كلمة مرور التطبيق"
              }
            >
              <input
                name="password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required={!connection.has_password}
                maxLength={256}
              />
            </Field>
            <div className="form-row">
              <Field label="اتصال هوستنغر المشفر">
                <select name="port" defaultValue={connection.port}>
                  <option value={465}>SSL — 465</option>
                  <option value={587}>STARTTLS — 587</option>
                </select>
              </Field>
              <Field label="حد إرسال المنصة خلال 24 ساعة">
                <input
                  name="daily_limit"
                  type="number"
                  min={1}
                  max={80}
                  defaultValue={connection.daily_limit}
                  required
                />
              </Field>
            </div>
            <label className="check-label">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={connection.enabled || !connection.has_password}
              />
              تفعيل الإرسال من البريد الرسمي
            </label>
            <Field label="كلمة مرور دخول إدارة تفاصيل لتأكيد الحفظ">
              <input
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <p className="muted">
              تُحفظ بيانات الربط مشفرة، ولا تظهر كلمة مرور البريد بعد الحفظ.
              تغييرها هنا لا يغيّر كلمة مرور الصندوق لدى هوستنغر.
            </p>
          </Form>
        </div>
      )}
    </Panel>
  );
}
type Preview = {
  recipients: number;
  sample: string[];
  fingerprint: string;
  sender: string;
  can_schedule: boolean;
  configured?: boolean;
  html: string;
};
type Campaign = {
  id: string;
  subject: string;
  kind: string;
  status: string;
  recipients: number;
  accepted?: number;
  needs_review?: number;
  created_at: string;
};
function CampaignComposer() {
  const { data, user, notify } = useApp();
  const admin = user.role === "admin";
  const [kind, setKind] = useState("training");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<Record<string, FormDataEntryValue> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const remote = useRemote<PageResult<Campaign>>("email.campaigns", {
    page: String(page),
  });
  const [campaignId, setCampaignId] = useState(() =>
    crypto.randomUUID().replaceAll("-", ""),
  );
  async function send() {
    if (!draft || !preview) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ queued: number }>("email.campaign.send", {
        ...draft,
        fingerprint: preview.fingerprint,
        id: campaignId,
      });
      notify(`أضيفت ${r.queued} رسالة إلى قائمة الإرسال التدريجي.`);
      setPreview(null);
      setDraft(null);
      setRevision((x) => x + 1);
      setCampaignId(crypto.randomUUID().replaceAll("-", ""));
      remote.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Panel
        title="بث رسالة بريدية"
        description={
          admin
            ? "تنبيه لطلاب دورة محددة، أو نشرة للمشتركين في أخبار المركز."
            : "أرسل تنبيهًا إلى طلاب دورتك وتابع رسائلك من هنا."
        }
      >
        <div
          onChange={() => {
            setPreview(null);
            setDraft(null);
            setError("");
          }}
        >
          <Form
            key={revision}
            submitLabel="معاينة الرسالة والمستلمين"
            onSubmit={async (d) => {
              const p = await api<Preview>("email.campaign.preview", d);
              setDraft(d);
              setPreview(p);
            }}
          >
            <Field label="نوع الرسالة">
              <select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="training">تنبيه متعلق بدورة تدريبية</option>
                {user.role === "admin" && (
                  <option value="marketing">نشرة أخبار تفاصيل للمشتركين</option>
                )}
              </select>
            </Field>
            {kind === "training" && (
              <Field label="الدورة المعنية">
                <select name="course_id" required defaultValue="">
                  <option value="" disabled>
                    اختر دورة منشورة
                  </option>
                  {data.courses
                    .filter((c) => c.status === "published")
                    .map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.title}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="عنوان الرسالة">
              <input name="subject" required maxLength={160} />
            </Field>
            <Field label="محتوى الرسالة">
              <textarea name="body" required rows={6} maxLength={5000} />
            </Field>
            <p className="muted">
              كل رسالة تصل لمستلم واحد، مع رابط لإدارة الاشتراك. تحقّق من العنوان
              والمحتوى والجمهور في المعاينة قبل الجدولة.
            </p>
          </Form>
        </div>
        {preview && (
          <section className="email-review" aria-label="معاينة الرسالة">
            <div className="email-review-head">
              <div>
                <h3>المعاينة قبل الإرسال</h3>
                <p>
                  <strong>{preview.recipients}</strong> مستلمًا • المرسل:{" "}
                  <bdi>{preview.sender}</bdi>
                </p>
                {preview.sample.length > 0 && (
                  <p className="muted">
                    من المستلمين: {preview.sample.join("، ")}
                  </p>
                )}
              </div>
              <Badge tone={preview.can_schedule ? "green" : "amber"}>
                {preview.can_schedule
                  ? "جاهز للجدولة"
                  : admin
                    ? "اربط البريد أولًا"
                    : "الإرسال غير متاح حاليًا؛ تواصل مع الإدارة"}
              </Badge>
            </div>
            <iframe
              title="معاينة البريد العربي"
              srcDoc={preview.html}
              sandbox=""
              className="email-preview"
            />
            <Button
              disabled={
                !preview.can_schedule || preview.recipients === 0 || busy
              }
              onClick={send}
            >
              {busy
                ? "جارٍ الجدولة…"
                : `جدولة الإرسال إلى ${preview.recipients} مستلمًا`}
            </Button>
            <p className="muted">
              {admin
                ? "يُطبّق حد المنصة اليومي، وقد يمتد الإرسال لأكثر من يوم. إيقاف الاشتراك أو إلغاء تسجيل الطالب يُراجع قبل إرسال كل رسالة."
                : "تُرسل الرسائل بالتدريج إلى طلاب الدورة المشتركين في تنبيهاتها. يمكنك إلغاء الرسائل المتبقية من سجل البث."}
            </p>
          </section>
        )}
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
      </Panel>
      <Panel title="سجل البث">
        <RemoteState {...remote} />
        {remote.result?.items.length ? (
          <Table
            headers={[
              "الرسالة",
              "الجمهور",
              ...(admin ? ["قُبلت", "للمراجعة"] : []),
              "الحالة",
              "",
            ]}
          >
            {remote.result.items.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.subject}
                  <small className="block muted">{date(c.created_at)}</small>
                </td>
                <td>{c.recipients}</td>
                {admin && <td>{c.accepted}</td>}
                {admin && <td>{c.needs_review}</td>}
                <td>
                  {c.status === "cancelled"
                    ? "أُلغي المتبقي"
                    : "تمت جدولة الرسالة"}
                </td>
                <td>
                  {c.status !== "cancelled" && (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await api("email.campaign.cancel", { id: c.id });
                          remote.reload();
                          notify(
                            "أُلغي إرسال الرسائل التي ما زالت في الانتظار.",
                          );
                        } catch (e) {
                          notify((e as Error).message, "error");
                        }
                      }}
                    >
                      إلغاء الرسائل المتبقية
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          !remote.loading && (
            <Empty
              title="لا توجد نشرات مرسلة"
              text="تظهر هنا الرسائل بعد معاينتها وجدولة إرسالها."
            />
          )
        )}
        <Pagination
          page={page}
          total={remote.result?.total ?? 0}
          onPage={setPage}
        />
      </Panel>
    </>
  );
}
type EmailLog = {
  id: string;
  kind: string;
  subject: string;
  recipient: string;
  status: string;
  attempts: number;
  error_code: string | null;
  created_at: string;
};
function EmailLogPanel() {
  const [page, setPage] = useState(1);
  const remote = useRemote<PageResult<EmailLog>>("email.log", {
    page: String(page),
  });
  return (
    <Panel
      title="سجل الإرسال"
      description="قبول الرسائل والفشل وحالات المراجعة، دون عرض محتوى الرسائل أو بيانات الربط."
      action={
        <Button variant="secondary" onClick={remote.reload}>
          تحديث
        </Button>
      }
    >
      <RemoteState {...remote} />
      {remote.result?.items.length ? (
        <Table
          headers={[
            "الرسالة",
            "النوع",
            "المستلم",
            "الحالة",
            "المحاولات",
            "التاريخ",
          ]}
        >
          {remote.result.items.map((n) => (
            <tr key={n.id}>
              <td>{n.subject}</td>
              <td>{kinds[n.kind] || n.kind}</td>
              <td dir="ltr">{n.recipient}</td>
              <td>
                <Badge
                  tone={
                    n.status === "accepted"
                      ? "green"
                      : n.status === "failed" || n.status === "uncertain"
                        ? "red"
                        : "amber"
                  }
                >
                  {states[n.status] || n.status}
                </Badge>
                {n.error_code && (
                  <small className="block muted">{n.error_code}</small>
                )}
              </td>
              <td>{n.attempts}</td>
              <td>{date(n.created_at)}</td>
            </tr>
          ))}
        </Table>
      ) : (
        !remote.loading && (
          <Empty
            title="لا توجد رسائل بعد"
            text="تظهر رسائل الاختبار والتسجيل والتدريب والدعم هنا عند إنشائها."
          />
        )
      )}
      <Pagination
        page={page}
        total={remote.result?.total ?? 0}
        onPage={setPage}
      />
    </Panel>
  );
}
export function EmailCenter() {
  const { user } = useApp();
  const admin = user.role === "admin";
  const staff = admin || user.role === "instructor";
  const remote = useRemote<Connection>(
    "email.status",
    {},
    admin && !isStaticPreview,
  );
  return (
    <>
      <PageHead
        title="البريد والتواصل"
        subtitle="البريد الرسمي وتنبيهات التدريب ونشرات المركز في مكان واحد."
      >
        <Envelope size={28} />
      </PageHead>
      {isStaticPreview ? (
        <div className="alert">
          إعداد البريد متاح في نسخة تفاصيل المتصلة بالخادم.
        </div>
      ) : (
        <>
          {admin && (
            <>
              <RemoteState {...remote} />
              {remote.result && (
                <>
                  <div className="email-metrics">
                    <Panel title="رسائل المنصة خلال 24 ساعة">
                      <strong>
                        {remote.result.used_24h} / {remote.result.daily_limit}
                      </strong>
                      <p className="muted">
                        الهامش المتبقي مخصص لمراسلات الصندوق اليدوية.
                      </p>
                    </Panel>
                    <Panel title="آخر قبول من خادم البريد">
                      <strong>
                        {remote.result.last_accept
                          ? date(remote.result.last_accept)
                          : "لم يُختبر الإرسال بعد"}
                      </strong>
                    </Panel>
                    <Panel title="عامل الإرسال">
                      <Clock size={22} />
                      <p>
                        {remote.result.worker_last_run
                          ? date(remote.result.worker_last_run)
                          : "بانتظار أول تشغيل"}
                      </p>
                    </Panel>
                  </div>
                  <EmailConnection
                    connection={remote.result}
                    reload={remote.reload}
                  />
                  <Panel title="رسائل تعمل مع إجراءات المنصة">
                    <p>
                      استلام طلب الحساب وتفعيله، والتسجيل بالدورات، والمواعيد
                      وروابط البث من الجدول، وتذكير قبل اللقاء، وصدور الشهادة،
                      ورد الدعم. تصل تنبيهات طلبات الموقع والانضمام والدعم إلى
                      بريد المركز.
                    </p>
                    <p className="muted">
                      إرسال البريد يتطلب ربطًا صحيحًا وعامل إرسال مجدولًا. البث
                      المباشر نفسه يُدار من{" "}
                      <Link to="/schedule">الجدول التدريبي</Link>.
                    </p>
                  </Panel>
                </>
              )}
            </>
          )}
          <EmailPreferences />
          {staff && <CampaignComposer />}
          {admin && <EmailLogPanel />}
        </>
      )}
    </>
  );
}
