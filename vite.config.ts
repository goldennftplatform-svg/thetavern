import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

/** GitHub Pages project sites live under /<repo>/ — set GITHUB_PAGES=true and GITHUB_PAGES_BASE in CI */
function appBase(): string {
  if (process.env.GITHUB_PAGES !== "true") return "/";
  const raw = process.env.GITHUB_PAGES_BASE || "/thetavern/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
}

/** Dev-only: warn when trail server is not running (bigboard + live deeds need :3847). */
function trailHealthPlugin(): Plugin {
  return {
    name: "trail-health-check",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        void fetch("http://127.0.0.1:3847/health", { signal: AbortSignal.timeout(2000) })
          .then((r) => (r.ok ? undefined : Promise.reject()))
          .catch(() => {
            console.warn(
              "\n[thetavern] Trail server is not on :3847 — live hall + bigboard sync need:\n" +
                "  npm run live     (server + Vite)\n" +
                "  npm run dashboard (same, prints bigboard URL)\n",
            );
          });
      });
    },
  };
}

/** Dev-only live X relay — pulls syndication server-side (no stale static JSON while iterating). */
function xLiveFeedPlugin(): Plugin {
  return {
    name: "x-live-feed",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/lore/x-feed/live")) {
          next();
          return;
        }
        try {
          const { buildLiveFeed } = await import("./scripts/x-lore-lib.mjs");
          const feed = await buildLiveFeed();
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(feed));
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  base: appBase(),
  root: ".",
  publicDir: "public",
  plugins: [trailHealthPlugin(), xLiveFeedPlugin()],
  server: {
    /** Avoid hijacking 5173 — many other Vite apps (e.g. social media) use the default. */
    port: 5174,
    strictPort: true,
    host: true,
    proxy: {
      "/socket.io": { target: "http://127.0.0.1:3847", ws: true, changeOrigin: true },
      "/health": { target: "http://127.0.0.1:3847", changeOrigin: true },
    },
  },
  preview: {
    port: 4174,
    strictPort: true,
    proxy: {
      "/socket.io": { target: "http://127.0.0.1:3847", ws: true, changeOrigin: true },
      "/health": { target: "http://127.0.0.1:3847", changeOrigin: true },
    },
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
