/**
 * Moonwell Pole Rack — sticky gear. Play more → unlock wilder rods + crazier lore.
 */

export type PoleId =
  | "whistler_stick"
  | "dockhand_reed"
  | "coppercoil_switch"
  | "mourningglass"
  | "boneflute"
  | "astral_wormwood"
  | "demon_spinner"
  | "chronicle_lance"
  | "moonshatter";

export type PoleMods = {
  /** Soft floor on cast quality (0–1). */
  castFloor?: number;
  /** Extra bite-window ms. */
  biteBonusMs?: number;
  /** Widen green reel zone on each side (0–0.12). */
  greenZonePad?: number;
  /** Multiply catch renown. */
  renownMult?: number;
  /** Nudge rarity tier from skill roll. */
  rarityBias?: number;
  /** Extra omen/mythic luck weight. */
  omenLuck?: number;
  /** Multiply pole XP earned while equipped. */
  xpMult?: number;
};

export type FishingPole = {
  id: PoleId;
  name: string;
  tier: number;
  /** Sticky angler XP required to unlock. */
  xpUnlock: number;
  icon: string;
  tagline: string;
  /** Always-visible short verse. */
  lore: string;
  /** Revealed the night you unlock it. */
  unlockLore: string;
  accents: {
    shaft: string;
    tip: string;
    line: string;
    grip: string;
    glow?: string;
  };
  mods: PoleMods;
};

export const STARTER_POLE_ID: PoleId = "whistler_stick";

