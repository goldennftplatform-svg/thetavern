import { defineConfig } from "vite";
import { resolve } from "node:path";

/** GitHub Pages project sites live under /<repo>/ — set GITHUB_PAGES=true and GITHUB_PAGES_BASE in CI */
function appBase(): string {
  if (process.env.GITHUB_PAGES !== "true") return "/";
  const raw = process.env.GITHUB_PAGES_BASE || "/thetavern/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
}

export default defineConfig({
  base: appBase(),
  root: ".",
  publicDir: "public",
  server: {
    /** Avoid hijacking 5173 — many other Vite apps (e.g. social media) use the default. */
    port: 5174,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        bigboard: resolve(__dirname, "bigboard.html"),
      },
    },
  },
});
