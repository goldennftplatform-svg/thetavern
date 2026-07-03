import seedData from "../content/xFeedSeed.json";
import {
  bigboardFeedHints,
  bigboardMoodLines,
  bigboardSpotlightKickers,
  demplarEpigraphs,
  knightGateLines,
  knightHallWhispers,
  knightNoticeBoard,
  warriorBriefLines,
  warriorCompleteLines,
} from "../content/demplarKnights";
import { enterPrologues, hubLoreLines, SUBTITLE_TAGLINES } from "../content/arcaneLore";

export type XLorePost = {
  id: string;
  handle: string;
  label: string;
  text: string;
  createdAt: string;
  url: string;
  metrics?: { likes?: number; retweets?: number };
};

export type XLoreAccount = {
  handle: string;
  label: string;
  url: string;
  site?: string;
};

export type XLoreFeed = {
  version: number;
  syncedAt: string;
  accounts: XLoreAccount[];
  posts: XLorePost[];
  syncErrors?: string[];
};

let cached: XLoreFeed | null = null;
let loadPromise: Promise<XLoreFeed> | null = null;
let refreshPromise: Promise<XLoreFeed> | null = null;
let lastFetchAt = 0;
let refreshTimer = 0;
const listeners = new Set<(feed: XLoreFeed) => void>();

const FETCH_TIMEOUT_MS = 8_000;

/** How often the client re-fetches while the tavern is open. */
export const X_LORE_REFRESH_MS = 15 * 60_000;

/** Max posts shipped to clients — doom scroll should feel endless, not a dozen. */
export const X_LORE_FEED_CAP = 200;

const LIVE_API = "/api/lore/x-feed/live";

function mergePostsById(...lists: unknown[]): XLorePost[] {
  const byId = new Map<string, XLorePost>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      if (!p?.id || !p.text?.trim()) continue;
      byId.set(p.id, p as XLorePost);
    }
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function normalizeRemoteFeed(raw: XLoreFeed | null): XLoreFeed | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    posts: Array.isArray(raw.posts) ? raw.posts : [],
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
  };
}

function stripMarkup(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/^⚔\s*/, "").trim();
}

/** Offline charter missives — never ship only 12 posts when the relay hiccups. */
function loreSeedPosts(): XLorePost[] {
  const pools = [
    ...demplarEpigraphs,
    ...knightHallWhispers,
    ...knightGateLines,
    ...warriorBriefLines,
    ...warriorCompleteLines,
    ...knightNoticeBoard,
    ...hubLoreLines,
    ...enterPrologues,
    ...SUBTITLE_TAGLINES,
    ...Object.values(bigboardMoodLines),
    ...bigboardSpotlightKickers,
    ...Object.values(bigboardFeedHints),
  ];

  const seen = new Set<string>();
  const out: XLorePost[] = [];
  let day = 0;
  for (const raw of pools) {
    const text = stripMarkup(raw);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({
      id: `seed-lore-${out.length}`,
      handle: "DemplarOfficial",
      label: "Knights Demplar",
      text,
      createdAt: new Date(Date.UTC(2026, 4, 28 - day, 15, 0, 0)).toISOString(),
      url: "https://x.com/DemplarOfficial",
    });
    day += 1;
  }
  return out;
}

function buildFeed(remote: XLoreFeed | null): XLoreFeed {
  const base = seedData.posts as XLorePost[];
  const remoteNorm = normalizeRemoteFeed(remote);
  const posts = mergePostsById(base, loreSeedPosts(), remoteNorm?.posts ?? []).slice(
    0,
    X_LORE_FEED_CAP,
  );
  return {
    version: 1,
    syncedAt: remoteNorm?.syncedAt ?? new Date(0).toISOString(),
    accounts: remoteNorm?.accounts?.length
      ? remoteNorm.accounts
      : [
          {
            handle: "DemplarOfficial",
            label: "Knights Demplar",
            url: "https://x.com/DemplarOfficial",
            site: "knightsdemplar.com",
          },
        ],
    posts,
    syncErrors: remoteNorm?.syncErrors,
  };
}

function notifyUpdate(feed: XLoreFeed) {
  for (const fn of listeners) fn(feed);
}