/** Sticky cast XP curve — more play = better poles. */
export const FISHING_POLES: FishingPole[] = [
  {
    id: "whistler_stick",
    name: "Whistler Stick",
    tier: 1,
    xpUnlock: 0,
    icon: "🎋",
    tagline: "Crooked willow that hums tavern chorus",
    lore: "Whittled by a dock rat who could only whistle in minor keys. The tip remembers every bad joke ever told over stew.",
    unlockLore: "You always owned this lie of a rod. It owned you first.",
    accents: { shaft: "#9a7848", tip: "#c8a060", line: "#d8d0b8", grip: "#5a3c28" },
    mods: {},
  },
  {
    id: "dockhand_reed",
    name: "Dockhand Reed",
    tier: 2,
    xpUnlock: 35,
    icon: "🪶",
    tagline: "Still sticky with fryer midnight",
    lore: "Braided from kitchen reed and a napkin no one claimed. When the line goes taut, you smell onion rings and unfinished apologies.",
    unlockLore:
      "The reed unfurled like a confession: it once yanked a cook into the mist who still clocks in ghost-shifts.",
    accents: { shaft: "#6a8a58", tip: "#c8d070", line: "#e8e0c0", grip: "#3a4828" },
    mods: { castFloor: 0.08, biteBonusMs: 60 },
  },
  {
    id: "coppercoil_switch",
    name: "Coppercoil Switch",
    tier: 3,
    xpUnlock: 90,
    icon: "⚡",
    tagline: "Lightning-kissed tip that argues with clouds",
    lore: "Salvaged from a broken streetlamp that only woke when someone lied about their catch size. Sparks leap toward honest tension.",
    unlockLore:
      "The coil whispered your real cast score behind your back, then winked like a neon sin.",
    accents: {
      shaft: "#8a7060",
      tip: "#e8c060",
      line: "#90d8f0",
      grip: "#403028",
      glow: "rgba(120, 200, 255, 0.35)",
    },
    mods: { castFloor: 0.1, biteBonusMs: 90, greenZonePad: 0.02, xpMult: 1.05 },
  },
  {
    id: "mourningglass",
    name: "Mourningglass Rod",
    tier: 4,
    xpUnlock: 170,
    icon: "🪞",
    tagline: "Hooks reflections of fish that refuse to exist",
    lore: "Shaft of smoked mirror. The bobber shows funerals that haven't happened yet. Catch the reflection and the flesh apologizes later.",
    unlockLore:
      "In the glass you saw yourself already legendary — ugly coat, prettier mythology. You kept casting anyway.",
    accents: {
      shaft: "#607080",
      tip: "#d0e8f0",
      line: "#a0c8d8",
      grip: "#283038",
      glow: "rgba(180, 220, 240, 0.4)",
    },
    mods: { castFloor: 0.12, rarityBias: 0.35, renownMult: 1.08, greenZonePad: 0.025 },
  },
  {
    id: "boneflute",
    name: "Boneflute Shaft",
    tier: 5,
    xpUnlock: 280,
    icon: "🦴",
    tagline: "Hollow choir that drowned mid-hymn",
    lore: "Seven finger-bones tuned to the Moonwell's cough. Blow into the grip and the water answers in harmonies that scare rare fish into volunteering.",
    unlockLore:
      "The flute played your name backwards. Every note unlocked a bigger hunger. The choir is still under there, clapping.",
    accents: {
      shaft: "#d8c8b0",
      tip: "#f0e8d8",
      line: "#e8d0a0",
      grip: "#706050",
      glow: "rgba(232, 210, 160, 0.35)",
    },
    mods: {
      biteBonusMs: 140,
      rarityBias: 0.45,
      omenLuck: 0.08,
      renownMult: 1.12,
      greenZonePad: 0.03,
      xpMult: 1.1,
    },
  },
  {
    id: "astral_wormwood",
    name: "Astral Wormwood",
    tier: 6,
    xpUnlock: 420,
    icon: "🌌",
    tagline: "Baited with constellations that forgot their names",
    lore: "Grown sideways through a roof hole on Charter Night Zero. The tip drips little stars that fish mistake for gossip.",
    unlockLore:
      "A constellation re-arranged itself into your cast meter. Sweet spot is wherever hubris lands.",
    accents: {
      shaft: "#405070",
      tip: "#c0a0e8",
      line: "#90a0ff",
      grip: "#201828",
      glow: "rgba(160, 120, 255, 0.45)",
    },
    mods: {
      castFloor: 0.15,
      biteBonusMs: 160,
      rarityBias: 0.55,
      omenLuck: 0.12,
      renownMult: 1.18,
      greenZonePad: 0.035,
      xpMult: 1.15,
    },
  },
  {
    id: "demon_spinner",
    name: "Demon's Spinner",
    tier: 7,
    xpUnlock: 620,
    icon: "😈",
    tagline: "The reel negotiates, insults, then pays out",
    lore: "A red-lacquered argument with a crank handle. It reels for you when you're honest and against you when you boast. Both feel like winning.",
    unlockLore:
      "The spinner introduced itself as Mid-Manager of the Abyss. Benefits include dental for the line and unpaid overtime for your soul.",
    accents: {
      shaft: "#802830",
      tip: "#e85040",
      line: "#ff9070",
      grip: "#301018",
      glow: "rgba(255, 80, 60, 0.4)",
    },
    mods: {
      castFloor: 0.16,
      biteBonusMs: 180,
      rarityBias: 0.65,
      omenLuck: 0.16,
      renownMult: 1.24,
      greenZonePad: 0.04,
      xpMult: 1.2,
    },
  },
  {
    id: "chronicle_lance",
    name: "Chronicle Lance",
    tier: 8,
    xpUnlock: 900,
    icon: "📜",
    tagline: "Pierces ledger hours until the archive bleeds ink",
    lore: "Forged from rolled Great Table minutes and a signature nobody admits was theirs. Every landing rewrites yesterday's charter in wet gold.",
    unlockLore:
      "The lance stabbed the vault and the vault thanked it. Your prior nights sit up straighter in the archive now.",
    accents: {
      shaft: "#c8a050",
      tip: "#f8e8a0",
      line: "#ffe8b0",
      grip: "#504028",
      glow: "rgba(232, 196, 80, 0.5)",
    },
    mods: {
      castFloor: 0.18,
      biteBonusMs: 200,
      rarityBias: 0.75,
      omenLuck: 0.2,
      renownMult: 1.32,
      greenZonePad: 0.045,
      xpMult: 1.25,
    },
  },
  {
    id: "moonshatter",
    name: "Moonshatter Spire",
    tier: 9,
    xpUnlock: 1300,
    icon: "☾",
    tagline: "Splits midnight so fish fall out laughing",
    lore: "The final blasphemy: a rod carved from a moon that bounced once off the well rim and never stopped cracking. Cast it and the tavern briefly remembers a better name for fear.",
    unlockLore:
      "When Moonshatter woke, every prior pole bowed. The mist recited your nickname like a court summons. You are no longer borrowing gear — you are the rumor.",
    accents: {
      shaft: "#d8e0f0",
      tip: "#ffffff",
      line: "#c0d8ff",
      grip: "#687898",
      glow: "rgba(200, 220, 255, 0.65)",
    },
    mods: {
      castFloor: 0.22,
      biteBonusMs: 260,
      rarityBias: 0.95,
      omenLuck: 0.28,
      renownMult: 1.45,
      greenZonePad: 0.055,
      xpMult: 1.35,
    },
  },
];

export function poleById(id: string | undefined | null): FishingPole {
  return FISHING_POLES.find((p) => p.id === id) ?? FISHING_POLES[0]!;
}

export function polesUnlockedByXp(xp: number): FishingPole[] {
  return FISHING_POLES.filter((p) => xp >= p.xpUnlock);
}

export function nextPoleUnlock(xp: number): FishingPole | null {
  return FISHING_POLES.find((p) => p.xpUnlock > xp) ?? null;
}

export function poleLevelFromXp(xp: number): number {
  let level = 1;
  for (const p of FISHING_POLES) {
    if (xp >= p.xpUnlock) level = p.tier;
  }
  return level;
}

export function isPoleId(id: string): id is PoleId {
  return FISHING_POLES.some((p) => p.id === id);
}
