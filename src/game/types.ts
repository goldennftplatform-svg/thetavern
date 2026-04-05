import type { FishRarity, Season } from "../content/lore";

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
  | "trivia";

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
};
