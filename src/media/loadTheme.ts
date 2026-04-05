import { pickDailyPlatformIndex, utcDayKey } from "./dailyPick";
import type { LoadedMediaTheme, MediaLayerKey, MediaManifest, MediaPlatform } from "./types";

const LAYER_KEYS: MediaLayerKey[] = ["banner", "crest", "sky", "deck"];

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function assetUrl(path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${p}`;
}

export async function loadDailyMediaTheme(): Promise<LoadedMediaTheme | null> {
  try {
    const res = await fetch(assetUrl("media/manifest.json"), { cache: "no-store" });
    if (!res.ok) return null;
    const manifest = (await res.json()) as MediaManifest;
    const list = manifest.platforms ?? [];
    if (list.length === 0) return null;

    const idx = pickDailyPlatformIndex(list.length, utcDayKey());
    const platform = list[idx]!;
    const images: Partial<Record<MediaLayerKey, HTMLImageElement>> = {};

    await Promise.all(
      LAYER_KEYS.map(async (key) => {
        const file = platform.layers[key];
        if (!file) return;
        const rel = platform.path.replace(/^\//, "");
        const url = assetUrl(`${rel}/${file}`);
        const img = await loadImage(url);
        if (img) images[key] = img;
      }),
    );

    return { platform, images };
  } catch {
    return null;
  }
}

export function platformLabel(p: MediaPlatform, dateKey: string): string {
  return `${p.name} · ${dateKey} UTC`;
}
