import Image from "@/components/site-image";
import Link from "@/components/version-link";
import { ProgramGrid } from "@/components/program-grid";
import { ButtonLink, ContactBanner, FaqList } from "@/components/ui";
import { arabicNumber } from "@/lib/courses";
import { programCourseCount } from "@/lib/v2-courses";
import { programs } from "@/lib/v2-courses";
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

const icons = {
  aptitude: GraduationCap,
  exams: GraduationCap,
  english: Translate,
  development: Briefcase,
  arts: Palette,
};

export default function V2Home() {
  return (
    <>
      <section className="v2-hero container">
        <div className="v2-hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" />
            مركز تفاصيل للتدريب
          </p>
          <h1>
            استعد لاختبارك.
            <br />
            <span>ووسّع آفاقك.</span>
          </h1>
          <p className="v2-hero-description">
            من استعدادك للقدرات إلى تطوير لغتك ومهاراتك.
            <br className="desktop-break" /> اختر ما يناسب هدفك، ودعنا نساعدك
            على البداية.
          </p>
          <div className="v2-hero-actions">
            <ButtonLink href="/courses/">اكتشف دورتك</ButtonLink>
            <Link
              href="/booking/?course=help-me-choose"
              className="v2-quiet-link"
            >
              ساعدني أختار <ArrowUpLeft size={20} />
            </Link>
          </div>
          <div className="v2-hero-facts">
            <div>
              <strong>١٣</strong>
              <span>دورة تدريبية</span>
            </div>
            <div>
              <strong>{arabicNumber(programs.length)}</strong>
              <span>أقسام تدريبية</span>
            </div>
            <p>
              <ChatCircleText size={24} weight="light" />
              <span>
                تواصل مباشر
                <br />
                وتأكيد الحجز عبر واتساب
              </span>
            </p>
          </div>
        </div>
        <div className="v2-hero-visual">
          <div className="v2-pattern-corner" aria-hidden="true">
            <Image src="/brand/pattern-blue.webp" alt="" fill sizes="160px" />
          </div>
          <figure className="v2-main-photo">
            <Image
              src="/images/course-achievement.webp"
              alt="متعلم سعودي يراجع ملاحظاته على الحاسب"
              fill
              sizes="(max-width: 760px) 90vw, 48vw"
              preload
            />
            <figcaption>
              <span>خطوة اليوم، فرصة الغد.</span>
              <ArrowUpLeft size={24} weight="light" />
            </figcaption>
          </figure>
          <figure className="v2-detail-photo">
            <Image
              src="/images/course-english.webp"
              alt="متعلّمة تستخدم حاسبها المحمول"
              fill
              sizes="(max-width: 760px) 32vw, 200px"
            />
          </figure>
          <span className="v2-photo-note">صور توضيحية لبيئات التعلّم</span>
        </div>
      </section>

      <section className="v2-tracks container" aria-labelledby="tracks-heading">
        <div className="v2-tracks-intro">
          <span className="eyebrow">ابدأ من هدفك</span>
          <h2 id="tracks-heading">للطموح أكثر من مسار.</h2>
        </div>
        <nav aria-label="استكشف المسارات التدريبية">
          {programs.map((track, i) => {
            const Icon = icons[track.id];
            return (
              <Link
                href={`/tracks/${track.id}/`}
                key={track.id}
                className="v2-track"
              >
                <span className="v2-track-top">
                  <Icon size={29} weight="light" />
                  <span>{arabicNumber(i + 1).padStart(2, "٠")}</span>
                </span>
                <strong>{track.shortTitle}</strong>
                <span className="v2-track-bottom">
                  <small>{programCourseCount(track.courseSlugs.length)}</small>
                  <ArrowUpLeft size={19} />
                </span>
              </Link>
            );
          })}
        </nav>
      </section>

      <section className="section container v2-programs">
        <div className="section-heading">
          <div>
            <p className="eyebrow">البرامج التدريبية</p>
            <h2>اختر مجالك، ثم دورتك.</h2>
            <p>تعرّف على برامجنا، واستعرض الدورات التابعة لكل برنامج.</p>
          </div>
          <Link className="text-link" href="/courses/">
            جميع الدورات <ArrowLeft size={19} />
          </Link>
        </div>
        <ProgramGrid />
      </section>

      <section className="v2-statement">
        <div className="container v2-statement-grid">
          <div className="v2-statement-identity" aria-hidden="true">
            <span className="v2-identity-pattern">
              <Image
                src="/brand/pattern-light.webp"
                alt=""
                fill
                sizes="400px"
              />
            </span>
            <span className="brand-full">
              <Image
                src="/brand/logo-original.webp"
                alt=""
                width={1280}
                height={1136}
              />
            </span>
          </div>
          <div>
            <p className="eyebrow">في تفاصيل، نبدأ معك</p>
            <h2>
              هدفك واضح.
              <br />
              ولكل بداية تفاصيلها.
            </h2>
            <p>
              نجمع الاستعداد للاختبارات وتعلّم اللغة وتطوير المهارات في وجهة
              واحدة. تعرّف على خياراتك، وتواصل معنا لتحديد الدورة الملائمة
              لمرحلتك.
            </p>
            <Link href="/about/" className="text-link">
              تعرّف على المركز <ArrowLeft size={20} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section container v2-booking-steps">
        <div className="section-heading">
          <div>
            <p className="eyebrow">من اختيارك إلى تأكيد حجزك</p>
            <h2>بداية سهلة، بخطوات واضحة.</h2>
          </div>
          <ButtonLink href="/booking/" secondary>
            ابدأ طلب الحجز
          </ButtonLink>
        </div>
        <ol className="v2-steps">
          <li>
            <span className="v2-step-number">٠١</span>
            <Compass size={28} weight="light" />
            <h3>اختر دورتك</h3>
            <p>تعرّف على الدورة والفئة المناسبة لها، وحدّد ما يلائم هدفك.</p>
          </li>
          <li>
            <span className="v2-step-number">٠٢</span>
            <ChatCircleText size={28} weight="light" />
            <h3>عبّئ بياناتك</h3>
            <p>راجع بيانات طلبك، ثم افتح الرسالة في واتساب وأرسلها للفريق.</p>
          </li>
          <li>
            <span className="v2-step-number">٠٣</span>
            <CheckCircle size={28} weight="light" />
            <h3>استلم التفاصيل وأكّد حجزك</h3>
            <p>يصلك محتوى الدورة والمواعيد والرسوم، ويُؤكّد الحجز مع المركز.</p>
          </li>
        </ol>
      </section>

      <section className="section container faq-section v2-faq">
        <div className="faq-intro">
          <p className="eyebrow">قبل أن تبدأ</p>
          <h2>
            إجابات تساعدك
            <br />
            على القرار.
          </h2>
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
