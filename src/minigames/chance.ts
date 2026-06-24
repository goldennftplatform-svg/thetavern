import type { MoonwellCard } from "./moonwellDeck";

export type ChanceGameId = "high_low" | "over_under";

export const CHANCE_GAMES: Array<{ id: ChanceGameId; name: string; blurb: string; stake: number }> = [
  {
    id: "high_low",
    name: "Ascendant / Descendant",
    blurb: "One card face up—call whether the next from the Moonwell deck climbs or falls.",
    stake: 1,
  },
  {
    id: "over_under",
    name: "Mark of the Mist",
    blurb: "The house sets an arcane mark; one draw decides if fortune runs hot or cold.",
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
  target?: number;
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
    title: "Ascendant / Descendant",
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

export function resolveOverUnder(
  stake: number,
  drawn: MoonwellCard,
  target: number,
  guess: "over" | "under",
): ChanceResult {
  let outcome: ChanceOutcome = "lose";
  if (drawn.rank === target) {
    outcome = "push";
  } else if (drawn.rank > target && guess === "over") {
    outcome = "win";
  } else if (drawn.rank < target && guess === "under") {
    outcome = "win";
  }

  const tokenDelta =
    outcome === "win" ? stake + 1 : outcome === "push" ? 0 : -stake;
  const renownDelta = outcome === "win" ? 2 : outcome === "lose" ? 0 : 1;

  return {
    game: "over_under",
    outcome,
    title: "Mark of the Mist",
    detail:
      outcome === "push"
        ? `${drawn.label} hits the mark (${target}) exactly — push.`
        : outcome === "win"
          ? `${drawn.label} vs mark ${target} — ${guess} pays.`
          : `${drawn.label} vs mark ${target} — the house murmurs.`,
    tokenDelta,
    renownDelta,
    cards: [drawn],
    target,
  };
}

/** House mark for over/under — even-friendly midpoint of deck ranks */
export function rollOverUnderTarget(): number {
  const marks = [6, 8, 10, 12];
  return marks[Math.floor(Math.random() * marks.length)]!;
}
