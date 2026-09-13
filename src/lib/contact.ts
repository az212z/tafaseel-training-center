export const phone = "0558815053";
export const phoneDisplay = "٠٥٥٨٨١٥٠٥٣";
export const internationalPhone = "966558815053";
export function whatsappUrl(
  message = "مرحبًا مركز تفاصيل، أرغب في الاستفسار عن الدورات التدريبية.",
) {
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}
export const courseWhatsapp = (title: string) =>
  whatsappUrl(
    `مرحبًا مركز تفاصيل، أرغب في حجز دورة «${title}». أرجو إرسال محتوى الدورة والمواعيد والرسوم وطريقة الحضور وإجراءات تأكيد الحجز.`,
  );
