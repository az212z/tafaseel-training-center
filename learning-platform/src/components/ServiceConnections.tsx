import { useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { useRemote, RemoteState } from "./remote";
import { Badge, Field, Form, Panel } from "./ui";
import { isStaticPreview } from "../environment";

interface ServiceConnection {
  name: string;
  label: string;
  enabled: boolean;
  configured: boolean;
  fields: {
    key: string;
    label: string;
    secret?: boolean;
    optional?: boolean;
    options?: Record<string, string>;
    value: string;
    has_value: boolean;
  }[];
}
export function ServiceConnections({ onSaved }: { onSaved: () => void }) {
  const { notify } = useApp();
  const remote = useRemote<{
    items: ServiceConnection[];
    zoom_webhook_url: string;
  }>("services.connections", {}, !isStaticPreview);
  const [edit, setEdit] = useState("");
  if (isStaticPreview) return null;
  return (
    <Panel
      title="إعداد حسابات الخدمات"
      description="أدخل بيانات حسابات المركز هنا مباشرة. المفاتيح محفوظة مشفرة ولا تُعرض بعد حفظها."
    >
      <RemoteState {...remote} />
      {remote.result?.items.map((service) => (
        <section className="security-list" key={service.name}>
          <div className="row-between">
            <h3>{service.label}</h3>
            <Badge tone={service.configured ? "green" : "amber"}>
              {service.configured
                ? "الإعداد محفوظ؛ يلزم اختبار فعلي"
                : "غير مفعّل"}
            </Badge>
            <button
              className="text-link"
              onClick={() => setEdit(edit === service.name ? "" : service.name)}
            >
              {edit === service.name ? "إغلاق الإعداد" : "إعداد الاتصال"}
            </button>
          </div>
          {edit === service.name && (
            <Form
              submitLabel="حفظ إعداد الخدمة"
              onSubmit={async (data) => {
                await api("services.connection.save", {
                  service: service.name,
                  enabled: data.enabled === "on",
                  current_password: data.current_password,
                  values: Object.fromEntries(
                    service.fields.map((f) => [f.key, data[f.key] ?? ""]),
                  ),
                });
                setEdit("");
                remote.reload();
                onSaved();
                notify(
                  "حُفظ إعداد الخدمة. أكمل التجربة الفعلية قبل اعتماد التشغيل.",
                );
              }}
            >
              {service.fields.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  hint={
                    field.secret && field.has_value
                      ? "اتركه فارغًا للاحتفاظ بالمفتاح المحفوظ."
                      : undefined
                  }
                >
                  {field.options ? (
                    <select name={field.key} defaultValue={field.value}>
                      {Object.entries(field.options).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field.key}
                      type={field.secret ? "password" : "text"}
                      autoComplete={field.secret ? "new-password" : "off"}
                      dir="ltr"
                      defaultValue={field.value}
                      maxLength={2000}
                    />
                  )}
                </Field>
              ))}
              {service.name === "zoom" && (
                <Field label="رابط استقبال أحداث Zoom">
                  <input
                    readOnly
                    dir="ltr"
                    value={remote.result!.zoom_webhook_url}
                  />
                  <small>
                    فعّل أحداث بدء اللقاء ونهايته وانضمام المشاركين في تطبيق حساب
                    المركز.
                  </small>
                </Field>
              )}
              {service.name === "video" && (
                <p className="muted">
                  فعّل حماية المشغل بالتوقيع، واسمح بالعرض على نطاق
                  tafaseel-learn.com من إعدادات مكتبة Bunny.
                </p>
              )}
              {service.name === "s3" && (
                <p className="muted">
                  استخدم حاوية خاصة ومفتاحًا مقيدًا بها، وأبقِ منع الوصول العام
                  مفعّلًا.
                </p>
              )}
              <label className="check-label">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={service.enabled}
                />
                تفعيل استخدام هذه الخدمة
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
        </section>
      ))}
    </Panel>
  );
}
