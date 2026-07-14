/**
 * In-house login faces — pick at the gate or swap from the hub. No upload required.
 */

export type HouseAvatarId =
  | "hook"
  | "lantern"
  | "veil"
  | "tide"
  | "ember"
  | "moss"
  | "coin"
  | "bone"
  | "star"
  | "wolf"
  | "crow"
  | "moon";

export type HouseAvatar = {
  id: HouseAvatarId;
  label: string;
  glyph: string;
  ink: string;
  glow: string;
};

export const DEFAULT_AVATAR_ID: HouseAvatarId = "hook";

export const HOUSE_AVATARS: HouseAvatar[] = [
  { id: "hook", label: "Dock Hook", glyph: "🎣", ink: "#2a4860", glow: "#8cb8d8" },
  { id: "lantern", label: "Table Lantern", glyph: "🏮", ink: "#603820", glow: "#e8b050" },
  { id: "veil", label: "Mist Veil", glyph: "🌫️", ink: "#3a3858", glow: "#b8b0e0" },
  { id: "tide", label: "Low Tide", glyph: "🌊", ink: "#184858", glow: "#68c8c0" },
  { id: "ember", label: "Hearth Ember", glyph: "🔥", ink: "#682828", glow: "#e87850" },
  { id: "moss", label: "Pier Moss", glyph: "🌿", ink: "#284828", glow: "#88c878" },
  { id: "coin", label: "Tip Coin", glyph: "◎", ink: "#584820", glow: "#e8d070" },
  { id: "bone", label: "Kitchen Bone", glyph: "🦴", ink: "#504840", glow: "#d8c8b0" },
  { id: "star", label: "Roof Star", glyph: "✦", ink: "#283060", glow: "#a090e8" },
  { id: "wolf", label: "Yard Wolf", glyph: "🐺", ink: "#403848", glow: "#c8b0d0" },
  { id: "crow", label: "Ledger Crow", glyph: "🐦‍⬛", ink: "#282830", glow: "#9898a8" },
  { id: "moon", label: "Well Moon", glyph: "☾", ink: "#303848", glow: "#d0d8e8" },
];

export function isHouseAvatarId(id: string | undefined | null): id is HouseAvatarId {
  return HOUSE_AVATARS.some((a) => a.id === id);
}

export function houseAvatarById(id: string | undefined | null): HouseAvatar {
  return HOUSE_AVATARS.find((a) => a.id === id) ?? HOUSE_AVATARS[0]!;
}

export function avatarSrcFor(
  avatarId: string | undefined | null,
  customDataUrl?: string | null,
): { kind: "custom" | "house"; src?: string; face: HouseAvatar } {
  const face = houseAvatarById(avatarId);
  if (customDataUrl && customDataUrl.startsWith("data:image/")) {
    return { kind: "custom", src: customDataUrl, face };
  }
  return { kind: "house", face };
}
