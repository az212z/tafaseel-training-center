import { useState } from "react";
import { api } from "../api";
import { ar, date, useApp } from "../context";
import { isStaticPreview } from "../environment";
import { useRemote, RemoteState } from "./remote";
import { Panel, Field, Form } from "./ui";

interface DeliveryStatus {
  limits: {
    mail_plan: string;
    mail_per_minute: number;
    mail_reserved_percent: number;
    sms_per_minute: number;
    sms_parallel: number;
  };
  mail_daily_limit: number;
  queues: Record<
    string,
    { waiting: number; oldest_at: string | null; oldest_age_seconds: number }
  >;
  sms_estimated_minutes: number | null;
}
export function DeliverySettings() {
  const remote = useRemote<DeliveryStatus>(
    "delivery.status",
    {},
    !isStaticPreview,
  );
  if (isStaticPreview) return null;
  return (
    <Panel
      title="سعة الإرسال ومتابعة الانتظار"
      description="تُقدّم رسائل الحسابات على الحملات. اضبط السعة حسب الحدود الفعلية في حسابات المزودين."
    >
      <RemoteState {...remote} />
      {remote.result && (
        <>
          <div className="dashboard-stats">
            {Object.entries(remote.result.queues).map(([channel, queue]) => (
              <div key={channel}>
                <strong>{ar(queue.waiting)}</strong>
                <p>
                  {channel === "sms"
                    ? "رسائل جوال منتظرة"
                    : "رسائل بريد منتظرة"}
                </p>
                <small>
                  {queue.oldest_at
                    ? `أقدم رسالة: ${date(queue.oldest_at)}`
                    : "لا يوجد انتظار حاليًا"}
                </small>
              </div>
            ))}
          </div>
          <p className="muted">
            {remote.result.sms_estimated_minutes === null
              ? "لم يُربط مزود رسائل الجوال؛ لا يمكن تقدير وقت التسليم."
              : `تقدير تصريف طابور الجوال وفق حد التطبيق: ${ar(remote.result.sms_estimated_minutes)} دقيقة. لا يشمل تأخر المزود أو الشبكة، ولا يثبت الوصول للهاتف.`}
          </p>
          <DeliveryForm
            key={JSON.stringify(remote.result.limits)}
            status={remote.result}
            reload={remote.reload}
          />
        </>
      )}
    </Panel>
  );
}
function DeliveryForm({
  status,
  reload,
}: {
  status: DeliveryStatus;
  reload: () => void;
}) {
  const { notify } = useApp();
  const [edit, setEdit] = useState(false);
  const [plan, setPlan] = useState(status.limits.mail_plan);
  const ceiling = (
    { free: 80, starter: 900, standard: 2700, premium: 2700 } as Record<
      string,
      number
    >
  )[plan];
  return (
    <>
      <button className="text-link" onClick={() => setEdit(!edit)}>
        {edit ? "إغلاق الإعداد" : "ضبط حدود الإرسال"}
      </button>
      {edit && (
        <Form
          submitLabel="حفظ سعة الإرسال"
          onSubmit={async (data) => {
            await api("delivery.configure", {
              mail_plan: plan,
              mail_daily_limit: Number(data.mail_daily_limit),
              mail_per_minute: Number(data.mail_per_minute),
              mail_reserved_percent: Number(data.mail_reserved_percent),
              sms_per_minute: Number(data.sms_per_minute),
              sms_parallel: Number(data.sms_parallel),
              limits_confirmed: data.limits_confirmed === "on",
              current_password: data.current_password,
            });
            setEdit(false);
            reload();
            notify("حُفظت حدود الإرسال وأولوية رسائل الحسابات.");
          }}
        >
          <Field label="خطة بريد هوستنغر الحالية">
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="free">بريد مجاني أو تجريبي</option>
              <option value="starter">Business Starter</option>
              <option value="standard">Business Standard</option>
              <option value="premium">Business Premium</option>
            </select>
          </Field>
          <p className="muted">
            راجع «عرض الحدود» في حساب هوستنغر قبل اختيار الخطة. يترك حد المنصة
            هامشًا للمراسلات اليدوية، واختيار خطة هنا لا يشتريها أو يرقّي حسابك.
          </p>
          <div className="form-row">
            <Field label="رسائل المنصة البريدية خلال ٢٤ ساعة">
              <input
                name="mail_daily_limit"
                type="number"
                min={1}
                max={ceiling}
                defaultValue={status.mail_daily_limit}
                required
              />
            </Field>
            <Field label="الحد المعتمد للبريد في الدقيقة">
              <input
                name="mail_per_minute"
                type="number"
                min={1}
                max={60}
                defaultValue={status.limits.mail_per_minute}
                required
              />
            </Field>
          </div>
          <Field label="النسبة المحجوزة لرسائل الحسابات والخدمة (%)">
            <input
              name="mail_reserved_percent"
              type="number"
              min={10}
              max={80}
              defaultValue={status.limits.mail_reserved_percent}
              required
            />
          </Field>
          <div className="form-row">
            <Field label="الحد المعتمد لرسائل الجوال في الدقيقة">
              <input
                name="sms_per_minute"
                type="number"
                min={1}
                max={6000}
                defaultValue={status.limits.sms_per_minute}
                required
              />
            </Field>
            <Field label="طلبات إرسال الجوال في الوقت نفسه">
              <input
                name="sms_parallel"
                type="number"
                min={1}
                max={8}
                defaultValue={status.limits.sms_parallel}
                required
              />
            </Field>
          </div>
          <label className="check-label">
            <input name="limits_confirmed" type="checkbox" required />
            راجعت حدود حسابات المزودين، والقيم أعلاه لا تتجاوزها.
          </label>
          <Field label="كلمة مرور دخول إدارة تفاصيل لتأكيد الحفظ">
            <input
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
        </Form>
      )}
    </>
  );
}
