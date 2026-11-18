import { useState } from "react";
import { api } from "../api";
import { isStaticPreview } from "../environment";
import { Modal, Form, Field } from "./ui";
export function Registration({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="إنشاء حساب طالب" onClose={onClose} wide>
      <RegistrationForm onCancel={onClose} />
    </Modal>
  );
}
export function RegistrationForm({
  onCancel,
  courseId,
}: {
  onCancel?: () => void;
  courseId?: string;
}) {
  const [done, setDone] = useState("");
  const [birth, setBirth] = useState("");
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  const minor = birth !== "" && new Date(birth + "T00:00:00") > cutoff;
  return (
    <>
      {done ? (
        <div className="alert" role="status">
          {done}
        </div>
      ) : (
        <Form
          submitLabel={courseId ? "إنشاء الحساب والتسجيل" : "إنشاء الحساب"}
          onCancel={onCancel}
          onSubmit={async (d) => {
            const r = await api<{ message: string }>("register", {
              ...d,
              consent: d.consent === "on",
              course_id: courseId,
              verify_email: true,
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
              <input name="name" required maxLength={120} autoComplete="name" />
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
            <Field label="كلمة المرور" hint="١٢ حرفًا على الأقل.">
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
              <input
                name="birth_date"
                type="date"
                required
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
              />
            </Field>
            <Field label="رقم الجوال" hint={minor ? "اختياري" : undefined}>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required={!minor}
                dir="ltr"
                placeholder="05xxxxxxxx"
              />
            </Field>
            {minor && (
              <>
                <Field label="اسم ولي الأمر">
                  <input name="guardian_name" required maxLength={120} />
                </Field>
                <Field label="جوال ولي الأمر">
                  <input
                    name="guardian_phone"
                    required
                    type="tel"
                    dir="ltr"
                    placeholder="05xxxxxxxx"
                  />
                </Field>
              </>
            )}
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
        </Form>
      )}
    </>
  );
}
