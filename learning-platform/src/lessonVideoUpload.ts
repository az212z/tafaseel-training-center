import { api, ApiRequestError } from "./api";

export async function uploadLessonVideo(
  file: File,
  courseId: string,
  progress: (percent: number) => void,
) {
  const start = await api<{ id: string; part_bytes: number }>(
    "file.video.begin",
    {
      course_id: courseId,
      name: file.name,
      bytes: file.size,
    },
  );
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + start.part_bytes, file.size);
    const form = new FormData();
    form.set("id", start.id);
    form.set("index", String(offset / start.part_bytes));
    form.set("file", file.slice(offset, end), "part");
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await api<{
          complete: boolean;
          id?: string;
          name?: string;
        }>("file.video.part", form);
        if (result.complete && result.id && result.name)
          return { id: result.id, name: result.name };
        break;
      } catch (error) {
        if (
          attempt >= 2 ||
          (error instanceof ApiRequestError && error.status < 500)
        )
          throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 700 * (attempt + 1)),
        );
      }
    }
    offset = end;
    progress(Math.floor((100 * offset) / file.size));
  }
  throw new Error("تعذّر تأكيد حفظ الفيديو. أعد المحاولة.");
}
