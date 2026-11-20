import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3117,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:8090", changeOrigin: false } },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 850 },
});
