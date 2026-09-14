import CoursePage from "@/components/course-page";
import type { Metadata } from "next";
import { getV2Course } from "@/lib/v2-courses";
export { generateStaticParams } from "@/components/course-page";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const course = getV2Course((await params).slug);
  return { title: course?.title, description: course?.description };
}
export const dynamicParams = false;
export default function V2Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <CoursePage params={params} variant="v2" />;
}
