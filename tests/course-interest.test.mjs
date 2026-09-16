import assert from "node:assert/strict";
import { test } from "node:test";
import {
  courseInterestError,
  courseInterestLimit,
  courseInterestMessage,
} from "../src/lib/course-interest.ts";
import { whatsappUrl } from "../src/lib/contact.ts";

test("An interest request needs a meaningful answer within the field limit", () => {
  for (const invalid of ["", " \n ", "!", "🎨", "دورة ".repeat(101)]) {
    assert.ok(courseInterestError(invalid), JSON.stringify(invalid));
  }
  for (const valid of [
    "فن",
    "IELTS",
    "القدرات\nآيلتس",
    "أ".repeat(courseInterestLimit),
  ]) {
    assert.equal(courseInterestError(valid), null);
  }
});

test("Arabic course interests, line breaks, and special characters survive the WhatsApp handoff", () => {
  const answer =
    "  آيلتس IELTS & STEP\nالرسم + التصميم 100% 🎨\n<script>دورة</script>  ";
  const message = courseInterestMessage(answer);
  const url = new URL(whatsappUrl(message));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/966544552366");
  assert.equal(url.searchParams.get("text"), message);
  assert.deepEqual([...url.searchParams.keys()], ["text"]);
  assert.ok(message.includes(answer.trim()));
  assert.ok(message.endsWith("يرجى إخباري عبر واتساب عند توفرها."));
  assert.doesNotMatch(message, /أرجو تزويدي بمحتوى الدورة|تم تأكيد/);
});
