import { fishCatalog, omens, type FishRarity, type Season } from "../content/lore";
import type { CatchResult } from "../game/types";

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

const rarityOrder: FishRarity[] = ["common", "uncommon", "rare", "omen", "mythic"];

function tierFromSkill(castQuality: number, struckBite: boolean, reelQuality: number): number {
  const base = (castQuality * 0.35 + (struckBite ? 0.35 : 0) + reelQuality * 0.35) * 5;
  const noise = (Math.random() - 0.45) * 1.1;
  return Math.max(0, Math.min(4, Math.floor(base + noise)));
}

export function rollCatch(args: {
  castQuality: number;
  struckBite: boolean;
  reelQuality: number;
  season: Season;
}): CatchResult {
  const tierIdx = tierFromSkill(args.castQuality, args.struckBite, args.reelQuality);
  const pool = fishCatalog.filter((f) => {
    const ri = rarityOrder.indexOf(f.rarity);
    return ri <= tierIdx + 1 && ri >= Math.max(0, tierIdx - 1);
  });
  const fish = pool.length ? pool[Math.floor(Math.random() * pool.length)]! : fishCatalog[0]!;

  const renownBase: Record<FishRarity, number> = {
    common: 3,
    uncommon: 7,
    rare: 14,
    omen: 22,
    mythic: 35,
  };
  let renown = renownBase[fish.rarity] + Math.floor(args.reelQuality * 6);
  if (args.season === "void" && fish.rarity !== "common") renown += 3;

  const tokens = fish.rarity === "mythic" ? 3 : fish.rarity === "omen" ? 2 : 1;
  const omen = fish.rarity === "omen" || fish.rarity === "mythic" ? omens[Math.floor(Math.random() * omens.length)] : undefined;

  return {
    fishId: fish.id,
    name: fish.name,
    rarity: fish.rarity,
    renown,
    tokens,
    omen,
    demplarTease: !!fish.demplarHook || (fish.rarity === "rare" && Math.random() < 0.15),
  };
}
