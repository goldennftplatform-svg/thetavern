import { SEASONS } from "../content/lore";
import type { GameState } from "./types";

export function initialState(nickname: string): GameState {
  const season = SEASONS[Math.floor(Math.random() * SEASONS.length)]!;
  return {
    phase: "enter",
    season,
    runCount: 0,
    renown: 0,
    tokens: 2,
    titles: [],
    catalog: new Set(),
    nickname,
    castPower: 0,
    biteWindowOpen: false,
    reelProgress: 0,
    reelTension: 0.35,
    perilIndex: 0,
    triviaIndex: 0,
  };
}
