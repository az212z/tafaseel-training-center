import type { Metadata } from "next";
import { V2Catalog } from "@/components/v2-catalog";
import { Breadcrumbs, ContactBanner } from "@/components/ui";
export const metadata: Metadata = {
  title: "البرامج والدورات التدريبية",
  description:
    "استعرض ١٣ دورة ضمن خمسة أقسام: القدرات العامة، واللغة الإنجليزية، وقياس والاختبارات التعليمية، والتطوير، والفنون والتصميم.",
};
export default function V2Courses() {
  return (
    <>
      <div className="container">
        <Breadcrumbs items={[{ title: "الدورات التدريبية" }]} />
        <header className="page-heading">
          <p className="eyebrow">خمسة أقسام، ١٣ دورة تدريبية</p>
          <h1>برامجنا ودوراتنا التدريبية</h1>
          <p>
            ابدأ بالمجال الذي يهمك، وتعرّف على دوراته لاختيار ما يناسب مستواك
            وهدفك.
          </p>
        </header>
        <section className="catalog-section" aria-label="دليل الدورات">
          <V2Catalog />
        </section>
      </div>
      <ContactBanner />
    </>
  );
}
