import type { Metadata } from "next";
import Image from "@/components/site-image";
import Link from "@/components/version-link";
import { Breadcrumbs, ContactBanner } from "@/components/ui";
import { programs } from "@/lib/v2-courses";
import { facilityImage } from "@/lib/facility-photos";
import { ArrowUpLeft } from "@/components/icons";
export const metadata: Metadata = {
  title: "عن المركز",
  description:
    "تعرّف على مركز تفاصيل للتدريب ومساراته في الاختبارات واللغة الإنجليزية والتطوير والفنون.",
};
export default function AboutPage() {
  return (
    <>
      <div className="container">
        <Breadcrumbs items={[{ title: "عن المركز" }]} />
        <header className="page-heading">
          <p className="eyebrow">عن مركز تفاصيل</p>
          <h1>نبدأ من طموحك.</h1>
          <p>وجهة تدريبية تجمع المعرفة والمهارة، لتجد البداية التي تناسبك.</p>
        </header>
        <div className="about-page-image">
          <Image
            src={facilityImage("reception")}
            alt="منطقة الاستقبال والجلسات داخل مركز تفاصيل للتدريب"
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className="facility-about-link">
          <span>من داخل مركز تفاصيل</span>
          <Link href="/gallery/" className="text-link">
            شاهد جميع صور المركز <ArrowUpLeft size={19} />
          </Link>
        </div>
        <section className="about-story section">
          <h2>
            أكثر من مجال.
            <br />
            وهدف واحد: تطورك.
          </h2>
          <div>
            <p>
              يقدم مركز تفاصيل للتدريب دورات في الاستعداد للاختبارات، وتأسيس
              اللغة الإنجليزية واختباراتها، والتطوير الذاتي والمهني، والفنون
              والتصميم.
            </p>
            <p>
              نؤمن أن البداية المناسبة تنطلق من فهم هدف المتعلم. لذلك نتيح لك
              التعرف على الدورات والتواصل المباشر مع فريق المركز للحصول على
              التفاصيل واختيار ما يلائم احتياجك.
            </p>
          </div>
        </section>
        <section className="about-track-list">
          <h2>مجالاتنا التدريبية</h2>
          {programs.map((track) => (
            <Link href={`/tracks/${track.id}/`} key={track.id}>
              <h3>{track.title}</h3>
              <p>{track.description}</p>
              <ArrowUpLeft size={24} />
            </Link>
          ))}
        </section>
      </div>
      <ContactBanner />
    </>
  );
}
