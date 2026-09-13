import Image from "@/components/site-image";
import { getTrack, type Course } from "@/lib/courses";

// Clean photographic alternatives to branded promotional posters in the comparison.
const photographs: Record<string, { image: string; alt: string }> = {
  ielts: {
    image: "v2-ielts.webp",
    alt: "طلاب يراجعون ويتدرّبون في فصل لتعلّم اللغة",
  },
};

export function CourseCover({
  course,
  large = false,
}: {
  course: Course;
  large?: boolean;
}) {
  const photo = photographs[course.slug] ?? {
    image: course.image,
    alt: course.imageAlt,
  };
  return (
    <div
      className={`v2-cover ${large ? "v2-cover-large" : ""}`}
      data-track={course.track}
    >
      <div className="v2-cover-photo">
        <Image
          src={`/images/${photo.image}`}
          alt={photo.alt}
          fill
          sizes={
            large
              ? "(max-width: 760px) 100vw, 50vw"
              : "(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
          }
          preload={large}
          style={
            course.slug === "step"
              ? { objectFit: "contain", background: "#fff" }
              : undefined
          }
        />
        <span className="v2-cover-category">
          {getTrack(course.track)?.shortTitle}
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
