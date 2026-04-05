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
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        bigboard: resolve(__dirname, "bigboard.html"),
      },
    },
  },
});
