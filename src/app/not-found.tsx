import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";
import { Compass } from "@/components/icons";
export const metadata: Metadata = { title: "الصفحة غير موجودة" };
export default function NotFound() {
  return (
    <div className="container not-found">
      <Compass size={58} weight="light" />
      <p className="eyebrow">الصفحة غير موجودة</p>
      <h1>نعود إلى المسار الصحيح.</h1>
      <p>قد يكون الرابط غير صحيح. يمكنك متابعة استكشاف الدورات من هنا.</p>
      <ButtonLink href="/courses/">استعرض الدورات</ButtonLink>
    </div>
  );
}
