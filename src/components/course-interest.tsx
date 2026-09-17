"use client";

import { useEffect, useRef, useState } from "react";
import { arabicNumber } from "@/lib/courses";
import { whatsappUrl } from "@/lib/contact";
import {
  courseInterestError,
  courseInterestMessage,
  type InterestGroup,
} from "@/lib/course-interest";
import { ArrowLeft, GraduationCap, WhatsappLogo, X } from "./icons";

export function CourseInterest({ groups }: { groups: InterestGroup[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstOptionRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const courses = groups.flatMap((group) => group.courses);
  const message = courseInterestMessage(selected, courses);

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

  function showCourses() {
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
        aria-label="اختر دورتك — نتصل بك عند اكتمال العدد"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="course-interest-dialog"
        onClick={showCourses}
      >
        <span className="course-interest-trigger-icon" aria-hidden="true">
          <GraduationCap size={34} weight="duotone" />
        </span>
        <span className="course-interest-trigger-copy">
          <strong>اختر دورتك</strong>
          <span>نتصل بك عند اكتمال العدد</span>
        </span>
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
          <div className="course-interest-header">
            <div className="course-interest-topline">
              <span className="course-interest-signature">
                <GraduationCap size={24} aria-hidden="true" />
                خطوتك الأولى نحو التعلّم
              </span>
              <button
                type="button"
                className="course-interest-close"
                aria-label="إغلاق نموذج اختيار الدورات"
                onClick={() => dialogRef.current?.close()}
              >
                <X size={21} />
              </button>
            </div>
            <h2 id="course-interest-heading" ref={headingRef} tabIndex={-1}>
              {reviewing ? "راجع الدورات التي اخترتها" : "اختر دورتك"}
            </h2>
            <p
              id="course-interest-description"
              className="course-interest-description"
            >
              {reviewing
                ? "راجع رسالتك، ثم أرسلها عبر واتساب ليتواصل معك فريق المركز."
                : "اختر الدورة التي ترغب بالالتحاق بها، وسيتصل بك فريق المركز عند اكتمال العدد اللازم لبدء الدورة."}
            </p>
          </div>

          {reviewing ? (
            <div className="course-interest-review">
              <div
                className="course-interest-message"
                aria-label="معاينة طلب التواصل"
              >
                {message}
              </div>
              <a
                href={whatsappUrl(message)}
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
                تعديل اختياراتي
              </button>
              <p className="course-interest-note">
                يصل طلبك إلى المركز بعد إرسال الرسالة في واتساب.
              </p>
            </div>
          ) : (
            <form
              className="course-interest-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const validation = courseInterestError(selected, courses);
                setError(validation);
                if (validation) firstOptionRef.current?.focus();
                else setReviewing(true);
              }}
            >
              <div className="course-interest-selection-summary">
                <span id="course-interest-hint">
                  يمكنك اختيار أكثر من دورة.
                </span>
                <span role="status" aria-live="polite" aria-atomic="true">
                  المختارة: {arabicNumber(selected.length)}
                </span>
              </div>
              <div
                className="course-interest-options"
                role="group"
                aria-label="الدورات المتاحة للاختيار"
                aria-describedby={`course-interest-hint${error ? " course-interest-error" : ""}`}
              >
                {groups.map((group, groupIndex) => (
                  <fieldset className="course-interest-group" key={group.id}>
                    <legend>{group.title}</legend>
                    <div className="course-interest-grid">
                      {group.courses.map((course, courseIndex) => (
                        <label
                          className="course-interest-option"
                          key={course.slug}
                        >
                          <input
                            ref={
                              groupIndex === 0 && courseIndex === 0
                                ? firstOptionRef
                                : undefined
                            }
                            type="checkbox"
                            name="requestedCourses"
                            value={course.slug}
                            checked={selected.includes(course.slug)}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setSelected((current) =>
                                checked
                                  ? [...current, course.slug]
                                  : current.filter(
                                      (slug) => slug !== course.slug,
                                    ),
                              );
                              setError(null);
                            }}
                          />
                          <span>{course.title}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="course-interest-actions">
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
                  مراجعة طلب التواصل
                  <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <p className="course-interest-note">
                  تُرسل اختياراتك إلى فريق المركز عبر واتساب.
                </p>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
