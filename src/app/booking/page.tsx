import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking-form";
import { Breadcrumbs } from "@/components/ui";
import { Phone, Check } from "@/components/icons";
import { internationalPhone, phoneDisplay } from "@/lib/contact";
export const metadata: Metadata = {
  title: "طلب حجز دورة",
  description:
    "عبّئ بياناتك واختر دورتك، ثم راجع رسالة طلبك وأرسلها إلى مركز تفاصيل عبر واتساب.",
};
export default function BookingPage() {
  return (
    <div className="container">
      <Breadcrumbs items={[{ title: "طلب حجز دورة" }]} />
      <section className="booking-layout">
        <div className="booking-intro">
          <div className="booking-intro-copy">
            <p className="eyebrow">ابدأ خطوتك القادمة</p>
            <h1>
              بياناتك أولًا،
              <br />
              وخطوتك أوضح.
            </h1>
            <p>
              عبّئ نموذج الطلب، وسنرتّب بياناتك في رسالة جاهزة. أرسلها عبر
              واتساب لاستلام التفاصيل واستكمال الحجز مع فريق المركز.
            </p>
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
        <div className="booking-help">
          <ul className="check-list">
            <li>
              <Check size={19} />
              عبّئ بياناتك واختر الدورة
            </li>
            <li>
              <Check size={19} />
              راجع رسالة طلبك وعدّلها عند الحاجة
            </li>
            <li>
              <Check size={19} />
              أرسلها عبر واتساب واستلم التفاصيل والتأكيد
            </li>
          </ul>
          <div className="booking-direct">
            <span>للاستفسار الهاتفي</span>
            <a href={`tel:+${internationalPhone}`}>
              <Phone size={22} />
              <bdi>{phoneDisplay}</bdi>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
