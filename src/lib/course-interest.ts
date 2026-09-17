export type InterestCourse = { slug: string; title: string };
export type InterestGroup = {
  id: string;
  title: string;
  courses: InterestCourse[];
};

export function courseInterestError(
  selected: string[],
  courses: InterestCourse[],
): string | null {
  if (selected.length === 0) {
    return "اختر دورة واحدة على الأقل للمتابعة.";
  }
  if (
    selected.some((slug) => !courses.some((course) => course.slug === slug))
  ) {
    return "يرجى اختيار الدورات من القائمة المتاحة.";
  }
  return null;
}

export function courseInterestMessage(
  selected: string[],
  courses: InterestCourse[],
): string {
  return [
    "مرحبًا مركز تفاصيل للتدريب،",
    "أرغب في الالتحاق بالدورات التالية:",
    "",
    ...courses
      .filter((course) => selected.includes(course.slug))
      .map((course) => `• ${course.title}`),
    "",
    "يرجى الاتصال بي عند اكتمال العدد اللازم لبدء الدورة.",
  ].join("\n");
}
