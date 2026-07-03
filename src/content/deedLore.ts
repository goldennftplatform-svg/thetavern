/**
 * Chronicle lines for hall deeds — the sexy lore the projector wall inscribes at dawn.
 * Deeds are live events broadcast from play → trail server → bigboard feed.
 */

import type { FishRarity, Season } from "./lore";
import type { ChanceGameId, ChanceOutcome } from "../minigames/chance";
import type { MoonwellCard } from "../minigames/moonwellDeck";
import { cardColor } from "../minigames/moonwellDeck";
import { pickLine, seasonArcane } from "./arcaneLore";
import { demplarWarriorChronicles, demplarWarriorSubtexts } from "./demplarKnights";

export const RENOWN_MILESTONES = [8, 20, 40, 60] as const;
export type RenownMilestone = (typeof RENOWN_MILESTONES)[number];

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

const catchChronicles: Record<FishRarity, string[]> = {
  common: [
    "{angler} lands {fish} — chalk on the rim, stew in the kitchen, no song yet.",
    "A honest bite: {angler} pulls {fish} from the well. Demplar's Herald does not stand for tavern chalk.",
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
    "The tavern bells REMEMBER — {angler} hauls {fish} from the veil.",
    "Even the knights stop pretending: {angler} lands mythic {fish}.",
    "{fish} refuses the water for {angler}. Demplar's lamps flicker in approval.",
  ],
};

/** Season-tinted headlines — mixed with generic pools when present */
const seasonCatchChronicles: Record<Season, Partial<Record<FishRarity, string[]>>> = {
  frost: {
    common: [
      "{angler} lands {fish} through rim-steam — Frostveil Term grades patience, not ego.",
      "Breath ghosts the water; {angler} still pulls {fish}. Honest frost, honest bite.",
    ],
    rare: [
      "Steam crowns the well as {angler} hauls {fish} — the deep answered slow, then sure.",
    ],
    mythic: [
      "Frostveil hushes — {angler} drags {fish} from ice-memory. The hall exhales.",
    ],
  },
  bloom: {
    uncommon: [
      "Pollen and prophecy: {angler} lands {fish}. Bloomtide loves a brash wrist.",
    ],
    rare: [
      "{fish} rises bright for {angler} — skirts of green fire, skirts of gossip.",
    ],
    omen: [
      "Bloomtide omens arrive quick: {angler} and {fish}. Believe the first rhyme.",
    ],
  },
  ember: {
    common: [
      "Coals ring the well; {angler} lands {fish}. Emberfall favors honest boasts.",
    ],
    rare: [
      "{angler} hauls {fish} while coals mirror the rings — the deep grew honest tonight.",
    ],
    mythic: [
      "Emberfall Vigil breaks — {angler} claims {fish}. Honesty, then legend.",
    ],
  },
  void: {
    uncommon: [
      "Constellations drink the surface — {angler} still hooks {fish}. Starveil nods.",
    ],
    rare: [
      "{fish} blinks back at {angler} from starveil water. The chart was wrong; the catch wasn't.",
    ],
    mythic: [
      "A constellation absent from every chart — {angler} lands {fish}. Believe it anyway.",
    ],
  },
};

const comboCatchChronicles: string[] = [
  "{angler} lands {fish} — {food} still warm in the belly; the well rewards preparation.",
  "Kitchen blessing meets Moonwell luck: {angler} hauls {fish} after supping {food}.",
  "{food} in the gut, {fish} on the hook — {angler} cast truer than the professors promised.",
  "The enchanted board remembers {food}; the well answers with {fish} for {angler}.",
];

const demplarCatchChronicles: string[] = [
  "Neighbor lore hums — {angler} hauls {fish} from depths the Codex never charted.",
  "The cellar iron hums: {angler} lands {fish}. Their myth, our well.",
  "Overheard rumor walks the rim — {angler} and {fish}. Lamps on X flicker; our wall chalks it.",
  "They say Demplar bought the first net with a promise the well still collects — {angler} just cashed in {fish}.",
];

