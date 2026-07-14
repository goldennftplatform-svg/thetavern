/**
 * Load ARDY motion clips from public/media/ardy (CUDA bake or lite bake).
 */

import type { ArdyClip, ArdyClipManifest } from "./ardyLite";

const cache = new Map<string, ArdyClip | null>();
let manifestPromise: Promise<ArdyClipManifest | null> | null = null;

function mediaUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\//, "")}`;
}

export async function loadArdyManifest(): Promise<ArdyClipManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetch(mediaUrl("media/ardy/manifest.json"))
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as ArdyClipManifest;
      })
      .catch(() => null);
  }
  return manifestPromise;
}

export async function loadArdyClip(id: string): Promise<ArdyClip | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  const man = await loadArdyManifest();
  const entry = man?.clips.find((c) => c.id === id);
  if (!entry) {
    cache.set(id, null);
    return null;
  }
  try {
    const r = await fetch(mediaUrl(`media/ardy/${entry.file}`));
    if (!r.ok) {
      cache.set(id, null);
      return null;
    }
    const clip = (await r.json()) as ArdyClip;
    cache.set(id, clip);
    return clip;
  } catch {
    cache.set(id, null);
    return null;
  }
}

export function fishingClipId(phase: string, biteOpen?: boolean): string {
  if (phase === "fish_cast") return "cast";
  if (phase === "fish_wait") return biteOpen ? "strike" : "wait";
  if (phase === "fish_reel") return "reel";
  return "idle";
}

/** Warm common fishing clips once at boot. */
export function preloadArdyFishingClips(): void {
  void Promise.all(["idle", "cast", "wait", "strike", "reel"].map((id) => loadArdyClip(id)));
}
