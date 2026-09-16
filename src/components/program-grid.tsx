import Image from "@/components/site-image";
import Link from "@/components/version-link";
import { programs } from "@/lib/v2-courses";
import { arabicNumber } from "@/lib/courses";
import { programCourseCount } from "@/lib/v2-courses";
import { ArrowLeft } from "./icons";

export function ProgramGrid() {
  return (
    <div className="v2-program-grid">
      {programs.map((program, index) => (
        <article className="v2-program-card" key={program.id}>
          <Link
            className="v2-program-photo"
            href={`/tracks/${program.id}/`}
            tabIndex={-1}
            aria-hidden="true"
          >
            <Image
              src={`/images/${program.image.replace(/\.webp$/, "-thumb.webp")}`}
              alt={program.imageAlt}
              fill
              sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 40vw"
              style={{ objectPosition: "center 62%" }}
            />
            <span>{programCourseCount(program.courseSlugs.length)}</span>
          </Link>
          <div className="v2-program-body">
            <span className="v2-program-number" aria-hidden="true">
              {arabicNumber(index + 1).padStart(2, "٠")}
            </span>
            <h3>
              <Link href={`/tracks/${program.id}/`}>{program.title}</Link>
            </h3>
            <p>{program.description}</p>
            <Link
              className="text-link"
              href={`/tracks/${program.id}/`}
              aria-label={`عرض دورات ${program.shortTitle}`}
            >
              عرض الدورات <ArrowLeft size={18} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
