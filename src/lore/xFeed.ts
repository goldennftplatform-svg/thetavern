import seedData from "../content/xFeedSeed.json";

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

function seedFeed(): XLoreFeed {
  return {
    version: 1,
    syncedAt: new Date(0).toISOString(),
    accounts: [
      {
        handle: "DemplarOfficial",
        label: "Knights Demplar",
        url: "https://x.com/DemplarOfficial",
        site: "knightsdemplar.com",
      },
    ],
    posts: seedData.posts as XLorePost[],
  };
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
        if (data.posts?.length) {
          cached = data;
          return data;
        }
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
