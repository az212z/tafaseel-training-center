import { api, ApiRequestError } from "./api";

type Upload = { id: string; part_bytes: number; next: number };

// Hash in bounded slices so reselecting a different file can never splice two videos together.
async function resumeKey(file: File, courseId: string, userId: string) {
  const block = 8 * 1024 * 1024;
  const hashes = new Uint8Array(Math.ceil(file.size / block) * 32);
  for (let offset = 0; offset < file.size; offset += block) {
    const data = await file.slice(offset, offset + block).arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", data);
    hashes.set(new Uint8Array(hash), (offset / block) * 32);
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", hashes));
  const fingerprint = Array.from(digest, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return [
    "lesson-upload",
    userId,
    courseId,
    file.size,
    file.name,
    fingerprint,
  ].join(":");
}

export async function uploadLessonVideo(
  file: File,
  courseId: string,
  userId: string,
  progress: (percent: number) => void,
) {
  const key = await resumeKey(file, courseId, userId);
  let upload: Upload | null = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    if (
      saved &&
      typeof saved.id === "string" &&
      Number.isSafeInteger(saved.part_bytes) &&
      saved.part_bytes > 0 &&
      Number.isSafeInteger(saved.next) &&
      saved.next >= 0 &&
      saved.next * saved.part_bytes < file.size
    )
      upload = saved;
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  function remember(value: Upload | null) {
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value));
      else sessionStorage.removeItem(key);
    } catch {
      /* The active upload still works without a saved checkpoint. */
    }
  }
  let resumed = Boolean(upload);
  for (;;) {
    if (!upload) {
      const start = await api<{ id: string; part_bytes: number }>(
        "file.video.begin",
        {
          course_id: courseId,
          name: file.name,
          bytes: file.size,
        },
      );
      upload = { ...start, next: 0 };
      remember(upload);
    }
    const offset = upload.next * upload.part_bytes;
    progress(Math.floor((100 * offset) / file.size));
    const form = new FormData();
    form.set("id", upload.id);
    form.set("index", String(upload.next));
    form.set("file", file.slice(offset, offset + upload.part_bytes), "part");
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await api<{
            complete: boolean;
            received?: number;
            id?: string;
            name?: string;
          }>("file.video.part", form);
          if (result.complete && result.id && result.name) {
            remember(null);
            progress(100);
            return { id: result.id, name: result.name };
          }
          if (
            !Number.isSafeInteger(result.received) ||
            result.received! <= upload.next ||
            result.received! * upload.part_bytes >= file.size
          ) {
            throw new Error("تعذّر تأكيد استلام جزء الفيديو.");
          }
          upload.next = result.received!;
          remember(upload);
          break;
        } catch (err) {
          if (
            attempt >= 3 ||
            (err instanceof ApiRequestError && err.status < 500)
          )
            throw err;
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 2 ** attempt),
          );
        }
      }
    } catch (err) {
      if (
        resumed &&
        err instanceof ApiRequestError &&
        [404, 410].includes(err.status)
      ) {
        remember(null);
        upload = null;
        resumed = false;
        continue;
      }
      throw err;
    }
  }
}
