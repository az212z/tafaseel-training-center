"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { courses, getCourse, tracks } from "@/lib/courses";
import { whatsappUrl } from "@/lib/contact";
import { ArrowLeft, WhatsappLogo, CheckCircle, NotePencil } from "./icons";

export function BookingForm() {
  const search = useSearchParams();
  const initial = getCourse(search.get("course") ?? "")?.slug ?? "";
  return <BookingFields key={initial} initial={initial} />;
}

function BookingFields({ initial }: { initial: string }) {
  const [name, setName] = useState("");
  const [course, setCourse] = useState(initial);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus();
  }, [reviewing]);
  const selected = getCourse(course);
  const message = `مرحبًا مركز تفاصيل،\nالاسم: ${name.trim()}\nأرغب في حجز دورة: ${selected?.title ?? ""}\nأرجو إرسال محتوى الدورة والمواعيد والمدة والرسوم وطريقة الحضور وإجراءات تأكيد الحجز.${note.trim() ? `\nاستفساري: ${note.trim()}` : ""}`;
  if (reviewing)
    return (
      <div className="booking-review">
        <span className="feature-icon">
          <NotePencil size={30} />
        </span>
        <h2 ref={reviewHeading} tabIndex={-1}>
          راجع طلبك، ثم أكمله في واتساب
        </h2>
        <p>
          ستظهر الرسالة التالية في المحادثة. اضغط إرسال داخل واتساب ليصل طلبك
          إلى المركز.
        </p>
        <div className="message-preview">{message}</div>
        <a
          href={whatsappUrl(message)}
          className="button button-primary full-width"
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsappLogo size={23} />
          فتح واتساب لإرسال الطلب <ArrowLeft size={19} />
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
      className="booking-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !selected) return;
        setReviewing(true);
      }}
    >
      <h2>ما الدورة التي تهمك؟</h2>
      <p>أكمل البيانات لمراجعة رسالتك قبل الانتقال إلى واتساب.</p>
      <div className="form-field">
        <label htmlFor="name">
          الاسم <span aria-hidden="true">*</span>
        </label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          maxLength={80}
          pattern=".*\S.*"
          autoComplete="given-name"
          placeholder="اسمك الكريم"
        />
      </div>
      <div className="form-field">
        <label htmlFor="course">
          الدورة التدريبية <span aria-hidden="true">*</span>
        </label>
        <select
          id="course"
          name="course"
          required
          value={course}
          onChange={(event) => setCourse(event.target.value)}
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
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="note">
          استفسار إضافي <span className="optional">(اختياري)</span>
        </label>
        <textarea
          id="note"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="يمكنك ذكر مستواك الحالي أو هدفك من الدورة."
        />
        <span className="character-count">
          {note.length.toLocaleString("ar-SA")} / ٥٠٠
        </span>
      </div>
      <button type="submit" className="button button-primary full-width">
        مراجعة طلب الحجز <ArrowLeft size={19} />
      </button>
      <p className="form-note">
        لا تُرسل البيانات أو تُحفظ عند المراجعة. تُشارك مع المركز عندما ترسل
        رسالتك بنفسك في واتساب.
      </p>
    </form>
  );
}
