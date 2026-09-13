"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { courses, getCourse, tracks } from "@/lib/courses";
import { whatsappUrl } from "@/lib/contact";
import {
  applicantMessage,
  assistanceOption,
  normalizeMobile,
  type Applicant,
} from "@/lib/booking";
import { ArrowLeft, WhatsappLogo, CheckCircle, NotePencil } from "./icons";

export function BookingForm() {
  const search = useSearchParams();
  const requested = search.get("course") ?? "";
  const initial =
    requested === assistanceOption
      ? assistanceOption
      : (getCourse(requested)?.slug ?? "");
  return <BookingFields key={initial} initial={initial} />;
}

function BookingFields({ initial }: { initial: string }) {
  const [applicant, setApplicant] = useState<Applicant>({
    name: "",
    mobile: "",
    city: "",
    course: initial,
    note: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof Applicant, string>>
  >({});
  const [reviewing, setReviewing] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hasReviewed = useRef(false);
  useEffect(() => {
    if (reviewing) {
      reviewHeading.current?.focus();
      hasReviewed.current = true;
    } else if (hasReviewed.current) {
      (
        formRef.current?.elements.namedItem("name") as HTMLInputElement | null
      )?.focus();
    }
  }, [reviewing]);
  const selected = getCourse(applicant.course);
  const courseTitle =
    selected?.title ??
    (applicant.course === assistanceOption
      ? "المساعدة في اختيار الدورة المناسبة"
      : "");
  const message = applicantMessage(applicant, courseTitle);
  function update(field: keyof Applicant, value: string) {
    setApplicant((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }
  if (reviewing)
    return (
      <div className="booking-review">
        <span className="form-step">الخطوة ٢ من ٢ · رسالة واتساب</span>
        <span className="feature-icon">
          <NotePencil size={30} />
        </span>
        <h2 ref={reviewHeading} tabIndex={-1}>
          بياناتك جاهزة في رسالة واحدة.
        </h2>
        <p>
          راجع بياناتك، ثم افتح واتساب. اضغط إرسال داخل المحادثة ليصل طلبك إلى
          المركز.
        </p>
        <div className="message-preview">{message}</div>
        <a
          href={whatsappUrl(message)}
          className="button button-primary full-width"
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsappLogo size={23} />
          متابعة إلى واتساب <ArrowLeft size={19} />
        </a>
        <button
          className="text-link edit-request"
          onClick={() => setReviewing(false)}
        >
          تعديل الطلب
        </button>
        <p className="form-note">
          <CheckCircle size={18} />
          يؤكد فريق المركز حجزك بعد استكمال الإجراءات عبر واتساب.
        </p>
      </div>
    );
  return (
    <form
      ref={formRef}
      className="booking-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const nextErrors: Partial<Record<keyof Applicant, string>> = {};
        if (applicant.name.trim().length < 2)
          nextErrors.name = "يرجى إدخال اسمك الكامل.";
        if (!normalizeMobile(applicant.mobile))
          nextErrors.mobile = "أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05 أو +9665.";
        if (!courseTitle)
          nextErrors.course = "اختر الدورة أو طلب المساعدة في الاختيار.";
        setErrors(nextErrors);
        const firstError = Object.keys(nextErrors)[0];
        if (firstError) {
          (
            event.currentTarget.elements.namedItem(
              firstError,
            ) as HTMLElement | null
          )?.focus();
          return;
        }
        setReviewing(true);
      }}
    >
      <span className="form-step">الخطوة ١ من ٢ · بيانات المتقدم</span>
      <h2>عرّفنا بك وبالدورة التي تهمك.</h2>
      <p>
        تتحول بياناتك إلى رسالة مرتبة، تراجعها ثم ترسلها عبر واتساب. الحقول
        المشار إليها بـ * مطلوبة.
      </p>
      <div className="form-field">
        <label htmlFor="name">
          الاسم الكامل <span aria-hidden="true">*</span>
        </label>
        <input
          id="name"
          name="name"
          value={applicant.name}
          onChange={(event) => update("name", event.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          placeholder="اكتب اسمك الكامل"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && (
          <p className="field-error" id="name-error">
            {errors.name}
          </p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="mobile">
          رقم الجوال <span aria-hidden="true">*</span>
        </label>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          value={applicant.mobile}
          onChange={(event) => update("mobile", event.target.value)}
          required
          maxLength={24}
          placeholder="05XXXXXXXX"
          aria-invalid={Boolean(errors.mobile)}
          aria-describedby={`mobile-hint${errors.mobile ? " mobile-error" : ""}`}
        />
        <p className="field-hint" id="mobile-hint">
          رقمك للتواصل بشأن الطلب. يمكنك كتابته بالأرقام العربية أو الإنجليزية.
        </p>
        {errors.mobile && (
          <p className="field-error" id="mobile-error">
            {errors.mobile}
          </p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="course">
          الدورة التدريبية <span aria-hidden="true">*</span>
        </label>
        <select
          id="course"
          name="course"
          required
          value={applicant.course}
          onChange={(event) => update("course", event.target.value)}
          aria-invalid={Boolean(errors.course)}
          aria-describedby={errors.course ? "course-error" : undefined}
        >
          <option value="" disabled>
            اختر الدورة
          </option>
          {tracks.map((track) => (
            <optgroup key={track.id} label={track.title}>
              {courses
                .filter((c) => c.track === track.id)
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value={assistanceOption}>
            أحتاج مساعدة في اختيار الدورة
          </option>
        </select>
        {errors.course && (
          <p className="field-error" id="course-error">
            {errors.course}
          </p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="city">
          المدينة <span className="optional">(اختياري)</span>
        </label>
        <input
          id="city"
          name="city"
          autoComplete="address-level2"
          maxLength={60}
          value={applicant.city}
          onChange={(event) => update("city", event.target.value)}
          placeholder="المدينة التي تقيم فيها"
        />
      </div>
      <div className="form-field">
        <label htmlFor="note">
          ملاحظات أو استفسارات <span className="optional">(اختياري)</span>
        </label>
        <textarea
          id="note"
          name="note"
          value={applicant.note}
          onChange={(event) => update("note", event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="يمكنك ذكر مستواك الحالي أو هدفك من الدورة."
        />
        <span className="character-count">
          {applicant.note.length.toLocaleString("ar-SA")} / ٥٠٠
        </span>
      </div>
      <button type="submit" className="button button-primary full-width">
        تجهيز رسالة واتساب <ArrowLeft size={19} />
      </button>
      <p className="form-note">
        لا تُرسل البيانات أو تُحفظ عند المراجعة. تُشارك مع المركز عندما ترسل
        رسالتك بنفسك في واتساب.
      </p>
    </form>
  );
}
