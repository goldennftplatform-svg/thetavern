const LS_KEY = "moonwell_trail_url";

export type TrailResolutionSource = "env" | "query" | "localStorage" | "trailJson";

export async function resolveTrailServerUrl(): Promise<{ url: string; source: TrailResolutionSource }> {
  const env = import.meta.env.VITE_TRAIL_SERVER_URL?.trim();
  if (env) return { url: env.replace(/\/$/, ""), source: "env" };

  const params = new URLSearchParams(window.location.search);
  const q = params.get("trail")?.trim();
  if (q) {
    try {
      const u = new URL(q);
      const normalized = `${u.protocol}//${u.host}`;
      localStorage.setItem(LS_KEY, normalized);
      return { url: normalized, source: "query" };
    } catch {
      /* fall through */
    }
  }

  const stored = localStorage.getItem(LS_KEY)?.trim();
  if (stored) return { url: stored.replace(/\/$/, ""), source: "localStorage" };

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}trail.json`, { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as { trailUrl?: string };
      const u = j.trailUrl?.trim();
      if (u) return { url: u.replace(/\/$/, ""), source: "trailJson" };
    }
  } catch {
    /* offline build */
  }

  return { url: "", source: "trailJson" };
}
