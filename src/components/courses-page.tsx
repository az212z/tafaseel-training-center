import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { Breadcrumbs, ContactBanner } from "@/components/ui";
export const metadata: Metadata = {
  title: "الدورات التدريبية",
  description:
    "استعرض ١٣ دورة في الاختبارات واللغة الإنجليزية والتطوير الذاتي والمهني والفنون والتصميم، واطلب حجزك عبر واتساب.",
};
export default function CoursesPage({ variant }: { variant?: "v2" }) {
  return (
    <>
      <div className="container">
        <Breadcrumbs items={[{ title: "الدورات التدريبية" }]} />
        <header className="page-heading">
          <p className="eyebrow">المسارات التدريبية</p>
          <h1>اختر ما يقرّبك من هدفك.</h1>
          <p>كل بداية لها دورتها. استعرض المسارات وابحث عن خطوتك القادمة.</p>
        </header>
        <section className="catalog-section" aria-label="دليل الدورات">
          <Catalog variant={variant} />
        </section>
      </div>
      <ContactBanner />
    </>
  );
}
