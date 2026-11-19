import { useState, type FormEvent } from "react";
import { Button, Field, Panel } from "../components/ui";
import { asset } from "../environment";
import { useApp } from "../context";
import type { SiteTrainer } from "./types";

async function portrait(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 12 * 1024 * 1024
  )
    throw new Error("اختر صورة JPG أو PNG أو WebP بحجم يصل إلى ١٢ ميجابايت.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const side = Math.min(bitmap.width, bitmap.height);
    canvas.width = canvas.height = Math.min(side, 480);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذّر تجهيز الصورة.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    for (const quality of [0.87, 0.72, 0.56, 0.38, 0.22]) {
      const photo = canvas.toDataURL("image/jpeg", quality).split(",")[1];
      if (photo.length <= 58000) return photo;
    }
    throw new Error("اختر صورة أبسط أو أصغر.");
  } finally {
    bitmap.close();
  }
}
type Props = {
  profiles: SiteTrainer[];
  busy: boolean;
  save: (section: string, value: object, extra?: object) => Promise<void>;
};
export function TrainerEditor({ profiles, busy, save }: Props) {
  const { data, notify } = useApp();
  const [selected, select] = useState("");
  const [photo, setPhoto] = useState("");
  const [processing, setProcessing] = useState(false);
  const profile = profiles.find((t) => t.id === selected);
  function change(id: string) {
    select(id);
    setPhoto("");
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const element = e.currentTarget;
    const form = new FormData(element);
    try {
      await save(
        "trainer",
        {
          name: form.get("name"),
          specialty: form.get("specialty"),
          bio: form.get("bio"),
          account_id: form.get("account_id"),
          visible: form.get("visible") === "on",
          photo,
        },
        { id: selected },
      );
      change("");
      element.reset();
    } catch {
      /* save reports the error through the shared notification. */
    }
  }
  return (
    <Panel title="دليل المدربين">
      <div className="trainer-admin">
        <aside>
          <Button
            type="button"
            disabled={busy || processing}
            onClick={() => change("")}
          >
            إضافة مدرب
          </Button>
          {profiles.map((t) => (
            <button
              type="button"
              key={t.id}
              disabled={busy || processing}
              aria-pressed={selected === t.id}
              onClick={() => change(t.id)}
            >
              <strong>{t.name}</strong>
              <small>
                {t.visible ? "منشور" : "مسودة"}
                {t.example ? " · نموذج" : ""}
              </small>
            </button>
          ))}
        </aside>
        <form key={selected || "new"} onSubmit={submit}>
          <h3>{profile ? "تعديل بطاقة المدرب" : "بطاقة مدرب جديد"}</h3>
          <div className="form-grid">
            <Field label="اسم المدرب">
              <input
                name="name"
                defaultValue={profile?.name}
                required
                maxLength={100}
              />
            </Field>
            <Field label="التخصص">
              <input
                name="specialty"
                defaultValue={profile?.specialty}
                required
                maxLength={120}
              />
            </Field>
          </div>
          <Field label="نبذة عن المدرب">
            <textarea
              name="bio"
              rows={3}
              required
              maxLength={600}
              defaultValue={profile?.bio}
            />
          </Field>
          <Field label="حساب المعلم المرتبط (اختياري)">
            <select name="account_id" defaultValue={profile?.account_id || ""}>
              <option value="">بدون ربط بحساب</option>
              {data.instructors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="صورة المدرب">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={processing || busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setProcessing(true);
                try {
                  setPhoto(await portrait(f));
                } catch (err) {
                  notify((err as Error).message, "error");
                } finally {
                  setProcessing(false);
                }
              }}
            />
          </Field>
          {(photo || profile?.image) && (
            <img
              className="trainer-portrait-preview"
              alt="معاينة صورة المدرب"
              src={
                photo
                  ? "data:image/jpeg;base64," + photo
                  : asset(profile!.image)
              }
            />
          )}
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="visible"
              defaultChecked={profile?.visible ?? false}
            />
            نشر البطاقة على الموقع الرئيسي
          </label>
          <Button disabled={busy || processing}>
            {processing ? "جارٍ تجهيز الصورة…" : "حفظ البطاقة"}
          </Button>
        </form>
      </div>
    </Panel>
  );
}
