import Link from "@/components/version-link";
import Image from "@/components/site-image";
import { ArrowLeft, CaretLeft, WhatsappLogo } from "./icons";
import { courses, getTrack, type Course, faqs } from "@/lib/courses";
import { CourseCover } from "./course-cover";
import { getCourseProgram, getProgramCourses } from "@/lib/v2-courses";

export function ButtonLink({
  href,
  children,
  secondary = false,
  whatsapp = false,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  secondary?: boolean;
  whatsapp?: boolean;
  className?: string;
}) {
  const external = href.startsWith("https://");
  return (
    <Link
      href={href}
      className={`button ${secondary ? "button-secondary" : "button-primary"} ${className}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {whatsapp && <WhatsappLogo size={21} weight="regular" />}
      <span>{children}</span>
      {!whatsapp && <ArrowLeft className="button-arrow" size={19} />}
    </Link>
  );
}

export function CourseCard({
  course,
  headingLevel = "h3",
  variant,
}: {
  course: Course;
  headingLevel?: "h2" | "h3";
  variant?: "v2";
}) {
  const Heading = headingLevel;
  return (
    <article className="course-card">
      <Link
        className={`course-image ${course.imageFit === "contain" ? "course-artwork-contained" : ""}`}
        href={`/courses/${course.slug}/`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {variant === "v2" ? (
          <CourseCover course={course} />
        ) : (
          <Image
            src={`/images/${course.image}`}
            alt={course.imageAlt}
            width={600}
            height={400}
            sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
            style={{ objectFit: course.imageFit ?? "cover" }}
          />
        )}
      </Link>
      <div className="course-body">
        <p className="course-category">
          {variant === "v2"
            ? getCourseProgram(course.slug)?.shortTitle
            : getTrack(course.track)?.shortTitle}
        </p>
        <Heading>
          <Link href={`/courses/${course.slug}/`}>{course.title}</Link>
        </Heading>
        <p className="course-description">{course.description}</p>
        {variant === "v2" ? (
          <div className="v2-course-actions">
            <Link
              href={`/courses/${course.slug}/`}
              className="button button-secondary"
              aria-label={`عرض تفاصيل ${course.title}`}
            >
              عرض التفاصيل
            </Link>
            <Link
              href={`/booking/?course=${course.slug}`}
              className="button button-primary"
              aria-label={`طلب التسجيل في ${course.title}`}
            >
              طلب التسجيل <ArrowLeft size={16} />
            </Link>
          </div>
        ) : (
          <div className="course-bottom">
            <span lang="en" dir="ltr">
              {course.englishTitle}
            </span>
            <Link
              href={`/courses/${course.slug}/`}
              className="circle-link"
              aria-label={`اكتشف دورة ${course.title}`}
            >
              <ArrowUpLeftIcon />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
function ArrowUpLeftIcon() {
  return <ArrowLeft size={19} className="diagonal-arrow" />;
}

export function Breadcrumbs({
  items,
}: {
  items: { title: string; href?: string }[];
}) {
  return (
    <nav aria-label="مسار الصفحة" className="breadcrumbs">
      <Link href="/">الرئيسية</Link>
      {items.map((item, i) => (
        <span key={i}>
          <CaretLeft size={12} />
          {item.href ? (
            <Link href={item.href}>{item.title}</Link>
          ) : (
            <span aria-current="page">{item.title}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function FaqList({ limit }: { limit?: number }) {
  return (
    <div className="faq-list">
      {faqs.slice(0, limit).map((faq) => (
        <details key={faq.question} name="faq">
          <summary>
            <span>{faq.question}</span>
            <span className="faq-plus" aria-hidden="true">
              +
            </span>
          </summary>
          <p>{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function ContactBanner() {
  return (
    <section className="contact-banner container">
      <span className="banner-pattern" aria-hidden="true">
        <Image src="/brand/pattern-light.webp" alt="" fill sizes="350px" />
      </span>
      <div>
        <span className="eyebrow">خطوتك القادمة</span>
        <h2>نساعدك تختار البداية المناسبة.</h2>
        <p>حدثنا عن هدفك، ودعنا نرشدك إلى الدورة الأقرب إليه.</p>
      </div>
      <ButtonLink href="/booking/" whatsapp>
        تحدث معنا عبر واتساب
      </ButtonLink>
    </section>
  );
}

export function RelatedCourses({
  course,
  variant,
}: {
  course: Course;
  variant?: "v2";
}) {
  const program = variant === "v2" ? getCourseProgram(course.slug) : undefined;
  const related = (program ? getProgramCourses(program.id) : courses)
    .filter(
      (c) => (program || c.track === course.track) && c.slug !== course.slug,
    )
    .slice(0, 3);
  if (!related.length) return null;
  return (
    <section className="section container">
      <div className="section-heading">
        <h2>
          {variant === "v2"
            ? "دورات أخرى في البرنامج"
            : "اكتشف أيضًا في هذا المسار"}
        </h2>
        <Link
          className="text-link"
          href={`/tracks/${program?.id ?? course.track}/`}
        >
          {variant === "v2" ? "عرض البرنامج" : "عرض المسار"}{" "}
          <ArrowLeft size={18} />
        </Link>
      </div>
      <div className="course-grid">
        {related.map((c) => (
          <CourseCard key={c.slug} course={c} variant={variant} />
        ))}
      </div>
    </section>
  );
}
