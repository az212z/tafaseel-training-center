import { createContext, useContext } from "react";
import type { Data, User } from "./types";
export interface AppContext {
  data: Data;
  user: User;
  refresh: () => Promise<void>;
  notify: (message: string, type?: "success" | "error") => void;
  logout: () => Promise<void>;
}
export const Context = createContext<AppContext | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing app context");
  return value;
}
export const ar = (n: number) => new Intl.NumberFormat("ar-SA").format(n);
export const date = (
  s: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    timeZone: "Asia/Riyadh",
    ...options,
  }).format(new Date(s));
export const time = (s: string) =>
  date(s, { hour: "numeric", minute: "2-digit" });
export const roles = {
  admin: "مدير المنصة",
  instructor: "مدرب",
  student: "طالب",
  guardian: "ولي أمر",
};
export function progressPercent(
  data: Data,
  courseId: string,
  studentId?: string,
) {
  const ls = data.lessons.filter((l) => l.course_id === courseId);
  if (!ls.length) return 0;
  const students = studentId
    ? [studentId]
    : data.enrollments
        .filter((e) => e.course_id === courseId)
        .map((e) => e.student_id);
  if (!students.length) return 0;
  return Math.round(
    (100 *
      data.progress.filter(
        (p) =>
          ls.some((l) => l.id === p.lesson_id) &&
          students.includes(p.student_id),
      ).length) /
      (ls.length * students.length),
  );
}
export function downloadCsv(
  name: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const quote = (x: unknown) =>
    '"' +
    String(x ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const content =
    "\ufeff" +
    [headers, ...rows].map((r) => r.map(quote).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Rate uses recorded sessions only; excused absence is excluded, late counts as attended.
export function attendancePercent(records: { status: string }[]) {
  const eligible = records.filter((r) => r.status !== "excused");
  return eligible.length
    ? Math.round(
        (100 *
          eligible.filter((r) => ["present", "late"].includes(r.status))
            .length) /
          eligible.length,
      )
    : 0;
}
