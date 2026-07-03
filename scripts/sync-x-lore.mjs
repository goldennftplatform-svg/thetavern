/**
 * Sync public X/Twitter timelines into public/lore/x-feed.json for in-game doom scroll.
 * Uses the embed syndication endpoint (no API key). Falls back to seed posts offline.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLiveFeed, DEFAULT_HANDLES } from "./x-lore-lib.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const outPath = join(root, "public", "lore", "x-feed.json");

function loadDotEnv() {
  for (const name of [".env.local", ".env"]) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadDotEnv();

async function main() {
  const handles = (process.env.X_LORE_HANDLES ?? DEFAULT_HANDLES.join(","))
    .split(",")
    .map((h) => h.trim().replace(/^@/, ""))
    .filter(Boolean);

  const feed = await buildLiveFeed(handles);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(feed, null, 2));
  console.log(`[x:sync] Wrote ${feed.posts.length} posts → public/lore/x-feed.json`);
  if (feed.syncErrors?.length) {
    for (const err of feed.syncErrors) console.warn(`[x:sync] ${err}`);
  }
}

main().catch((e) => {
  console.error("[x:sync] fatal:", e.message);
  process.exit(1);
});
