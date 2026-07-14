/**
 * Shared social-asset shapes — titles, codex flex, trophies, table money.
 * No wallet: local vault + trail hall broadcast.
 */

export type HallPatronIdentity = {
  name: string;
  title?: string;
  catalogSize?: number;
  tokens?: number;
};

export type HallTrophy = {
  id: string;
  fish: string;
  rarity: "mythic" | "omen";
  from: string;
  ts: number;
  charterNight?: string;
};

export type HallStakeSnap = {
  from: string;
  kind: "chance" | "feast";
  label: string;
  stake: number;
  tokensLeft?: number;
  ts: number;
};

export function wornTitle(titles: string[]): string | undefined {
  if (!titles.length) return undefined;
  return titles[titles.length - 1];
}

export function isTrophyRarity(rarity: string | undefined): rarity is "mythic" | "omen" {
  return rarity === "mythic" || rarity === "omen";
}

export function formatPatronSeatLabel(p: HallPatronIdentity): string {
  const title = p.title?.trim();
  if (title) return `${p.name} · ${title}`;
  if (typeof p.catalogSize === "number" && p.catalogSize > 0) {
    return `${p.name} · ${p.catalogSize} codex`;
  }
  return p.name;
}

export function formatPatronCaption(patrons: HallPatronIdentity[]): string {
  if (!patrons.length) return "";
  return patrons
    .map((p) => {
      const bits = [p.name];
      if (p.title) bits.push(p.title);
      if (typeof p.catalogSize === "number" && p.catalogSize > 0) bits.push(`${p.catalogSize} codex`);
      if (typeof p.tokens === "number") bits.push(`◎${p.tokens}`);
      return bits.join(" · ");
    })
    .join("  ·  ");
}

export function makeTrophyId(from: string, fish: string, ts: number): string {
  return `${from}|${fish}|${ts}`;
}
