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

/** Max posts shipped to clients — doom scroll should feel endless, not a dozen. */
export const X_LORE_FEED_CAP = 200;

function mergePostsById(...lists: XLorePost[][]): XLorePost[] {
  const byId = new Map<string, XLorePost>();
  for (const list of lists) {
    for (const p of list) {
      if (!p?.id || !p.text?.trim()) continue;
      byId.set(p.id, p);
    }
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
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
  const posts = mergePostsById(base, loreSeedPosts(), ...(remote?.posts ?? [])).slice(0, X_LORE_FEED_CAP);
  return {
    version: 1,
    syncedAt: remote?.syncedAt ?? new Date(0).toISOString(),
    accounts: remote?.accounts?.length
      ? remote.accounts
      : [
          {
            handle: "DemplarOfficial",
            label: "Knights Demplar",
            url: "https://x.com/DemplarOfficial",
            site: "knightsdemplar.com",
          },
        ],
    posts,
    syncErrors: remote?.syncErrors,
  };
}

function seedFeed(): XLoreFeed {
  return buildFeed(null);
}

export async function loadXLoreFeed(): Promise<XLoreFeed> {
  if (cached) return cached;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const base = import.meta.env.BASE_URL || "/";
    try {
      const res = await fetch(`${base}lore/x-feed.json`, { cache: "no-cache" });
      if (res.ok) {
        const data = (await res.json()) as XLoreFeed;
        cached = buildFeed(data);
        return cached;
      }
    } catch {
      /* offline / first load */
    }
    cached = seedFeed();
    return cached;
  })();

  return loadPromise;
}

export function getXLoreFeed(): XLoreFeed | null {
  return cached;
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

export function xLoreLines(feed?: XLoreFeed | null): string[] {
  const f = feed ?? cached;
  if (!f?.posts.length) return [];
  return f.posts.map((p) => {
    const who = p.label || p.handle;
    const t = p.text.length > 140 ? `${p.text.slice(0, 138)}…` : p.text;
    return `@${p.handle.replace(/^@/, "")} · ${who}: ${t}`;
  });
}
