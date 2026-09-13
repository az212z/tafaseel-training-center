import Link from "@/components/version-link";
import { Brand } from "./brand";
import { tracks } from "@/lib/courses";
import { phoneDisplay, internationalPhone } from "@/lib/contact";
import { Phone, WhatsappLogo, ArrowUpLeft } from "./icons";

export function Footer() {
  return (
    <>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link href="/" aria-label="العودة إلى الرئيسية">
              <Brand />
            </Link>
            <p>
              بداية مدروسة لطموحك.
              <br />
              في الاختبارات، واللغة، والمهارات، والفنون.
            </p>
          </div>
          <div>
            <h2>المسارات التدريبية</h2>
            <ul>
              {tracks.map((track) => (
                <li key={track.id}>
                  <Link href={`/tracks/${track.id}/`}>{track.title}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>المركز</h2>
            <ul>
              <li>
                <Link href="/about/">عن مركز تفاصيل</Link>
              </li>
              <li>
                <Link href="/courses/">جميع الدورات</Link>
              </li>
              <li>
                <Link href="/faq/">الأسئلة الشائعة</Link>
              </li>
              <li>
                <Link href="/booking/">طلب حجز دورة</Link>
              </li>
            </ul>
          </div>
          <div className="footer-contact">
            <h2>يسعدنا تواصلك</h2>
            <a className="footer-phone" href={`tel:+${internationalPhone}`}>
              <Phone size={19} />
              <bdi>{phoneDisplay}</bdi>
            </a>
            <Link className="text-link" href="/booking/">
              تواصل عبر واتساب <ArrowUpLeft size={17} />
            </Link>
            <p>
              تفاصيل الدورات وتأكيد الحجز
              <br />
              عبر فريق المركز مباشرة.
            </p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            ©{" "}
            {new Date()
              .getFullYear()
              .toLocaleString("ar-SA", { useGrouping: false })}{" "}
            مركز تفاصيل للتدريب. جميع الحقوق محفوظة.
          </span>
          <div>
            <Link href="/privacy/">الخصوصية</Link>
            <Link href="/booking-policy/">آلية الحجز</Link>
          </div>
        </div>
      </footer>
      <Link
        className="floating-whatsapp"
        href="/booking/"
        aria-label="نموذج التواصل مع مركز تفاصيل عبر واتساب"
      >
        <WhatsappLogo size={28} weight="regular" />
      </Link>
    </>
  );
}
