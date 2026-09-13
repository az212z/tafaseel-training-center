import type { Metadata } from "next";
import { Breadcrumbs, ContactBanner, FaqList } from "@/components/ui";
export const metadata: Metadata = { title: "الأسئلة الشائعة" };
export default function FaqPage() {
  return (
    <>
      <div className="container narrow-page">
        <Breadcrumbs items={[{ title: "الأسئلة الشائعة" }]} />
        <header className="page-heading">
          <h1>إجابات قبل البداية.</h1>
          <p>كل ما تحتاج معرفته عن استعراض الدورات وطلب الحجز.</p>
        </header>
        <FaqList />
      </div>
      <ContactBanner />
    </>
  );
}
