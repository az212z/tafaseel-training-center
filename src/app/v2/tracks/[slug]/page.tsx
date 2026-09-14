import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "@/components/site-image";
import Link from "@/components/version-link";
import { programs, getProgram, getProgramCourses } from "@/lib/v2-courses";
import { programCourseCount } from "@/lib/v2-courses";
import {
  Breadcrumbs,
  ButtonLink,
  ContactBanner,
  CourseCard,
} from "@/components/ui";
import { ArrowLeft } from "@/components/icons";

export const dynamicParams = false;
export function generateStaticParams() {
  return programs.map((program) => ({ slug: program.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const program = getProgram((await params).slug);
  return { title: program?.title, description: program?.description };
}
export default async function V2ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const program = getProgram((await params).slug);
  if (!program) notFound();
  const courses = getProgramCourses(program.id);
  return (
    <>
      <div className="container">
        <Breadcrumbs
          items={[
            { title: "الدورات التدريبية", href: "/courses/" },
            { title: program.title },
          ]}
        />
        <header className="track-hero v2-program-hero">
          <div>
            <p className="eyebrow">
              برامج مركز تفاصيل · {programCourseCount(courses.length)}
            </p>
            <h1>{program.title}</h1>
            <p>{program.description}</p>
            <ButtonLink href="#program-courses">استعرض الدورات</ButtonLink>
          </div>
          <Image
            src={`/images/${program.image}`}
            alt={program.imageAlt}
            width={600}
            height={340}
            priority
          />
        </header>
        <section
          className="v2-program-courses"
          id="program-courses"
          aria-labelledby="program-courses-heading"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">اختر الدورة المناسبة لك</p>
              <h2 id="program-courses-heading">الدورات التابعة للبرنامج</h2>
              <p>
                تعرّف على كل دورة، ثم اطلب التسجيل للحصول على تفاصيلها عبر
                واتساب.
              </p>
            </div>
          </div>
          <div className="course-grid">
            {courses.map((course) => (
              <CourseCard key={course.slug} course={course} variant="v2" />
            ))}
          </div>
        </section>
        <section
          className="v2-program-overview"
          aria-labelledby="program-overview-heading"
        >
          <h2 id="program-overview-heading">عن البرنامج</h2>
          <div>
            <p>{program.overview}</p>
            <p className="v2-program-note">
              تُرسل تفاصيل المحتوى والمواعيد والرسوم عبر واتساب قبل تأكيد الحجز.
            </p>
          </div>
        </section>
        <Link className="text-link back-to-courses" href="/courses/">
          استعرض بقية الأقسام <ArrowLeft size={18} />
        </Link>
      </div>
      <ContactBanner />
    </>
  );
}
