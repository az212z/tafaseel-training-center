import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, FormEvent, ReactNode } from "react";
import {
  X,
  Plus,
  ArrowLeft,
  MagnifyingGlass,
  BookOpen,
  CheckCircle,
  SpinnerGap,
  WarningCircle,
  UploadSimple,
} from "@phosphor-icons/react";
import { api } from "../api";
import { useApp } from "../context";
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function PageHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="head-actions">{children}</div>
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span />
      {children}
    </span>
  );
}
export function Status({ value }: { value: string }) {
  const map: Record<string, [string, string]> = {
    published: ["منشورة", "green"],
    draft: ["مسودة", "gray"],
    archived: ["مؤرشفة", "gray"],
    present: ["حاضر", "green"],
    absent: ["غائب", "red"],
    late: ["متأخر", "amber"],
    excused: ["بعذر", "blue"],
    open: ["مفتوح", "amber"],
    closed: ["تم الرد", "green"],
  };
  const v = map[value] ?? [value, "gray"];
  return <Badge tone={v[1]}>{v[0]}</Badge>;
}
export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const colors = ["mint", "blue", "rose", "sand"];
  const index =
    [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % colors.length;
  return (
    <span
      className={`avatar avatar-${size} ${colors[index]}`}
      aria-hidden="true"
    >
      {name
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")}
    </span>
  );
}
export function Empty({
  title = "لا توجد بيانات بعد",
  text = "ابدأ بإضافة أول عنصر وسيظهر هنا.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>
        <BookOpen size={30} weight="duotone" />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Search({
  value,
  onChange,
  placeholder = "ابحث هنا…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-input">
      <MagnifyingGlass size={19} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useRef(`dialog-${Math.random().toString(36).slice(2)}`).current;
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      d?.close();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-head">
        <div>
          <span className="tiny-label">منصة تفاصيل</span>
          <h2 id={id}>{title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
          <X size={21} />
        </button>
      </div>
      <div className="modal-content">{children}</div>
    </dialog>,
    document.body,
  );
}
export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Form({
  children,
  onSubmit,
  submitLabel = "حفظ البيانات",
  onCancel,
}: {
  children: ReactNode;
  onSubmit: (data: Record<string, FormDataEntryValue>) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ البيانات.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form">
      {children}
      {error && (
        <div className="alert alert-error" role="alert">
          <WarningCircle size={20} />
          {error}
        </div>
      )}
      <div className="form-actions">
        <Button type="submit" disabled={busy}>
          {busy ? (
            <SpinnerGap size={19} className="spin" />
          ) : (
            <CheckCircle size={19} />
          )}{" "}
          {busy ? "جارٍ الحفظ…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            إلغاء
          </Button>
        )}
      </div>
    </form>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick}>
      <Plus size={19} />
      {children}
    </Button>
  );
}
export function MoreLink({
  children = "عرض الكل",
  onClick,
}: {
  children?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowLeft size={16} />
    </button>
  );
}
export function FileUpload({
  purpose,
  courseId,
  studentId,
  onUploaded,
  accept = ".pdf,.jpg,.jpeg,.png,.webp,.mp4",
}: {
  purpose: string;
  courseId?: string;
  studentId?: string;
  onUploaded: (id: string, name: string) => void;
  accept?: string;
}) {
  const { notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  return (
    <label className={`upload-zone ${busy ? "busy" : ""}`}>
      <UploadSimple size={26} />
      <strong>
        {busy ? "جارٍ رفع الملف…" : name || "اختر ملفًا أو مقطع فيديو"}
      </strong>
      <small>PDF، صور، MP4 • حتى ٣٠ ميجابايت</small>
      <input
        aria-label="رفع ملف"
        type="file"
        accept={accept}
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 30 * 1024 * 1024) {
            notify("الحد الأقصى للملف ٣٠ ميجابايت.", "error");
            return;
          }
          const form = new FormData();
          form.set("file", file);
          form.set("purpose", purpose);
          if (courseId) form.set("course_id", courseId);
          if (studentId) form.set("student_id", studentId);
          setBusy(true);
          try {
            const r = await api<{ id: string; name: string }>(
              "file.upload",
              form,
            );
            setName(r.name);
            onUploaded(r.id, r.name);
            notify("تم رفع الملف وحفظه.");
          } catch (e) {
            notify((e as Error).message, "error");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </label>
  );
}
export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <div className="progress-group">
      <div className="progress-track">
        <span style={{ width: `${value}%` }} />
      </div>
      <span>{new Intl.NumberFormat("ar-SA").format(value)}٪</span>
    </div>
  );
}