const gambleWinHiLo: string[] = [
  "{angler} calls {guess} — {cards}. The hall cheers; the mist pays.",
  "Hi-Lo favors {angler}: {cards}. Fortune nods.",
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

const gambleWinRB: string[] = [
  "{angler} calls {guess} — {card} flips true. The hall cheers.",
  "Red or black, {angler} reads the turn: {card} pays {guess}.",
];

const gambleLoseRB: string[] = [
  "{angler} calls {guess} — {card} disagrees. The house keeps its hush.",
  "{card} lands {color}; {angler} guessed {guess}. The mist is unimpressed.",
];

const feastChronicles: string[] = [
  "{angler} sups on {food} — the kitchen blesses the next cast.",
  "{angler} eats {food}; the well will remember what was in the belly.",
  "Steam from the fen-kitchen: {angler} takes {food}. Buffs travel faster than rumors.",
  "{angler} at the enchanted board — {food}. The next strike carries that flavor.",
];

const perilBold: string[] = [
  "{angler} chooses bold: \"{choice}\" — the hall inscribes courage in chalk and gossip.",
  "No tankard-hide for {angler}: \"{choice}\". The Rim Academy would flunk; the tavern applauds.",
  "{angler} walks into the beat — \"{choice}\". Renown loves fools with good timing.",
];

const perilCautious: string[] = [
  "{angler} keeps virtue dry: \"{choice}\" — wisdom, or cowardice dressed as patience.",
  "{angler} refuses the easy trouble — \"{choice}\". The well notes restraint.",
  "Caution at the rim: {angler} picks \"{choice}\". Sometimes survival is the tale.",
];

const triviaCorrect: string[] = [
  "{angler} answers true at the well — the Codex grudgingly agrees.",
  "Wit pays at the Moonwell: {angler} nails the riddle. The eels go quiet.",
  "{angler} reads the hall correctly. Professors elsewhere seethe.",
];

const triviaWrong: string[] = [
  "{angler} misses the mark — still earns a lesson and a smaller boast.",
  "Wrong answer, right company: {angler} at the trivia well. The mist is patient.",
  "{angler} stumbles on lore; the well forgives faster than the Academy.",
];

const renownMilestoneChronicles: Record<RenownMilestone, string[]> = {
  8: [
    "The tavern wall spells {angler}'s name right — ★{milestone} renown. (Their Herald would miss it.)",
    "Ripples become ripples heard: {angler} crosses ★{milestone}. Chalk becomes gossip.",
  ],
  20: [
    "Patrons ask if {angler} studies at the Rim or merely haunts it — ★{milestone} renown.",
    "★{milestone} renown: {angler}'s chair is no longer anonymous at the Great Table.",
  ],
  40: [
    "Your name is spoken in the upper gallery — {angler} at ★{milestone} renown.",
    "★{milestone}: the degen knights pretend not to stare at {angler}. They fail.",
  ],
  60: [
    "The Moonwell wall inscribes {angler} in gold leaf — ★{milestone} renown.",
    "★{milestone} renown: even neighbor lamps burn a little brighter for {angler}.",
  ],
};

function pickCatchPool(
  season: Season,
  rarity: FishRarity,
  combo: boolean,
  demplar: boolean,
): string[] {
  if (demplar) return demplarCatchChronicles;
  if (combo) return comboCatchChronicles;
  const seasonal = seasonCatchChronicles[season][rarity];
  if (seasonal && Math.random() < 0.62) return seasonal;
  return catchChronicles[rarity];
}

export function composeCatchDeed(
  angler: string,
  fish: string,
  rarity: FishRarity,
  renown: number,
  blurb: string,
  season: Season,
  opts?: {
    omen?: string;
    foodName?: string;
    demplarHook?: boolean;
    demplarTease?: boolean;
  },
): { chronicle: string; subtext: string } {
  const combo = !!opts?.foodName;
  const demplar = !!(opts?.demplarHook || (opts?.demplarTease && rarity !== "common"));
  const pool = pickCatchPool(season, rarity, combo, demplar);
  const vars: Record<string, string | number> = { angler, fish, renown, food: opts?.foodName ?? "" };
  const chronicle = fill(pickLine(pool), vars);

  const seasonNote = seasonArcane[season].anglerNote;
  const parts: string[] = [`${seasonArcane[season].name} — ${seasonNote}`];
  if (opts?.omen) parts.push(`Omen: ${opts.omen}`);
  else parts.push(blurb);
  if (combo && opts?.foodName) parts.push(`Feast combo: ${opts.foodName} fueled this landing.`);

  return { chronicle, subtext: parts.join(" ") };
}

export function composeGambleDeed(
  angler: string,
  game: ChanceGameId,
  outcome: ChanceOutcome,
  cards: MoonwellCard[],
  guess: string,
): { chronicle: string; subtext: string } {
  const cardStr =
    cards.length === 2 ? `${cards[0]!.label} → ${cards[1]!.label}` : cards[0]?.label ?? "?";
  const color = cards[0] ? cardColor(cards[0]) : "red";
  const vars = { angler, guess, cards: cardStr, card: cards[0]?.label ?? "?", color };

  let pool: string[];
  if (game === "high_low") {
    pool =
      outcome === "win" ? gambleWinHiLo : outcome === "push" ? gamblePushHiLo : gambleLoseHiLo;
  } else {
    pool = outcome === "win" ? gambleWinRB : gambleLoseRB;
  }

  const chronicle = fill(pickLine(pool), vars);
  const gameName = game === "high_low" ? "Hi-Lo" : "Red / Black";
  const verdict =
    outcome === "win" ? "the hall inscribes a win" : outcome === "push" ? "push — stake returned" : "fortune turns away";
  const subtext = `${gameName}: ${cardStr} — ${verdict}.`;
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

export function composePerilDeed(
  angler: string,
  question: string,
  choice: string,
  bold: boolean,
): { chronicle: string; subtext: string } {
  const pool = bold ? perilBold : perilCautious;
  const chronicle = fill(pickLine(pool), { angler, choice });
  const shortQ = question.length > 72 ? `${question.slice(0, 70)}…` : question;
  return { chronicle, subtext: `Between-cast beat: ${shortQ}` };
}

export function composeTriviaDeed(
  angler: string,
  question: string,
  correct: boolean,
  teach?: string,
): { chronicle: string; subtext: string } {
  const pool = correct ? triviaCorrect : triviaWrong;
  const chronicle = fill(pickLine(pool), { angler });
  const shortQ = question.length > 72 ? `${question.slice(0, 70)}…` : question;
  const subtext = teach && correct ? `${shortQ} — ${teach}` : shortQ;
  return { chronicle, subtext };
}

export function composeRenownDeed(
  angler: string,
  milestone: RenownMilestone,
  season: Season,
): { chronicle: string; subtext: string } {
  const chronicle = fill(pickLine(renownMilestoneChronicles[milestone]), {
    angler,
    milestone,
  });
  return {
    chronicle,
    subtext: `${seasonArcane[season].name} — a milestone the tavern wall won't misspell twice.`,
  };
}

export function crossedRenownMilestones(before: number, after: number): RenownMilestone[] {
  return RENOWN_MILESTONES.filter((m) => before < m && after >= m);
}

export function composeDemplarDeed(
  angler: string,
  platform: number,
  race: number,
  asteroids: number,
  total: number,
): { chronicle: string; subtext: string } {
  const chronicle = fill(pickLine(demplarWarriorChronicles), { angler, score: total });
  const subtext = fill(pickLine(demplarWarriorSubtexts), {
    angler,
    platform,
    race,
    asteroids,
    score: total,
  });
  return { chronicle, subtext };
}

/** Rotating feed heading lines for the projector wall */
export const chronicleHeadings = [
  "Chronicle of the Hall",
  "Tavern Wall — Not the Herald's Codex",
  "Tonight's Chalked Tales",
  "The Well's Living Ledger",
];
