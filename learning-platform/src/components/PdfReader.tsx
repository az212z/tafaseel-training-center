import { useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  AnnotationMode,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&url";
import { ar } from "../context";
import { Button } from "./ui";

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfReader({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [links, setLinks] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const task = getDocument({
      url,
      rangeChunkSize: 1048576,
      disableAutoFetch: true,
      disableStream: true,
      useWasm: false,
      enableXfa: false,
    });
    task.promise
      .then((pdf) => {
        if (active) setDoc(pdf);
      })
      .catch((reason: Error) => {
        console.warn("تعذّر فتح ملف التدريب", reason.message);
        if (active) setError(true);
      });
    return () => {
      active = false;
      void task.destroy().catch(() => {});
    };
  }, [url]);

  useEffect(() => {
    if (!doc) return;
    let active = true;
    let render: RenderTask | undefined;
    setReady(false);
    setLinks([]);
    doc
      .getPage(page)
      .then(async (pdfPage) => {
        const element = canvas.current;
        if (!active || !element) return;
        const original = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({
          scale: 1400 / Math.max(original.width, original.height),
        });
        element.width = Math.round(viewport.width);
        element.height = Math.round(viewport.height);
        render = pdfPage.render({
          canvas: element,
          viewport,
          annotationMode: AnnotationMode.DISABLE,
        });
        await render.promise;
        if (!active) return;
        setReady(true);
        const annotations = await pdfPage.getAnnotations();
        if (active)
          setLinks([
            ...new Set(
              annotations.flatMap((item) =>
                typeof item.url === "string" && /^https:\/\//i.test(item.url)
                  ? [item.url]
                  : [],
              ),
            ),
          ]);
      })
      .catch((reason: Error) => {
        if (active && reason.name !== "RenderingCancelledException")
          setError(true);
      });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [doc, page]);

  return (
    <>
      {doc && doc.numPages > 1 && (
        <nav className="pdf-controls" aria-label="صفحات الملف">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            السابقة
          </Button>
          <span aria-live="polite">
            {ar(page)} من {ar(doc.numPages)}
          </span>
          <Button
            variant="secondary"
            disabled={page >= doc.numPages}
            onClick={() => setPage(page + 1)}
          >
            التالية
          </Button>
        </nav>
      )}
      {error ? (
        <p className="alert" role="status">
          تعذّرت معاينة الملف. يمكنك تنزيله.
        </p>
      ) : (
        <>
          {!ready && (
            <p className="muted" role="status">
              جارٍ عرض الصفحة…
            </p>
          )}
          <canvas
            ref={canvas}
            hidden={!ready}
            role="img"
            aria-label={title + "، صفحة " + ar(page)}
          />
          {links.length > 0 && (
            <details className="pdf-links">
              <summary>روابط الصفحة</summary>
              {links.map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  dir="ltr"
                >
                  {link}
                </a>
              ))}
            </details>
          )}
        </>
      )}
    </>
  );
}
