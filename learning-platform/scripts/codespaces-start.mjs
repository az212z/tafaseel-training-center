import { spawn, execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openSync, closeSync, existsSync, writeFileSync } from "node:fs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.CODESPACES !== "true")
  throw new Error(
    "This launcher is for GitHub Codespaces only. Use npm start locally.",
  );
const dir = resolve(root, ".local/github-trial");
execFileSync("php", ["server/codespaces-init.php", "init"], {
  cwd: root,
  stdio: "inherit",
});
if (!existsSync(resolve(root, "dist/index.html")))
  throw new Error("Run npm run build first.");
const endpoint = "http://127.0.0.1:8080/api/index.php?action=health";
let running = false;
try {
  running =
    (
      await (
        await fetch(endpoint, { signal: AbortSignal.timeout(1500) })
      ).json()
    ).version === "2.0.0";
} catch {}
if (!running) {
  const fd = openSync(resolve(dir, "web.log"), "a", 0o600);
  const child = spawn(
    "php",
    ["-S", "0.0.0.0:8080", "-t", "dist", "server/codespaces-router.php"],
    {
      cwd: root,
      env: {
        ...process.env,
        TAFASEEL_CONFIG: resolve(dir, "config.php"),
        PHP_CLI_SERVER_WORKERS: "2",
      },
      detached: true,
      stdio: ["ignore", fd, fd],
    },
  );
  closeSync(fd);
  child.unref();
  writeFileSync(resolve(dir, "web.pid"), String(child.pid), { mode: 0o600 });
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(endpoint, { signal: AbortSignal.timeout(1000) });
      if (r.ok && (await r.json()).version === "2.0.0") {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!ready)
    throw new Error(
      "Server did not start. Review .local/github-trial/web.log.",
    );
}
console.log("منصة تفاصيل تعمل على المنفذ الخاص 8080. افتحها من Ports.");
console.log(
  "بيانات الحسابات في الطرفية عند فتح مساحة العمل. لاستعراضها: npm run trial:accounts",
);
