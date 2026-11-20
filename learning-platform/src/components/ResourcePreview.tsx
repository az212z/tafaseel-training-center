import { lazy, Suspense, useState } from "react";
import { DownloadSimple, Eye } from "@phosphor-icons/react";
import { fileUrl } from "../api";
import { isStaticPreview } from "../environment";
import type { FileRecord } from "../types";
import { Modal } from "./ui";
import { RemoteState, useRemote } from "./remote";

const PdfReader = lazy(() => import("./PdfReader"));
const imageTypes = ["image/jpeg", "image/png", "image/webp"];
type PreviewFile = Pick<FileRecord, "id" | "name" | "mime">;

export function canPreview(file: PreviewFile) {
  return ["application/pdf", "video/mp4", ...imageTypes].includes(file.mime);
}

export function FileActions({ id, file }: { id: string; file?: PreviewFile }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="table-actions">
      {(!file || canPreview(file)) && (
        <button
          type="button"
          className="text-link"
          onClick={() => setOpen(true)}
        >
          <Eye size={18} /> معاينة المرفق
        </button>
      )}
      <a href={fileUrl(id)} className="text-link" download>
        <DownloadSimple size={18} /> تنزيل
      </a>
      {open && (
        <Modal title="معاينة المرفق" wide onClose={() => setOpen(false)}>
          {file ? (
            <ResourcePreview file={file} />
          ) : (
            <RemoteFilePreview id={id} />
          )}
        </Modal>
      )}
    </div>
  );
}

function RemoteFilePreview({ id }: { id: string }) {
  const remote = useRemote<PreviewFile>("file.info", { id });
  return remote.result ? (
    <ResourcePreview file={remote.result} />
  ) : (
    <RemoteState {...remote} />
  );
}

export function ResourcePreview({ file }: { file: PreviewFile }) {
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
      {!canPreview(file) || failed ? (
        <p className="alert" role="status">
          تعذّرت معاينة الملف. يمكنك تنزيله.
        </p>
      ) : file.mime === "application/pdf" ? (
        <Suspense
          fallback={
            <p className="muted" role="status">
              جارٍ فتح الملف…
            </p>
          }
        >
          <PdfReader key={file.id} url={url} title={file.name} />
        </Suspense>
      ) : file.mime === "video/mp4" ? (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={file.name}
          onError={() => setFailed(true)}
        />
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
