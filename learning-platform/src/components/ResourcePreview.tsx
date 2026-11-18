import { lazy, Suspense, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { fileUrl } from "../api";
import { isStaticPreview } from "../environment";
import type { FileRecord } from "../types";

const PdfReader = lazy(() => import("./PdfReader"));
const imageTypes = ["image/jpeg", "image/png", "image/webp"];

export function canPreview(file: FileRecord) {
  return (
    file.purpose === "resource" &&
    (file.mime === "application/pdf" || imageTypes.includes(file.mime))
  );
}

export function ResourcePreview({ file }: { file: FileRecord }) {
  const [failed, setFailed] = useState(false);
  const url = fileUrl(file.id);
  return (
    <section className="file-preview" aria-label="معاينة الملف">
      <div className="file-preview-head">
        <strong>{file.name}</strong>
        <a className="btn btn-secondary" href={url} download>
          <DownloadSimple size={18} /> تنزيل الملف
        </a>
      </div>
      {file.mime === "application/pdf" ? (
        <Suspense
          fallback={
            <p className="muted" role="status">
              جارٍ فتح الملف…
            </p>
          }
        >
          <PdfReader key={file.id} url={url} title={file.name} />
        </Suspense>
      ) : failed ? (
        <p className="alert" role="status">
          تعذّرت معاينة الصورة. يمكنك تنزيلها.
        </p>
      ) : (
        <img
          src={isStaticPreview ? url : url + "&preview=1"}
          alt={file.name}
          onError={() => setFailed(true)}
        />
      )}
    </section>
  );
}