export function onXLoreFeedUpdate(fn: (feed: XLoreFeed) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function fetchJsonWithTimeout(url: string): Promise<XLoreFeed | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as XLoreFeed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRemoteFeed(): Promise<XLoreFeed | null> {
  const base = import.meta.env.BASE_URL || "/";
  const bust = Date.now();
  const urls: string[] = [`${base}lore/x-feed.json?t=${bust}`];
  if (import.meta.env.DEV) urls.push(`${LIVE_API}?t=${bust}`);

  for (const url of urls) {
    const feed = await fetchJsonWithTimeout(url);
    if (feed) return feed;
  }
  return null;
}

export async function refreshXLoreFeed(force = false): Promise<XLoreFeed> {
  const now = Date.now();
  if (!force && cached && now - lastFetchAt < 45_000) return cached;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const remote = await fetchRemoteFeed();
      cached = buildFeed(remote);
    } catch {
      cached = cached ?? seedFeed();
    }
    lastFetchAt = Date.now();
    notifyUpdate(cached);
    return cached;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export function startXLoreFeedAutoRefresh(): void {
  if (refreshTimer) return;
  refreshTimer = window.setInterval(() => {
    void refreshXLoreFeed(true);
  }, X_LORE_REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshXLoreFeed(true);
  });
}

function seedFeed(): XLoreFeed {
  return buildFeed(null);
}

export async function loadXLoreFeed(): Promise<XLoreFeed> {
  if (cached) return cached;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const remote = await fetchRemoteFeed();
    cached = buildFeed(remote);
    lastFetchAt = Date.now();
    startXLoreFeedAutoRefresh();
    return cached;
  })();

  return loadPromise.catch(() => {
    cached = seedFeed();
    startXLoreFeedAutoRefresh();
    return cached;
  });
}

export function getXLoreFeed(): XLoreFeed | null {
  return cached;
}

/** True when the post came from X syndication (snowflake id), not charter seed. */
export function isRealXPost(p: XLorePost): boolean {
  return /^\d{10,}$/.test(p.id);
}

/** Neighbor lore doom scroll — real @DemplarOfficial tweets only, newest first. */
export function heraldScrollPosts(feed: XLoreFeed): XLorePost[] {
  return feed.posts
    .filter(isRealXPost)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, X_LORE_FEED_CAP);
}

export function heraldScrollMeta(feed: XLoreFeed, posts: XLorePost[]): string {
  const synced = xFeedSyncedLabel(feed);
  if (!posts.length) return `${synced} · no live syndication — showing charter fallback on X link below`;
  const newest = formatXPostAge(posts[0]!.createdAt);
  return `${synced} · <strong>${posts.length}</strong> live posts · newest on X <strong>${newest}</strong> ago`;
}

/** Cached relay, or charter seed — never blocks on network. */
export function ensureXLoreFeed(): XLoreFeed {
  try {
    return cached ?? seedFeed();
  } catch {
    return seedFeed();
  }
}

export function pickXPost(feed?: XLoreFeed | null): XLorePost | null {
  const f = feed ?? cached;
  if (!f?.posts.length) return null;
  return f.posts[Math.floor(Math.random() * f.posts.length)]!;
}

export function pickXPostText(feed?: XLoreFeed | null): string | null {
  const p = pickXPost(feed);
  return p ? p.text : null;
}

export function formatXPostAge(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return "now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function xFeedSyncedLabel(feed?: XLoreFeed | null): string {
  const f = feed ?? cached;
  if (!f?.syncedAt) return "offline relay";
  const ms = Date.parse(f.syncedAt);
  if (Number.isNaN(ms)) return "offline relay";
  const age = formatXPostAge(f.syncedAt);
  return age === "now" || age.endsWith("m") ? `live · ${age}` : `synced ${age} ago`;
}

export function xLoreLines(feed?: XLoreFeed | null): string[] {
  const f = feed ?? cached;
  if (!f?.posts.length) return [];
  return f.posts.map((p) => {
    const who = p.label || p.handle;
    const t = p.text.length > 140 ? `${p.text.slice(0, 138)}…` : p.text;
    return `@${p.handle.replace(/^@/, "")} · ${who}: ${t}`;
  });
}
