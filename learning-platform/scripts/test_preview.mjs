import { build } from "vite";
await build({
  configFile: false,
  logLevel: "warn",
  build: {
    ssr: "tests/preview.ts",
    outDir: ".local/preview-tests",
    emptyOutDir: true,
  },
});
await import("../.local/preview-tests/preview.js");
