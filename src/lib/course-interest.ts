export const courseInterestLimit = 500;

export function courseInterestError(answer: string): string | null {
  const text = answer.trim();
  if (text.length < 2 || !/[\p{L}\p{N}]/u.test(text)) {
    return "اكتب اسم الدورة أو المجال الذي يهمك.";
  }
  if (answer.length > courseInterestLimit) {
    return "يمكنك كتابة رغبتك في ٥٠٠ حرف كحد أقصى.";
  }
  return null;
}

export function courseInterestMessage(answer: string): string {
  return [
    "مرحبًا مركز تفاصيل للتدريب،",
    "أرغب في الالتحاق بالدورات التالية:",
    "",
    answer.trim(),
    "",
    "يرجى إخباري عبر واتساب عند توفرها.",
  ].join("\n");
}
