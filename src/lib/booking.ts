export type Applicant = {
  name: string;
  mobile: string;
  city: string;
  course: string;
  note: string;
};

export const assistanceOption = "help-me-choose";

export function normalizeMobile(value: string): string | null {
  const number = value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[\s()\-]/g, "");
  if (/^05\d{8}$/.test(number)) return `+966${number.slice(1)}`;
  if (/^(?:\+?966|00966)5\d{8}$/.test(number)) return `+966${number.slice(-9)}`;
  return null;
}

export function applicantMessage(applicant: Applicant, courseTitle: string) {
  return [
    "مرحبًا مركز تفاصيل للتدريب،",
    "أرغب في تقديم طلب تدريب بالبيانات التالية:",
    "",
    `الاسم الكامل: ${applicant.name.trim().replace(/\s+/g, " ")}`,
    `رقم الجوال: \u200e${normalizeMobile(applicant.mobile) ?? applicant.mobile.trim()}\u200e`,
    ...(applicant.city.trim() ? [`المدينة: ${applicant.city.trim()}`] : []),
    `الدورة المطلوبة: ${courseTitle}`,
    ...(applicant.note.trim()
      ? ["", `ملاحظات واستفسارات: ${applicant.note.trim()}`]
      : []),
    "",
    "أرجو تزويدي بمحتوى الدورة والمواعيد والمدة والرسوم وطريقة الحضور وخطوات تأكيد الحجز.",
  ].join("\n");
}
