import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMobile, applicantMessage } from "../src/lib/booking.ts";
import { whatsappUrl } from "../src/lib/contact.ts";

test("Saudi mobile input accepts local, international, and Arabic formats", () => {
  for (const input of [
    "0501234567",
    "٠٥٠١٢٣٤٥٦٧",
    "۰۵۰۱۲۳۴۵۶۷",
    "+966 50 123 4567",
    "00966501234567",
    "966501234567",
    "(050) 123-4567",
  ]) {
    assert.equal(normalizeMobile(input), "+966501234567", input);
  }
});

test("Incomplete or malformed mobile numbers cannot be used", () => {
  for (const input of [
    "",
    "   ",
    "05012",
    "05012345678",
    "+9660501234567",
    "05abcdefgh",
    "0111234567",
    "0501234567abc",
  ]) {
    assert.equal(normalizeMobile(input), null, input);
  }
});

test("All supplied applicant data survives WhatsApp URL encoding", () => {
  const message = applicantMessage(
    {
      name: "  متقدم   تجريبي  ",
      mobile: "٠٥٠١٢٣٤٥٦٧",
      city: "الرياض",
      course: "general-aptitude",
      note: "الاستفسار: صباحًا & مساءً؟\nهدفي: 90% + تطوير المهارة",
    },
    "اختبار القدرات العامة",
  );
  const url = new URL(whatsappUrl(message));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/966544552366");
  assert.equal(url.searchParams.get("text"), message);
  assert.match(message, /الاسم الكامل: متقدم تجريبي/);
  assert.match(message, /رقم الجوال: \u200e\+966501234567\u200e/);
  assert.match(message, /المدينة: الرياض/);
  assert.match(message, /الدورة المطلوبة: اختبار القدرات العامة/);
  assert.match(message, /90% \+ تطوير المهارة/);
  assert.deepEqual([...url.searchParams.keys()], ["text"]);
});

test("Optional fields are omitted and a course guidance request stays explicit", () => {
  const message = applicantMessage(
    {
      name: "متقدم تجريبي",
      mobile: "0501234567",
      city: "  ",
      course: "help-me-choose",
      note: "",
    },
    "المساعدة في اختيار الدورة المناسبة",
  );
  assert.doesNotMatch(message, /المدينة:|ملاحظات واستفسارات:/);
  assert.match(message, /الدورة المطلوبة: المساعدة في اختيار الدورة المناسبة/);
});
