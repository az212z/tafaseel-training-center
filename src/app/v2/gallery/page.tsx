import type { Metadata } from "next";
import { Breadcrumbs, ContactBanner } from "@/components/ui";
import { FacilityGallery } from "@/components/facility-gallery";

export const metadata: Metadata = {
  title: "صور المركز",
  description:
    "جولة مصوّرة داخل مركز تفاصيل للتدريب؛ القاعات التدريبية ومساحات الاستقبال والجلسات وتفاصيل المكان.",
};

export default function GalleryPage() {
  return (
    <>
      <div className="container">
        <Breadcrumbs items={[{ title: "صور المركز" }]} />
        <header className="page-heading facility-page-heading">
          <p className="eyebrow">جولة في مركز تفاصيل</p>
          <h1>للمكان تفاصيله.</h1>
          <p>تعرّف على قاعاتنا ومساحاتنا الداخلية من خلال صور المركز.</p>
        </header>
        <section
          className="facility-gallery-section"
          aria-label="معرض صور المركز"
        >
          <FacilityGallery />
        </section>
      </div>
      <ContactBanner />
    </>
  );
}
