import type { FishRarity, Season } from "../content/lore";
import type { FoodId } from "../content/tavernNights";
import type { PoleId } from "../content/fishingPoles";
import type { FishingPole } from "../content/fishingPoles";
import type { ChanceGameId, ChanceResult } from "../minigames/chance";
import type { MoonwellCard } from "../minigames/moonwellDeck";

export type GamePhase =
  | "enter"
  | "herald"
  | "well"
  | "fish_cast"
  | "fish_wait"
  | "fish_reel"
  | "resolve"
  | "renown"
  | "peril"
  | "trivia"
  | "chance_pick"
  | "chance_play"
  | "chance_result"
  | "feast"
  | "pole_rack"
  | "demplar_warrior"
  | "demplar_result";

export type FoodBuff = {
  foodId: FoodId;
  label: string;
  biteBonusMs?: number;
  renownBonus?: number;
  tokenBonus?: number;
  castFloor?: number;
};

export type CatchResult = {
  fishId: string;
  name: string;
  rarity: FishRarity;
  renown: number;
  tokens: number;
  omen?: string;
  demplarTease?: boolean;
};

export type GameState = {
  phase: GamePhase;
  season: Season;
  runCount: number;
  renown: number;
  tokens: number;
  titles: string[];
  catalog: Set<string>;
  lastCatch?: CatchResult;
  nickname: string;
  /** Minigame scratch */
  castPower: number;
  biteWindowOpen: boolean;
  reelProgress: number;
  reelTension: number;
  perilIndex: number;
  triviaIndex: number;
  /** Moonwell deck + tavern games */
  deck: MoonwellCard[];
  chanceGame?: ChanceGameId;
  chanceCards: MoonwellCard[];
  chanceLastResult?: ChanceResult;
  foodBuff?: FoodBuff;
  feastsEaten: FoodId[];
  demplarBest?: number;
  /** Sticky pole rack — survives charter night. */
  poleXp: number;
  equippedPoleId: PoleId;
  unlockedPoleIds: PoleId[];
  /** Transient unlock reveal after a cast/catch. */
  pendingPoleUnlocks?: FishingPole[];
  lastPoleXpGain?: number;
};
