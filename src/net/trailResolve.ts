const LS_KEY = "moonwell_trail_url";

export type TrailResolutionSource = "env" | "query" | "localStorage" | "trailJson";

/** True when the page is served from the public internet (GitHub Pages, Vercel, etc.). */
export function isPublicDeploy(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h !== "localhost" && h !== "127.0.0.1" && h !== "[::1]";
}

/** Local / LAN trail URLs must never be used from a public origin (avoids Chrome local-network prompts). */
export function isLocalTrailHost(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
    if (h.endsWith(".local")) return true;
    // RFC1918 private ranges — same “your network” concern in browsers
    if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

function normalizeTrailUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function acceptTrailUrl(url: string, source: TrailResolutionSource): { url: string; source: TrailResolutionSource } | null {
  const normalized = normalizeTrailUrl(url);
  if (!normalized) return null;
  if (isPublicDeploy() && isLocalTrailHost(normalized)) return null;
  return { url: normalized, source };
}

function purgeStoredLocalTrail(): void {
  try {
    const stored = localStorage.getItem(LS_KEY)?.trim();
    if (stored && isLocalTrailHost(stored)) localStorage.removeItem(LS_KEY);
  } catch {
    /* private mode */
  }
}

export async function resolveTrailServerUrl(): Promise<{ url: string; source: TrailResolutionSource }> {
  if (isPublicDeploy()) purgeStoredLocalTrail();

  const env = import.meta.env.VITE_TRAIL_SERVER_URL?.trim();
  if (env) {
    const ok = acceptTrailUrl(env, "env");
    if (ok) return ok;
  }

  const params = new URLSearchParams(window.location.search);
  const q = params.get("trail")?.trim();
  if (q) {
    try {
      const u = new URL(q);
      const normalized = `${u.protocol}//${u.host}`;
      const ok = acceptTrailUrl(normalized, "query");
      if (ok) {
        localStorage.setItem(LS_KEY, ok.url);
        return ok;
      }
    } catch {
      /* fall through */
    }
  }

  const stored = localStorage.getItem(LS_KEY)?.trim();
  if (stored) {
    const ok = acceptTrailUrl(stored, "localStorage");
    if (ok) return ok;
    purgeStoredLocalTrail();
  }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}trail.json`, { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as { trailUrl?: string };
      const u = j.trailUrl?.trim();
      if (u) {
        const ok = acceptTrailUrl(u, "trailJson");
        if (ok) return ok;
      }
    }
  } catch {
    /* offline build */
  }

  // Local dev only — never used on github.io / public hosts
  if (!isPublicDeploy()) {
    return { url: "http://127.0.0.1:3847", source: "trailJson" };
  }

  return { url: "", source: "trailJson" };
}
