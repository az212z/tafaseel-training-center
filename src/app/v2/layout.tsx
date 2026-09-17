import type { Metadata } from "next";
import { CourseInterest } from "@/components/course-interest";
import { getProgramCourses, programs } from "@/lib/v2-courses";
import "./v2.css";

export const metadata: Metadata = {
  title: {
    default: "تفاصيل | تعلّم يفتح لك آفاقًا جديدة — V2",
    template: "%s | مركز تفاصيل للتدريب — V2",
  },
  robots: { index: false, follow: true },
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="v2-view">
      {children}
      <CourseInterest
        groups={programs.map((program) => ({
          id: program.id,
          title: program.shortTitle,
          courses: getProgramCourses(program.id).map(({ slug, title }) => ({
            slug,
            title,
          })),
        }))}
      />
    </div>
  );
}
