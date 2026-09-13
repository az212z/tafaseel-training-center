import type { Metadata } from "next";
import Image from "@/components/site-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { courses, getCourse, getTrack } from "@/lib/courses";
import { Breadcrumbs, ButtonLink, RelatedCourses } from "@/components/ui";
import {
  ArrowLeft,
  ChatCircleText,
  User,
  BookOpen,
  CheckCircle,
  WhatsappLogo,
} from "@/components/icons";
export const dynamicParams = false;
export function generateStaticParams() {
  return courses.map((course) => ({ slug: course.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const course = getCourse((await params).slug);
  return {
    title: course?.title ?? "الدورة غير موجودة",
    description: course?.description,
  };
}
export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const course = getCourse((await params).slug);
  if (!course) notFound();
  const track = getTrack(course.track)!;
  return (
    <>
      <div className="container">
        <Breadcrumbs
          items={[
            { title: "الدورات", href: "/courses/" },
            { title: track.title, href: `/tracks/${track.id}/` },
            { title: course.title },
          ]}
        />
        <section className="course-hero">
          <div className="course-hero-copy">
            <Link className="course-category" href={`/tracks/${track.id}/`}>
              {track.title}
            </Link>
            <h1>{course.title}</h1>
            <span className="english-title" dir="ltr" lang="en">
              {course.englishTitle}
            </span>
            <p>{course.description}</p>
            <div className="tags">
              {course.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <ButtonLink href={`/booking/?course=${course.slug}`}>
              طلب حجز الدورة
            </ButtonLink>
            <p className="booking-micro">
              <WhatsappLogo size={17} />
              الحجز والتأكيد عبر واتساب
            </p>
          </div>
          <div
            className={`course-hero-image ${course.imageFit === "contain" ? "course-artwork-contained" : ""}`}
          >
            <Image
              src={`/images/${course.image}`}
              alt={course.imageAlt}
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
              priority
              style={{ objectFit: course.imageFit ?? "cover" }}
            />
          </div>
        </section>
        <section className="course-information">
          <div>
            <div className="info-block">
              <span className="feature-icon">
                <BookOpen size={25} />
              </span>
              <h2>عن الدورة</h2>
              <p>{course.overview}</p>
            </div>
            <div className="info-block">
              <span className="feature-icon">
                <User size={25} />
              </span>
              <h2>لمن هذه الدورة؟</h2>
              <p>{course.audience}</p>
            </div>
          </div>
          <aside className="booking-aside">
            <ChatCircleText size={31} weight="light" />
            <h2>كل التفاصيل، قبل حجزك.</h2>
            <p>
              يرسل لك فريق المركز محتوى الدورة والمواعيد والمدة والرسوم وطريقة
              الحضور عبر واتساب.
            </p>
            <Link
              className="button button-primary full-width"
              href={`/booking/?course=${course.slug}`}
            >
              <WhatsappLogo size={21} />
              استفسر عن الدورة
            </Link>
            <div className="aside-note">
              <CheckCircle size={20} />
              <span>يتم تأكيد الحجز بعد استكمال الإجراءات مع فريق المركز.</span>
            </div>
          </aside>
        </section>
        <Link className="text-link back-to-courses" href="/courses/">
          العودة إلى جميع الدورات <ArrowLeft size={18} />
        </Link>
      </div>
      <RelatedCourses course={course} />
    </>
  );
}
