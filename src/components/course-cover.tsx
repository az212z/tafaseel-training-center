import Image from "@/components/site-image";
import { type Course } from "@/lib/courses";
import { getCourseProgram } from "@/lib/v2-courses";

export function CourseCover({
  course,
  large = false,
}: {
  course: Course;
  large?: boolean;
}) {
  return (
    <div
      className={`v2-cover ${large ? "v2-cover-large" : ""}`}
      data-track={course.track}
    >
      <div className="v2-cover-photo">
        <Image
          src={`/images/${large ? course.image : course.image.replace(/\.webp$/, "-thumb.webp")}`}
          alt={course.imageAlt}
          fill
          sizes={
            large
              ? "(max-width: 760px) 100vw, 50vw"
              : "(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
          }
          preload={large}
          style={{ objectPosition: "center 62%" }}
        />
        <span className="v2-cover-category">
          {getCourseProgram(course.slug)?.shortTitle}
        </span>
      </div>
      <div className="v2-cover-label" aria-hidden="true">
        <span className="v2-cover-name">
          <span>{course.title}</span>
          <small lang="en" dir="ltr">
            {course.englishTitle}
          </small>
        </span>
        <span className="v2-cover-emblem">
          <Image
            src="/brand/logo-original.webp"
            alt=""
            width={1280}
            height={1136}
          />
        </span>
      </div>
      <span className="v2-cover-signature" aria-hidden="true">
        مركز تفاصيل للتدريب
      </span>
    </div>
  );
}
