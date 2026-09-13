import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../out");
const port = Number(process.env.PORT || 3014);
const host = process.env.HOST || "127.0.0.1";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    const withinBase =
      !basePath ||
      url.pathname === basePath ||
      url.pathname.startsWith(`${basePath}/`);
    const pathname = withinBase
      ? url.pathname.slice(basePath.length) || "/"
      : "/__outside_base_path__";
    let path = resolve(root, `.${decodeURIComponent(pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    let status = 200;
    try {
      const info = await stat(path);
      if (info.isDirectory()) {
        if (!url.pathname.endsWith("/")) {
          response
            .writeHead(308, { Location: `${url.pathname}/${url.search}` })
            .end();
          return;
        }
        path = resolve(path, "index.html");
      }
      await stat(path);
    } catch {
      path = resolve(root, "404.html");
      status = 404;
    }
    const extension = extname(path);
    const compress =
      [".html", ".js", ".css", ".json", ".txt", ".xml", ".svg"].includes(
        extension,
      ) && /gzip/.test(request.headers["accept-encoding"] || "");
    response.writeHead(status, {
      "Content-Type": types[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": pathname.startsWith("/_next/static/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
      ...(compress
        ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" }
        : {}),
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    const stream = createReadStream(path);
    stream.on("error", () => response.destroy());
    if (compress) stream.pipe(createGzip()).pipe(response);
    else stream.pipe(response);
  } catch {
    response.writeHead(400).end();
  }
}).listen(port, host, () =>
  console.log(`Tafaseel preview: http://${host}:${port}${basePath}/`),
);
