"use client";

import { useState } from "react";
import Link from "@/components/version-link";
import { courses, tracks, arabicNumber, type TrackId } from "@/lib/courses";
import { CourseCard } from "./ui";
import { MagnifyingGlass, X, ArrowLeft, BookOpen } from "./icons";

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .trim();
export function Catalog({
  featured = false,
  track,
  variant,
}: {
  featured?: boolean;
  track?: TrackId;
  variant?: "v2";
}) {
  const [selected, setSelected] = useState<TrackId | "all">(track ?? "all");
  const [query, setQuery] = useState("");
  const matches = courses.filter(
    (course) =>
      (selected === "all" || course.track === selected) &&
      normalize(
        [course.title, course.englishTitle, ...course.tags].join(" "),
      ).includes(normalize(query)),
  );
  const featuredSlugs = [
    "general-aptitude",
    "achievement-test",
    "english-foundation",
    "drawing-fine-arts",
    ...(variant === "v2" ? ["ielts", "professional-development"] : []),
  ];
  const visible =
    featured && selected === "all"
      ? courses.filter((course) => featuredSlugs.includes(course.slug))
      : featured
        ? matches.slice(0, variant === "v2" ? 6 : 4)
        : matches;
  return (
    <div className="catalog">
      {!featured && (
        <div className="catalog-search">
          <label htmlFor="course-search">ابحث عن دورتك</label>
          <div className="search-field">
            <MagnifyingGlass size={22} />
            <input
              id="course-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="اسم الدورة أو الاختبار، مثل: قدرات أو IELTS"
              maxLength={100}
              autoComplete="off"
            />
            {query && (
              <button
                className="icon-button"
                onClick={() => setQuery("")}
                aria-label="مسح البحث"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      )}
      {!track && (
        <div className="filter-row" aria-label="تصفية الدورات حسب المسار">
          <button
            aria-pressed={selected === "all"}
            className={selected === "all" ? "selected" : ""}
            onClick={() => setSelected("all")}
          >
            جميع المسارات <span>{arabicNumber(courses.length)}</span>
          </button>
          {tracks.map((item) => (
            <button
              key={item.id}
              aria-pressed={selected === item.id}
              className={selected === item.id ? "selected" : ""}
              onClick={() => setSelected(item.id)}
            >
              {item.shortTitle}
              <span>
                {arabicNumber(
                  courses.filter((c) => c.track === item.id).length,
                )}
              </span>
            </button>
          ))}
        </div>
      )}
      {!featured && (
        <div className="results-line" role="status" aria-live="polite">
          <span>
            {arabicNumber(matches.length)} دورة
            {query && <> تطابق بحثك عن «{query}»</>}
          </span>
          {(query || (!track && selected !== "all")) && (
            <button
              onClick={() => {
                setQuery("");
                setSelected(track ?? "all");
              }}
            >
              إعادة ضبط البحث
            </button>
          )}
        </div>
      )}
      {visible.length ? (
        <div
          className={`course-grid ${featured ? "featured-grid" : ""}`}
          id="course-results"
        >
          {visible.map((course) => (
            <CourseCard
              key={course.slug}
              course={course}
              headingLevel={featured ? "h3" : "h2"}
              variant={variant}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={44} weight="light" />
          <h3>لم نجد دورة بهذا الاسم</h3>
          <p>جرّب كلمة أقصر أو استعرض الدورات المتاحة في المسار.</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setQuery("");
              setSelected(track ?? "all");
            }}
          >
            إظهار الدورات <ArrowLeft size={18} />
          </button>
        </div>
      )}
      {featured && (
        <div className="catalog-footer">
          <Link
            href={selected === "all" ? "/courses/" : `/tracks/${selected}/`}
            className="text-link"
          >
            {selected === "all" ? "استعرض جميع الدورات" : "استعرض دورات المسار"}{" "}
            <ArrowLeft size={18} />
          </Link>
        </div>
      )}
    </div>
  );
}
