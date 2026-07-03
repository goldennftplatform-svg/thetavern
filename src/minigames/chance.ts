import type { MoonwellCard } from "./moonwellDeck";
import { cardColor } from "./moonwellDeck";

export type ChanceGameId = "high_low" | "red_black";

export const CHANCE_GAMES: Array<{ id: ChanceGameId; name: string; blurb: string; stake: number }> = [
  {
    id: "high_low",
    name: "Hi-Lo",
    blurb: "One card face up — call whether the next draw ranks higher or lower.",
    stake: 1,
  },
  {
    id: "red_black",
    name: "Red / Black",
    blurb: "One draw — call red or black before the card turns.",
    stake: 1,
  },
];

export type ChanceOutcome = "win" | "lose" | "push";

export type ChanceResult = {
  game: ChanceGameId;
  outcome: ChanceOutcome;
  title: string;
  detail: string;
  tokenDelta: number;
  renownDelta: number;
  cards: MoonwellCard[];
};

export function resolveHighLow(
  stake: number,
  first: MoonwellCard,
  second: MoonwellCard,
  guess: "high" | "low",
): ChanceResult {
  let outcome: ChanceOutcome = "lose";
  if (second.rank === first.rank) {
    outcome = "push";
  } else if (second.rank > first.rank && guess === "high") {
    outcome = "win";
  } else if (second.rank < first.rank && guess === "low") {
    outcome = "win";
  }

  const tokenDelta =
    outcome === "win" ? stake * 2 : outcome === "push" ? 0 : -stake;
  const renownDelta = outcome === "win" ? 1 : 0;

  return {
    game: "high_low",
    outcome,
    title: "Hi-Lo",
    detail:
      outcome === "push"
        ? `${first.label} then ${second.label} — push. The mist keeps your stake.`
        : outcome === "win"
          ? `${first.label} → ${second.label}. You called ${guess} — the hall cheers.`
          : `${first.label} → ${second.label}. The deck laughs at "${guess}".`,
    tokenDelta,
    renownDelta,
    cards: [first, second],
  };
}

export function resolveRedBlack(
  stake: number,
  drawn: MoonwellCard,
  guess: "red" | "black",
): ChanceResult {
  const actual = cardColor(drawn);
  const outcome: ChanceOutcome = guess === actual ? "win" : "lose";
  const tokenDelta = outcome === "win" ? stake + 1 : -stake;
  const renownDelta = outcome === "win" ? 2 : 0;

  return {
    game: "red_black",
    outcome,
    title: "Red / Black",
    detail:
      outcome === "win"
        ? `${drawn.label} is ${actual} — you called ${guess}.`
        : `${drawn.label} is ${actual} — not ${guess}.`,
    tokenDelta,
    renownDelta,
    cards: [drawn],
  };
}
