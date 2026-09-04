import { defineConfig } from "vite";
import path from "node:path";
export default defineConfig({
  root: path.resolve(import.meta.dirname),
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../../src"), "next/link": path.resolve(import.meta.dirname, "Link.tsx"), "next/navigation": path.resolve(import.meta.dirname, "navigation.tsx") } },
  server: { host: "127.0.0.1", port: 4175, strictPort: true },
});
