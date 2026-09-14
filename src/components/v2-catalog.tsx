"use client";

import { useState } from "react";
import Link from "@/components/version-link";
import { programs, getProgramCourses, type ProgramId } from "@/lib/v2-courses";
import { programCourseCount } from "@/lib/v2-courses";
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

export function V2Catalog() {
  const [selected, setSelected] = useState<ProgramId | "all">("all");
  const [query, setQuery] = useState("");
  const groups = programs
    .filter((program) => selected === "all" || program.id === selected)
    .map((program) => ({
      program,
      courses: getProgramCourses(program.id).filter((course) =>
        normalize(
          [
            course.title,
            course.englishTitle,
            course.description,
            ...course.tags,
          ].join(" "),
        ).includes(normalize(query)),
      ),
    }))
    .filter((group) => group.courses.length);
  const count = groups.reduce(
    (total, group) => total + group.courses.length,
    0,
  );
  const reset = () => {
    setQuery("");
    setSelected("all");
  };

  return (
    <div className="catalog v2-grouped-catalog">
      <div className="v2-catalog-controls">
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
        <div className="v2-program-filter">
          <label htmlFor="program-filter">القسم التدريبي</label>
          <select
            id="program-filter"
            value={selected}
            onChange={(event) =>
              setSelected(event.target.value as ProgramId | "all")
            }
          >
            <option value="all">جميع الأقسام</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="results-line" role="status" aria-live="polite">
        <span>
          {count ? programCourseCount(count) : "لا توجد دورات مطابقة"}
          {query && <> تطابق بحثك عن «{query}»</>}
        </span>
        {(query || selected !== "all") && (
          <button onClick={reset}>إعادة ضبط البحث</button>
        )}
      </div>
      {groups.length ? (
        groups.map(({ program, courses }) => (
          <section
            className="v2-catalog-group"
            key={program.id}
            aria-labelledby={`program-${program.id}`}
            data-program={program.id}
          >
            <div className="v2-group-heading">
              <div>
                <p className="eyebrow">{programCourseCount(courses.length)}</p>
                <h2 id={`program-${program.id}`}>{program.title}</h2>
                <p>{program.description}</p>
              </div>
              <Link className="text-link" href={`/tracks/${program.id}/`}>
                عن البرنامج <ArrowLeft size={18} />
              </Link>
            </div>
            <div className="course-grid">
              {courses.map((course) => (
                <CourseCard key={course.slug} course={course} variant="v2" />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty-state">
          <BookOpen size={44} weight="light" />
          <h2>لم نجد دورة بهذا البحث</h2>
          <p>جرّب كلمة أخرى أو أعد اختيار القسم التدريبي.</p>
          <button className="button button-secondary" onClick={reset}>
            إظهار جميع الدورات <ArrowLeft size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
