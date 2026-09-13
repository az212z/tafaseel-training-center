import type { Metadata } from "next";
import Link from "@/components/version-link";
import { Breadcrumbs, FaqList } from "@/components/ui";
import { internationalPhone, phoneDisplay } from "@/lib/contact";
import {
  WhatsappLogo,
  Phone,
  ArrowUpLeft,
  NotePencil,
} from "@/components/icons";
export const metadata: Metadata = { title: "تواصل معنا" };
export default function ContactPage() {
  return (
    <div className="container">
      <Breadcrumbs items={[{ title: "تواصل معنا" }]} />
      <header className="page-heading">
        <p className="eyebrow">نحن هنا لمساعدتك</p>
        <h1>نتحدث عن خطوتك القادمة.</h1>
        <p>استفسر عن دورة، أو اطلب مساعدة في اختيار المسار المناسب لك.</p>
      </header>
      <section className="contact-options">
        <Link href="/booking/" className="contact-option primary-contact">
          <WhatsappLogo size={38} weight="light" />
          <h2>عبر واتساب</h2>
          <p>عبّئ بياناتك في النموذج، ثم أرسل طلبك في رسالة واتساب.</p>
          <bdi>{phoneDisplay}</bdi>
          <span>
            تعبئة نموذج التواصل <ArrowUpLeft size={22} />
          </span>
        </Link>
        <a href={`tel:+${internationalPhone}`} className="contact-option">
          <Phone size={38} weight="light" />
          <h2>اتصل بنا</h2>
          <p>تواصل هاتفيًا مع المركز للاستفسار عن خيارات التدريب.</p>
          <bdi>{phoneDisplay}</bdi>
          <span>
            اتصال مباشر <ArrowUpLeft size={22} />
          </span>
        </a>
      </section>
      <Link href="/booking/" className="contact-booking-link">
        <NotePencil size={28} />
        <div>
          <h2>تعرف دورتك بالفعل؟</h2>
          <p>جهز طلبك وراجعه قبل إرساله إلى المركز.</p>
        </div>
        <ArrowUpLeft size={23} />
      </Link>
      <section className="section faq-section">
        <div className="faq-intro">
          <h2>قد تجد إجابتك هنا.</h2>
          <p>معلومات تساعدك قبل التواصل.</p>
        </div>
        <FaqList limit={3} />
      </section>
    </div>
  );
}
