import { useState } from "react";
import { useApp } from "../context";
import { api } from "../api";
import { isStaticPreview } from "../environment";
import { useRemote, RemoteState } from "./remote";
import { Panel, Form, Field, Badge } from "./ui";

export function SmsConnection() {
  const { notify } = useApp();
  const remote = useRemote<{
    configured: boolean;
    enabled: boolean;
    has_token: boolean;
    sender: string;
  }>("sms.connection", {}, !isStaticPreview);
  const [edit, setEdit] = useState(false);
  return (
    <Panel
      title="ربط الرسائل النصية"
      description="إرسال تنبيهات الغياب عبر حساب تقنيات Taqnyat الخاص بالمركز."
    >
      <RemoteState {...remote} />
      {remote.result && (
        <>
          <div className="row-between">
            <Badge tone={remote.result.configured ? "green" : "amber"}>
              {remote.result.configured
                ? "إعداد الرسائل محفوظ ومفعّل"
                : "خدمة الرسائل غير مفعّلة"}
            </Badge>
            <button className="text-link" onClick={() => setEdit(!edit)}>
              {edit ? "إغلاق الإعداد" : "إعداد الاتصال"}
            </button>
          </div>
          {!remote.result.configured && (
            <p className="muted">
              يتطلب الإرسال حساب رسائل برصيد، واسم مرسل معتمد، ومفتاح الربط.
              تُحفظ الرسائل المنتظرة حتى اكتمال الاتصال.
            </p>
          )}
          {edit && (
            <Form
              submitLabel="حفظ إعداد الرسائل"
              onSubmit={async (d) => {
                await api("sms.connection.save", {
                  enabled: d.enabled === "on",
                  sender: d.sender,
                  token: d.token,
                  current_password: d.current_password,
                });
                remote.reload();
                setEdit(false);
                notify("حُفظ إعداد الرسائل. تابع حالات الإرسال من السجل.");
              }}
            >
              <Field label="اسم المرسل المعتمد">
                <input
                  name="sender"
                  dir="ltr"
                  defaultValue={remote.result.sender}
                  maxLength={20}
                />
              </Field>
              <Field
                label="مفتاح الربط من تقنيات"
                hint={
                  remote.result.has_token
                    ? "اتركه فارغًا للاحتفاظ بالمفتاح المحفوظ."
                    : "أدخل المفتاح هنا مباشرة. يُحفظ مشفرًا ولا يظهر لاحقًا."
                }
              >
                <input
                  name="token"
                  type="password"
                  autoComplete="new-password"
                  dir="ltr"
                  maxLength={2000}
                />
              </Field>
              <label className="check-label">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={remote.result.enabled}
                />
                تفعيل إرسال رسائل الغياب تلقائيًا
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
      )}
    </Panel>
  );
}
