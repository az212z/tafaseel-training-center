import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking-form";
import { Breadcrumbs } from "@/components/ui";
import { WhatsappLogo, Phone, Check } from "@/components/icons";
import { internationalPhone, phoneDisplay, whatsappUrl } from "@/lib/contact";
export const metadata: Metadata = {
  title: "طلب حجز دورة",
  description: "اختر دورتك وراجع طلبك ثم أكمل الحجز مع فريق المركز عبر واتساب.",
};
export default function BookingPage() {
  return (
    <div className="container">
      <Breadcrumbs items={[{ title: "طلب حجز دورة" }]} />
      <section className="booking-layout">
        <div className="booking-intro">
          <p className="eyebrow">ابدأ خطوتك القادمة</p>
          <h1>
            دورتك تبدأ
            <br />
            بمحادثة.
          </h1>
          <p>
            اختر الدورة التي تهمك، وسنساعدك على معرفة تفاصيلها واستكمال حجزك عبر
            واتساب.
          </p>
          <ul className="check-list">
            <li>
              <Check size={19} />
              محتوى الدورة وتفاصيلها قبل الحجز
            </li>
            <li>
              <Check size={19} />
              توضيح المواعيد والرسوم وطريقة الحضور
            </li>
            <li>
              <Check size={19} />
              تأكيد مباشر من فريق المركز
            </li>
          </ul>
          <div className="booking-direct">
            <span>تفضل التواصل مباشرة؟</span>
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
              <WhatsappLogo size={22} />
              <bdi>{phoneDisplay}</bdi>
            </a>
            <a className="small-phone" href={`tel:+${internationalPhone}`}>
              <Phone size={17} />
              اتصل بالمركز
            </a>
          </div>
        </div>
        <div className="form-shell">
          <Suspense
            fallback={
              <div className="form-loading" role="status">
                جارٍ تجهيز نموذج الحجز…
              </div>
            }
          >
            <BookingForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
