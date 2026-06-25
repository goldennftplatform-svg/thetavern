/**
 * Chronicle lines for hall deeds — the sexy lore the projector wall inscribes at dawn.
 * Deeds are live events broadcast from play → trail server → bigboard feed.
 */

import type { FishRarity } from "./lore";
import type { ChanceGameId, ChanceOutcome } from "../minigames/chance";
import type { MoonwellCard } from "../minigames/moonwellDeck";
import { pickLine } from "./arcaneLore";

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

const catchChronicles: Record<FishRarity, string[]> = {
  common: [
    "{angler} lands {fish} — chalk on the rim, stew in the kitchen, no song yet.",
    "A honest bite: {angler} pulls {fish} from the well. The Herald does not stand.",
    "{fish} breaks the surface for {angler}. Small boast, honest supper.",
  ],
  uncommon: [
    "A murmur at the tables — {angler} lands {fish}. Someone marks the rim.",
    "{angler} hooks {fish}; half-rhymes pass the degen knights like wine.",
    "Uncommon enough to buy a round: {angler} and the {fish} have an understanding.",
  ],
  rare: [
    "Candles lean — {angler} hauls {fish}. The room remembers rare things.",
    "{fish} rises for {angler} like pressed starlight. Silence, then applause.",
    "The well yields {fish} to {angler}. Conversations die mid-sentence.",
  ],
  omen: [
    "The well shivers — {angler} does not catch a fish but a sentence: {fish}.",
    "Prophecy wears gills: {angler} lands {fish}. The gallery is listening.",
    "{angler} and {fish} — an omen is not dinner; it is a mirror.",
  ],
  mythic: [
    "The charter bells REMEMBER — {angler} hauls {fish} from the veil.",
    "Even the knights stop pretending: {angler} lands mythic {fish}.",
    "{fish} refuses the water for {angler}. Demplar's lamps flicker in approval.",
  ],
};

const gambleWinHiLo: string[] = [
  "{angler} calls {guess} — {cards}. The hall cheers; the mist pays.",
  "Ascendant or descendant, {angler} reads the deck: {cards}. Fortune nods.",
  "The Divination Table yields to {angler}: {cards}, {guess} called true.",
];

const gambleLoseHiLo: string[] = [
  "{angler} calls {guess} on {cards}. The deck laughs; the mist keeps its counsel.",
  "The cards refuse {angler}: {cards}. Even pips have pride.",
  "{angler} misread the climb — {cards}. A tankard of humility, on the house.",
];

const gamblePushHiLo: string[] = [
  "{angler} meets a tie at {cards}. The mist returns the stake — no story, yet.",
  "Twin ranks at the chance table: {cards}. The well hates a draw but respects it.",
];

const gambleWinOU: string[] = [
  "{angler} beats mark {mark} with {card} — {guess} pays double in gossip.",
  "Mark {mark} falls to {angler}'s {card}. The house murmurs approval.",
];

const gambleLoseOU: string[] = [
  "{angler} misses mark {mark} — {card} lands wrong. The house keeps its hush.",
  "{card} vs mark {mark}: {angler} guessed {guess}. The mist is unimpressed.",
];

const gamblePushOU: string[] = [
  "{card} hits mark {mark} exactly — {angler} pushes. The Codex shrugs.",
];

const feastChronicles: string[] = [
  "{angler} sups on {food} — the kitchen blesses the next cast.",
  "{angler} eats {food}; the well will remember what was in the belly.",
  "Steam from the fen-kitchen: {angler} takes {food}. Buffs travel faster than rumors.",
  "{angler} at the enchanted board — {food}. The next strike carries that flavor.",
];

export function composeCatchDeed(
  angler: string,
  fish: string,
  rarity: FishRarity,
  renown: number,
  blurb: string,
  omen?: string,
): { chronicle: string; subtext: string } {
  const chronicle = fill(pickLine(catchChronicles[rarity]), { angler, fish, renown });
  const subtext = omen ? `Omen: ${omen}` : blurb;
  return { chronicle, subtext };
}

export function composeGambleDeed(
  angler: string,
  game: ChanceGameId,
  outcome: ChanceOutcome,
  cards: MoonwellCard[],
  guess: string,
  target?: number,
): { chronicle: string; subtext: string } {
  const cardStr =
    cards.length === 2 ? `${cards[0]!.label} → ${cards[1]!.label}` : cards[0]?.label ?? "?";
  const vars = { angler, guess, cards: cardStr, card: cards[0]?.label ?? "?", mark: target ?? 0 };

  let pool: string[];
  if (game === "high_low") {
    pool =
      outcome === "win" ? gambleWinHiLo : outcome === "push" ? gamblePushHiLo : gambleLoseHiLo;
  } else {
    pool =
      outcome === "win" ? gambleWinOU : outcome === "push" ? gamblePushOU : gambleLoseOU;
  }

  const chronicle = fill(pickLine(pool), vars);
  const gameName = game === "high_low" ? "Ascendant / Descendant" : "Mark of the Mist";
  const verdict =
    outcome === "win" ? "the hall inscribes a win" : outcome === "push" ? "push — stake returned" : "fortune turns away";
  const subtext = `${gameName}: ${cardStr}${target != null ? ` vs mark ${target}` : ""} — ${verdict}.`;
  return { chronicle, subtext };
}

export function composeFeastDeed(
  angler: string,
  food: string,
  blurb: string,
  buffLabel: string,
): { chronicle: string; subtext: string } {
  const chronicle = fill(pickLine(feastChronicles), { angler, food });
  return { chronicle, subtext: `${blurb} ${buffLabel}` };
}

/** Rotating feed heading lines for the projector wall */
export const chronicleHeadings = [
  "Chronicle of the Hall",
  "Deeds the Herald Will Misspell",
  "Tonight's Inscribed Tales",
  "The Well's Living Ledger",
];
