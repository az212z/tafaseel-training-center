"use client";

import { useEffect, useRef, useState } from "react";
import { arabicNumber } from "@/lib/courses";
import { whatsappUrl } from "@/lib/contact";
import {
  courseInterestError,
  courseInterestLimit,
  courseInterestMessage,
} from "@/lib/course-interest";
import { ArrowLeft, Question, WhatsappLogo, X } from "./icons";

export function CourseInterest() {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (open) headingRef.current?.focus({ preventScroll: true });
  }, [open, reviewing]);

  function showQuestion() {
    setReviewing(false);
    setError(null);
    setOpen(true);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="course-interest-trigger"
        aria-label="دورتك القادمة؟ أخبرنا بالدورات التي تهمك"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="course-interest-dialog"
        onClick={showQuestion}
      >
        <span className="course-interest-trigger-icon" aria-hidden="true">
          <Question size={27} weight="regular" />
        </span>
        <span>دورتك القادمة؟</span>
      </button>

      <dialog
        ref={dialogRef}
        id="course-interest-dialog"
        className="course-interest-dialog"
        aria-labelledby="course-interest-heading"
        aria-describedby="course-interest-description"
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus({ preventScroll: true });
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="course-interest-panel">
          <div className="course-interest-topline">
            <span className="course-interest-signature">
              <Question size={22} aria-hidden="true" />
              دورتك القادمة
            </span>
            <button
              type="button"
              className="course-interest-close"
              aria-label="إغلاق نموذج الدورات المطلوبة"
              onClick={() => dialogRef.current?.close()}
            >
              <X size={21} />
            </button>
          </div>

          <h2 id="course-interest-heading" ref={headingRef} tabIndex={-1}>
            {reviewing
              ? "رغبتك جاهزة للمشاركة."
              : "ما الدورة التي تتطلع إليها؟"}
          </h2>
          <p
            id="course-interest-description"
            className="course-interest-description"
          >
            {reviewing
              ? "راجع رسالتك، ثم افتح واتساب وأرسلها لفريق المركز."
              : "شاركنا الدورات التي تهمك، ليتواصل معك فريق المركز عبر واتساب عند توفرها."}
          </p>

          {reviewing ? (
            <div className="course-interest-review">
              <div
                className="course-interest-message"
                aria-label="معاينة رسالة الاهتمام"
              >
                {courseInterestMessage(answer)}
              </div>
              <a
                href={whatsappUrl(courseInterestMessage(answer))}
                className="course-interest-submit"
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsappLogo size={23} aria-hidden="true" />
                متابعة إلى واتساب
                <ArrowLeft size={20} aria-hidden="true" />
              </a>
              <button
                type="button"
                className="course-interest-edit"
                onClick={() => setReviewing(false)}
              >
                تعديل الدورات المطلوبة
              </button>
              <p className="course-interest-note">
                تصل رغبتك للفريق عند إرسال الرسالة في واتساب.
              </p>
            </div>
          ) : (
            <form
              className="course-interest-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const validation = courseInterestError(answer);
                setError(validation);
                if (validation) inputRef.current?.focus();
                else setReviewing(true);
              }}
            >
              <label htmlFor="course-interest-answer">الدورات التي تهمك</label>
              <textarea
                ref={inputRef}
                id="course-interest-answer"
                name="requestedCourses"
                placeholder="مثال: آيلتس، الخط العربي، التصميم الداخلي…"
                rows={4}
                required
                maxLength={courseInterestLimit}
                value={answer}
                aria-invalid={Boolean(error)}
                aria-describedby={`course-interest-hint${error ? " course-interest-error" : ""}`}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  setError(null);
                }}
              />
              <div className="course-interest-field-footer">
                <span id="course-interest-hint">
                  يمكنك ذكر أكثر من دورة أو مجال.
                </span>
                <span
                  aria-label={`${arabicNumber(answer.length)} من ${arabicNumber(courseInterestLimit)} حرف`}
                >
                  {arabicNumber(answer.length)} /{" "}
                  {arabicNumber(courseInterestLimit)}
                </span>
              </div>
              {error && (
                <p
                  id="course-interest-error"
                  className="course-interest-error"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <button type="submit" className="course-interest-submit">
                <WhatsappLogo size={23} aria-hidden="true" />
                تجهيز رسالة واتساب
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
              <p className="course-interest-note">
                التواصل عبر فريق المركز مباشرة.
              </p>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
