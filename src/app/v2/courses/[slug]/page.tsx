import CoursePage from "@/components/course-page";
export {
  generateMetadata,
  generateStaticParams,
} from "@/components/course-page";
export const dynamicParams = false;
export default function V2Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <CoursePage params={params} variant="v2" />;
}
