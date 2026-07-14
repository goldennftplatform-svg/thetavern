import { SEASONS } from "../content/lore";
import { DEFAULT_AVATAR_ID } from "../content/houseAvatars";
import { buildMoonwellDeck, shuffleDeck } from "../minigames/moonwellDeck";
import { defaultPoleProgress } from "./poleProgress";
import type { GameState } from "./types";

export function initialState(nickname: string): GameState {
  const season = SEASONS[Math.floor(Math.random() * SEASONS.length)]!;
  const poles = defaultPoleProgress();
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
    deck: shuffleDeck(buildMoonwellDeck()),
    chanceCards: [],
    feastsEaten: [],
    poleXp: poles.poleXp,
    equippedPoleId: poles.equippedPoleId,
    unlockedPoleIds: [...poles.unlockedPoleIds],
    avatarId: DEFAULT_AVATAR_ID,
  };
}
