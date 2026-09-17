import assert from "node:assert/strict";
import { test } from "node:test";
import {
  courseInterestError,
  courseInterestMessage,
} from "../src/lib/course-interest.ts";
import { whatsappUrl } from "../src/lib/contact.ts";

const courses = [
  { slug: "aptitude", title: "القدرات العامة" },
  { slug: "ielts", title: "الاستعداد لاختبار آيلتس IELTS" },
  { slug: "drawing", title: "الرسم والفن التشكيلي & التصميم" },
];

test("A callback request requires at least one known course", () => {
  assert.ok(courseInterestError([], courses));
  assert.ok(courseInterestError(["unknown"], courses));
  assert.ok(courseInterestError(["ielts", "unknown"], courses));
  assert.equal(courseInterestError(["ielts"], courses), null);
  assert.equal(
    courseInterestError(
      courses.map((course) => course.slug),
      courses,
    ),
    null,
  );
});

test("Only selected courses appear once, in catalog order, with the callback request", () => {
  const message = courseInterestMessage(
    ["drawing", "ielts", "drawing"],
    courses,
  );
  assert.equal(
    message,
    [
      "مرحبًا مركز تفاصيل للتدريب،",
      "أرغب في الالتحاق بالدورات التالية:",
      "",
      "• الاستعداد لاختبار آيلتس IELTS",
      "• الرسم والفن التشكيلي & التصميم",
      "",
      "يرجى الاتصال بي عند اكتمال العدد اللازم لبدء الدورة.",
    ].join("\n"),
  );
  assert.doesNotMatch(
    message,
    /القدرات العامة|أرجو تزويدي بمحتوى الدورة|تم تأكيد/,
  );
});

test("Selected Arabic courses and the callback request survive the WhatsApp handoff", () => {
  const message = courseInterestMessage(["ielts", "drawing"], courses);
  const url = new URL(whatsappUrl(message));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/966544552366");
  assert.equal(url.searchParams.get("text"), message);
  assert.deepEqual([...url.searchParams.keys()], ["text"]);
});
