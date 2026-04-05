export type MediaLayerKey = "banner" | "crest" | "sky" | "deck";

export type MediaPlatform = {
  id: string;
  name: string;
  path: string;
  layers: Partial<Record<MediaLayerKey, string>>;
};

export type MediaManifest = {
  version: number;
  generatedAt: string;
  hint?: string;
  platforms: MediaPlatform[];
};

export type LoadedMediaTheme = {
  platform: MediaPlatform;
  images: Partial<Record<MediaLayerKey, HTMLImageElement>>;
};
