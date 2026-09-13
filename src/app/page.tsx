import Image from "@/components/site-image";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { tracks, courses, arabicNumber, courseCountLabel } from "@/lib/courses";
import { Catalog } from "@/components/catalog";
import { ButtonLink, ContactBanner, FaqList } from "@/components/ui";
import {
  ArrowLeft,
  ArrowUpLeft,
  GraduationCap,
  Translate,
  Briefcase,
  Palette,
  Compass,
  ChatCircleText,
  CheckCircle,
} from "@/components/icons";

const trackIcons = {
  exams: GraduationCap,
  english: Translate,
  development: Briefcase,
  arts: Palette,
};
export default function Home() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" />
            مركز تفاصيل للتدريب
          </p>
          <h1>
            قدراتك تستحق
            <br />
            <span>بداية أقوى.</span>
          </h1>
          <p className="hero-description">
            استعد لاختبارك، طوّر لغتك، واكتشف مهارة جديدة.
            <br className="desktop-break" /> اختر مسارك، وابدأ بخطوة مدروسة.
          </p>
          <div className="hero-buttons">
            <ButtonLink href="/courses/">اكتشف الدورات</ButtonLink>
            <Link className="hero-about" href="/about/">
              تعرّف على المركز <ArrowUpLeft size={20} />
            </Link>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-brand-panel">
            <Brand full />
          </div>
          <div className="hero-caption">
            <span className="caption-icon">
              <GraduationCap size={25} weight="light" />
            </span>
            <div>
              <strong>للطموح أكثر من مسار</strong>
              <span>اختر ما يناسب خطوتك القادمة</span>
            </div>
            <ArrowUpLeft size={23} />
          </div>
        </div>
      </section>
      <nav
        className="track-navigation container"
        aria-label="استكشف المسارات التدريبية"
      >
        {tracks.map((track) => {
          const Icon = trackIcons[track.id];
          return (
            <Link href={`/tracks/${track.id}/`} key={track.id}>
              <span className="track-icon">
                <Icon size={27} weight="light" />
              </span>
              <span>
                <strong>{track.title}</strong>
                <small>
                  {courseCountLabel(
                    courses.filter((c) => c.track === track.id).length,
                  )}
                </small>
              </span>
              <ArrowUpLeft className="track-arrow" size={20} />
            </Link>
          );
        })}
      </nav>
      <section className="section programs-section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">مسارك يبدأ هنا</p>
            <h2>تعلم يناسب طموحك.</h2>
            <p>دورات متنوعة، تجمعها عناية واحدة: أن تبدأ من المكان الصحيح.</p>
          </div>
          <span className="programs-count">
            <b>{arabicNumber(courses.length)}</b> دورة تدريبية
          </span>
        </div>
        <Catalog featured />
      </section>
      <section className="about-section">
        <div className="container about-grid">
          <div className="about-visual">
            <span className="about-pattern" aria-hidden="true">
              <Image
                src="/brand/pattern-vertical.webp"
                alt=""
                fill
                sizes="600px"
              />
            </span>
            <Image
              src="/images/english-photo.webp"
              alt="كتب وأدوات دراسية تعبر عن رحلة التعلم"
              width={720}
              height={600}
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <div className="about-caption">
              <span>مركز تفاصيل للتدريب</span>
              <span dir="ltr" lang="en">
                TAFASEEL TRAINING
              </span>
            </div>
          </div>
          <div className="about-copy">
            <h2>
              معرفة تتطور.
              <br />
              وطموح يأخذ شكله.
            </h2>
            <p>
              في مركز تفاصيل، نجمع الاستعداد للاختبارات وتعلم اللغة وتطوير
              المهارات في وجهة واحدة. نساعدك على التعرف على خياراتك، واختيار ما
              يلائم مرحلتك وهدفك.
            </p>
            <div className="about-points">
              <div>
                <Compass size={24} />
                <span>
                  <strong>وجهة واضحة للتعلم</strong>
                  <small>أربعة مسارات تسهّل وصولك إلى الدورة المناسبة.</small>
                </span>
              </div>
              <div>
                <ChatCircleText size={24} />
                <span>
                  <strong>تواصل مباشر قبل القرار</strong>
                  <small>تفاصيل واضحة، وإجابة عن استفساراتك عبر واتساب.</small>
                </span>
              </div>
            </div>
            <Link href="/about/" className="text-link">
              المزيد عن المركز <ArrowLeft size={19} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section container booking-steps">
        <div className="section-heading">
          <div>
            <h2>من اختيارك، إلى تأكيد حجزك.</h2>
            <p>ثلاث خطوات واضحة، وفريق المركز معك في كل خطوة.</p>
          </div>
          <Link href="/booking/" className="text-link">
            ابدأ طلب الحجز <ArrowLeft size={18} />
          </Link>
        </div>
        <ol className="steps-grid">
          <li>
            <span className="step-icon">
              <Compass size={28} weight="light" />
            </span>
            <div>
              <h3>اختر دورتك</h3>
              <p>استعرض المسارات واقرأ نبذة الدورة التي تناسب هدفك.</p>
            </div>
          </li>
          <li>
            <span className="step-icon">
              <ChatCircleText size={28} weight="light" />
            </span>
            <div>
              <h3>عبّئ بياناتك وأرسل طلبك</h3>
              <p>
                أكمل النموذج، ثم راجع رسالة واتساب وأرسلها لاستلام التفاصيل.
              </p>
            </div>
          </li>
          <li>
            <span className="step-icon">
              <CheckCircle size={28} weight="light" />
            </span>
            <div>
              <h3>أكّد حجزك</h3>
              <p>استكمل الإجراءات مع الفريق واستلم تأكيد الحجز عبر واتساب.</p>
            </div>
          </li>
        </ol>
      </section>
      <section className="section container faq-section">
        <div className="faq-intro">
          <h2>قبل أن تبدأ.</h2>
          <p>إجابات مختصرة عن الأسئلة التي تهمك.</p>
          <Link href="/faq/" className="text-link">
            جميع الأسئلة <ArrowLeft size={18} />
          </Link>
        </div>
        <FaqList limit={4} />
      </section>
      <ContactBanner />
    </>
  );
}
