import { useState } from "react";
import { api } from "../api";
import { isStaticPreview } from "../environment";
import { Modal, Form, Field } from "./ui";
export function Registration({ onClose }: { onClose: () => void }) {
  const [done, setDone] = useState("");
  return (
    <Modal title="طلب تسجيل طالب جديد" onClose={onClose} wide>
      {done ? (
        <div className="alert" role="status">
          {done}
        </div>
      ) : (
        <Form
          submitLabel="إرسال طلب التسجيل للمراجعة"
          onCancel={onClose}
          onSubmit={async (d) => {
            const r = await api<{ message: string }>("register", {
              ...d,
              consent: d.consent === "on",
            });
            setDone(r.message);
          }}
        >
          {isStaticPreview && (
            <div className="alert">
              نموذج تجريبي. استخدم بيانات وهمية فقط، ولا تدخل كلمة مرور تستعملها
              في حساب حقيقي.
            </div>
          )}
          <div className="form-grid">
            <Field label="اسم الطالب الكامل">
              <input name="name" required maxLength={120} />
            </Field>
            <Field label="البريد الإلكتروني">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                dir="ltr"
              />
            </Field>
            <Field
              label="كلمة المرور"
              hint="١٢ حرفًا على الأقل؛ لا ترسلها لأحد."
            >
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
              />
            </Field>
            <Field label="تاريخ الميلاد">
              <input name="birth_date" type="date" required />
            </Field>
            <Field label="جوال الطالب" hint="اختياري للقاصر، ومطلوب للبالغ.">
              <input
                name="phone"
                type="tel"
                dir="ltr"
                placeholder="05xxxxxxxx"
              />
            </Field>
            <Field label="المدينة">
              <input name="city" maxLength={100} />
            </Field>
            <Field label="اسم ولي الأمر" hint="مطلوب لمن هم دون ١٨ عامًا.">
              <input name="guardian_name" maxLength={120} />
            </Field>
            <Field label="جوال ولي الأمر" hint="رقم مستقل للتواصل بشأن الطالب.">
              <input
                name="guardian_phone"
                type="tel"
                dir="ltr"
                placeholder="05xxxxxxxx"
              />
            </Field>
          </div>
          <label className="registration-trap" aria-hidden="true">
            الموقع
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="check-label">
            <input name="consent" type="checkbox" required />
            {isStaticPreview
              ? "أؤكد أن البيانات وهمية للتجربة."
              : "أوافق على حفظ بيانات الطالب لأغراض التدريب، وأؤكد موافقة ولي الأمر إذا كان الطالب قاصرًا."}
          </label>
          <p className="muted">
            يبقى الحساب غير مفعّل حتى مراجعة إدارة المركز. الموافقة على رسائل
            الغياب تُوثّق بشكل مستقل بعد مراجعة بيانات ولي الأمر.
          </p>
        </Form>
      )}
    </Modal>
  );
}
