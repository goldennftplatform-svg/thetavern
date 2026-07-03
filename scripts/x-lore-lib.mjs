/**
 * Shared X/Twitter lore fetch — used by sync script, Vite dev API, and CI.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const seedPath = join(root, "src", "content", "xFeedSeed.json");

export const DEFAULT_HANDLES = ["DemplarOfficial"];

export const ACCOUNT_META = {
  DemplarOfficial: {
    label: "Knights Demplar",
    url: "https://x.com/DemplarOfficial",
    site: "knightsdemplar.com",
  },
};

export function accountMeta(handle) {
  const key = handle.replace(/^@/, "");
  return (
    ACCOUNT_META[key] ?? {
      label: key,
      url: `https://x.com/${key}`,
      site: "",
    }
  );
}

export function loadSeed() {
  if (!existsSync(seedPath)) return { posts: [] };
  return JSON.parse(readFileSync(seedPath, "utf8"));
}

function walk(obj, fn) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) walk(item, fn);
    return;
  }
  fn(obj);
  for (const v of Object.values(obj)) walk(v, fn);
}

function normalizeDate(raw) {
  if (typeof raw !== "string") return new Date().toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function extractPostsFromNextData(data, handle) {
  const posts = [];
  const seen = new Set();
  const meta = accountMeta(handle);

  walk(data, (node) => {
    if (!node || typeof node !== "object") return;
    const text =
      (typeof node.full_text === "string" && node.full_text) ||
      (typeof node.text === "string" && node.text) ||
      null;
    const id =
      node.id_str ??
      node.rest_id ??
      (node.legacy && node.legacy.id_str) ??
      (typeof node.id === "string" ? node.id : null);
    if (!text || !id || seen.has(id)) return;
    if (text.startsWith("RT @")) return;

    seen.add(id);
    const legacy = node.legacy ?? node.tweet ?? node;
    const created = legacy.created_at ?? node.created_at ?? new Date().toISOString();

    posts.push({
      id: String(id),
      handle,
      label: meta.label,
      text: text.replace(/\s+/g, " ").trim(),
      createdAt: normalizeDate(created),
      url: `https://x.com/${handle}/status/${id}`,
      metrics: {
        likes: legacy.favorite_count ?? legacy.like_count ?? undefined,
        retweets: legacy.retweet_count ?? undefined,
      },
    });
  });

  return posts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchTimeline(handle) {
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://platform.twitter.com/",
    Origin: "https://platform.twitter.com",
  };
  const cookie = process.env.X_SYNDICATION_COOKIE;
  if (cookie) headers.Cookie = cookie;

  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const wait = 2000 * 2 ** (attempt - 1);
      await sleep(wait);
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 22_000);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      const html = await res.text();
      if (res.status === 429) throw new Error("HTTP 429 rate limited");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) throw new Error("No __NEXT_DATA__ in syndication response");
      const data = JSON.parse(m[1]);
      const posts = extractPostsFromNextData(data, handle);
      if (posts.length === 0) throw new Error("Parsed zero posts");
      return posts;
    } catch (err) {
      lastErr = err;
      if (!String(err.message).includes("429") || attempt === 3) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

function mergePosts(live, seed, handle) {
  const byId = new Map();
  for (const p of seed.posts ?? []) {
    if (p.handle === handle || !p.handle) byId.set(p.id, { ...p, handle });
  }
  for (const p of live) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Pull live timelines and return a feed object (no file write). */
export async function buildLiveFeed(handles = DEFAULT_HANDLES) {
  const seed = loadSeed();
  const allPosts = [];
  const accounts = [];
  const errors = [];

  for (const handle of handles) {
    const meta = accountMeta(handle);
    accounts.push({ handle, label: meta.label, url: meta.url, site: meta.site });
    try {
      const live = await fetchTimeline(handle);
      const merged = mergePosts(live, seed, handle);
      allPosts.push(...merged);
    } catch (err) {
      const seeded = (seed.posts ?? []).filter((p) => p.handle === handle || handles.length === 1);
      allPosts.push(...seeded.map((p) => ({ ...p, handle: p.handle ?? handle })));
      errors.push(`${handle}: ${err.message}`);
    }
  }

  if (allPosts.length === 0 && seed.posts?.length) {
    allPosts.push(...seed.posts);
  }

  allPosts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return {
    version: 1,
    syncedAt: new Date().toISOString(),
    accounts,
    posts: allPosts.slice(0, 200),
    syncErrors: errors.length ? errors : undefined,
  };
}
