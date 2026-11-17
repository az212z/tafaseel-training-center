import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
if (!existsSync("server/config.php")) {
  const init = spawn("php", ["server/console.php", "demo"], {
    stdio: "inherit",
  });
  await new Promise((resolve) =>
    init.on("exit", (code) => {
      if (code) process.exit(code);
      resolve();
    }),
  );
}
const api = spawn(
  "php",
  ["-S", "127.0.0.1:8090", "-t", "public", "server/router.php"],
  { stdio: "inherit" },
);
const ui = spawn("npm", ["run", "dev"], { stdio: "inherit" });
function stop() {
  api.kill("SIGTERM");
  ui.kill("SIGTERM");
}
process.on("SIGINT", () => {
  stop();
  process.exit();
});
process.on("SIGTERM", () => {
  stop();
  process.exit();
});
api.on("exit", (c) => {
  ui.kill();
  process.exit(c ?? 0);
});
ui.on("exit", (c) => {
  api.kill();
  process.exit(c ?? 0);
});
