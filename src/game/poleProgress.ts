/**
 * Sticky pole XP — earned by casting/landing, unlocks the rack, equips persist.
 */

import {
  FISHING_POLES,
  STARTER_POLE_ID,
  isPoleId,
  nextPoleUnlock,
  poleById,
  polesUnlockedByXp,
  type FishingPole,
  type PoleId,
} from "../content/fishingPoles";
import type { FishRarity } from "../content/lore";

export type PoleProgress = {
  poleXp: number;
  equippedPoleId: PoleId;
  unlockedPoleIds: PoleId[];
};

export type PoleXpAward = {
  gained: number;
  before: number;
  after: number;
  newlyUnlocked: FishingPole[];
};

const RARITY_XP: Record<FishRarity, number> = {
  common: 6,
  uncommon: 10,
  rare: 16,
  omen: 24,
  mythic: 36,
};

export function defaultPoleProgress(): PoleProgress {
  return {
    poleXp: 0,
    equippedPoleId: STARTER_POLE_ID,
    unlockedPoleIds: [STARTER_POLE_ID],
  };
}

export function normalizePoleProgress(raw: Partial<PoleProgress> | undefined | null): PoleProgress {
  const base = defaultPoleProgress();
  if (!raw) return base;
  const xp = Math.max(0, Math.floor(Number(raw.poleXp) || 0));
  const unlocked = new Set<PoleId>([STARTER_POLE_ID]);
  for (const id of raw.unlockedPoleIds ?? []) {
    if (isPoleId(id)) unlocked.add(id);
  }
  for (const p of polesUnlockedByXp(xp)) unlocked.add(p.id);
  const equipped =
    raw.equippedPoleId && isPoleId(raw.equippedPoleId) && unlocked.has(raw.equippedPoleId)
      ? raw.equippedPoleId
      : [...unlocked].sort((a, b) => poleById(b).tier - poleById(a).tier)[0]!;
  return {
    poleXp: xp,
    equippedPoleId: equipped,
    unlockedPoleIds: FISHING_POLES.filter((p) => unlocked.has(p.id)).map((p) => p.id),
  };
}

export function awardCastXp(progress: PoleProgress): PoleXpAward {
  return awardPoleXp(progress, 4);
}

export function awardCatchXp(progress: PoleProgress, rarity: FishRarity, reelQuality: number): PoleXpAward {
  const base = RARITY_XP[rarity] + Math.floor(reelQuality * 8);
  return awardPoleXp(progress, base);
}

export function awardPoleXp(progress: PoleProgress, baseGain: number): PoleXpAward {
  const pole = poleById(progress.equippedPoleId);
  const mult = pole.mods.xpMult ?? 1;
  const gained = Math.max(0, Math.floor(baseGain * mult));
  const before = progress.poleXp;
  const after = before + gained;
  const previously = new Set(progress.unlockedPoleIds);
  const unlocked = polesUnlockedByXp(after).map((p) => p.id);
  for (const id of previously) {
    if (!unlocked.includes(id)) unlocked.push(id);
  }
  const newlyUnlocked = FISHING_POLES.filter((p) => unlocked.includes(p.id) && !previously.has(p.id));
  progress.poleXp = after;
  progress.unlockedPoleIds = FISHING_POLES.filter((p) => unlocked.includes(p.id)).map((p) => p.id);
  return { gained, before, after, newlyUnlocked };
}

export function equipPole(progress: PoleProgress, id: PoleId): boolean {
  if (!progress.unlockedPoleIds.includes(id)) return false;
  progress.equippedPoleId = id;
  return true;
}

export function equippedPole(progress: PoleProgress): FishingPole {
  return poleById(progress.equippedPoleId);
}

export function poleRackBlurb(progress: PoleProgress): string {
  const next = nextPoleUnlock(progress.poleXp);
  const pole = equippedPole(progress);
  if (!next) return `${pole.icon} ${pole.name} · max rack · XP ${progress.poleXp}`;
  const need = next.xpUnlock - progress.poleXp;
  return `${pole.icon} ${pole.name} · XP ${progress.poleXp} · ${need} to unlock ${next.name}`;
}
