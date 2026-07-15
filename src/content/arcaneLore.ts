/** Original arcane voice — boarding-hall energy, zero WotC/HP IP. */

import type { FishRarity } from "./lore";
import type { Season } from "./lore";
import { knightHallWhispers } from "./demplarKnights";

export const WORLD_EPIGRAPH =
  "The Rim Academy adjourns at dusk. The tavern does not. Here the Moonwell scries in ripples what lecture halls only whisper.";

export const SUBTITLE_TAGLINES = [
  "Where spellcraft meets strike timing.",
  "A rim tavern beneath borrowed stars.",
  "Patrons, travelers, and things that should not surface.",
];

export const seasonArcane: Record<Season, { name: string; verse: string; anglerNote: string }> = {
  frost: {
    name: "Frostveil Term",
    verse: "Breath ghosts the water; the deep answers slow, as if grading your patience.",
    anglerNote: "Steam crowns the well—fish rise wise and stingy. Wrap your fingers; do not wrap your ego.",
  },
  bloom: {
    name: "Bloomtide Revel",
    verse: "Pollen and prophecy—quick bites, quicker lies, skirts of green fire.",
    anglerNote: "Bright fry, brash omens. The hall smells of pollen and bad decisions.",
  },
  ember: {
    name: "Emberfall Vigil",
    verse: "Coals ring the well like runes; honesty rises from the dark.",
    anglerNote: "Coals mirror the rings. The deep grows honest—so should your boast.",
  },
  void: {
    name: "Starveil Convocation",
    verse: "Constellations drink the surface. Some blink back. Some bite.",
    anglerNote: "The surface holds constellations that blink back. Strike when a star winks.",
  },
};

export function pickLine(pool: readonly string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export const enterPrologues = [
  "Lanterns gutter. The Great Table has been cleared for the well.",
  "Somewhere a bell tower forgets to ring. The hall prefers moonlight.",
  "Ink dries on the Codex elsewhere. Here, water keeps the only true ledger.",
];

export const castWhispers = [
  "Channel the cast like a cantrip—hold to draw the sigil-gauge gold, release to send the hook through the veil.",
  "The well watches wrist and will. Fill the golden band, then let the line fly.",
  "A tutor once said: power without release is just posture. Hold, breathe, cast.",
  "The moonwell remembers every cast—moonlight rings on the water like graded gold leaf.",
  "Tonight the tide hums a lesson no professor would dare assign. Listen with your wrist.",
  "Your house mark stands at the rim. Cast as if the charter is watching.",
];

export const waitWhispers = [
  "The Moonwell opens its mouth one heartbeat at a time. When the rings tighten—strike!",
  "Patience is a spell with no incantation. Wait for the bite, then answer violence with violence.",
  "Something ancient nibbles below. Do not blink when the surface smiles.",
  "Mist keeps your secrets. The bobber does not—watch it like a liar's eye.",
  "Below the glass, rumor schools circle. They taste intentional silence.",
];

export const reelWhispers = [
  "The catch runs like a spell escaping its circle. Keep the peg in the jade band.",
  "Tension is the language of the deep. Too much line, it flees; too little, it snaps.",
  "The well tests your hands the way exams test memory—under pressure, without mercy.",
  "Hold the green. Green is honesty. Red is a story you tell the table afterward.",
  "Something with a charter-long memory is arguing with your rod. Argue better.",
];

/** Short toast banners — plain text, punchy. */
export const castBarks = [
  "HOLD the cast — release in the sweet marks",
  "Draw gold in the gauge — then loose the hook",
  "Wrist quiet, will loud — fill, then cast",
];

export const waitBarks = [
  "Watch the bobber — STRIKE when mist surges",
  "Patience first — violence on the ring",
  "When the surface smiles — answer it",
];

export const reelBarks = [
  "Slack · Heave — keep the peg in green",
  "Jade band holds destiny — don't snap it",
  "Fight fair in the green — flee the red",
];

/** Longer on-canvas lore ribbon (plain). */
export const castLoreLines = [
  "The rim grades casts the way tutors grade essays — by nerve and timing.",
  "Lanterns lean when a true cast leaves the wrist.",
  "Your house face watches the mist. So does whatever lives under it.",
];

export const waitLoreLines = [
  "Convocation below: small lies circle, big ones wait for the strike.",
  "The well prefers manners. Then it prefers hooks.",
  "Somewhere a bell tower sleeps. Down here, appetites do not.",
];

export const reelLoreLines = [
  "This is not a fish. It is a rumor with gills arguing the ledger.",
  "Keep green or the hall will write a funnier ending than you want.",
  "Charter steel sings when the line is honest. Listen.",
];

export const resolveFlourish: Record<FishRarity, string[]> = {
  common: ["The hall barely looks up. A honest catch—good for stew and small boasts.", "Recorded in chalk, not in song."],
  uncommon: ["A murmur passes the tables. Someone marks your name on the rim.", "Uncommon enough to buy a round of riddles."],
  rare: ["Candles lean toward you. The room remembers rare things.", "Starlight scales—silence, then applause."],
  omen: ["The well shivers. An omen is not a fish—it is a sentence about you.", "Prophecy wears gills tonight."],
  mythic: [
    "The charter bells do not ring—they <em>remember</em>. Mythic things refuse to stay in the water.",
    "Even the knights at the degen table stop pretending. This catch has a name worth fear.",
  ],
};

export const noticeBoardArcane = [
  "Headmaster's edict (ignored): no divination at the well after midnight.",
  "Lost: one familiar-shaped shadow. Answers to nothing. Reward: peanuts.",
  "Tonight's special: courage, served hot. Side of pretzel.",
  "The Moonwell deck favors evens. Doubled faces. No odd pips—house superstition.",
  "Neighbor lore on X — our lamps are at the Moonwell.",
  "Duels of wit: loser buys bait. Winner buys the story.",
];

export const hubVerse =
  "Three paths from the rim: cast the well, read the cards, sup at the enchanted board. All roads return here.";

export const hubLoreLines = [
  ...knightHallWhispers,
  "The Rim Academy adjourns at dusk; this tavern does not. Patrons wager in riddles—the true coin is the tale chalked at dawn.",
  "Knights, degens, and third-year fools share one table. Only the fish know your house.",
  "Somewhere a bell tower sleeps. The Moonwell keeps convocation by candle and mist.",
  "Even pips only at the divination table. No odd numbers in the deck—house superstition, house law.",
  "When shadow breathes at the rim, legends ignite at the bar — Demplar's Herald tolls elsewhere on X.",
];

export const chanceTableIntro =
  "The Divination Table — Moonwell deck only. Even pips, doubled faces, four Moonwell Aces. The mist favors ties.";

export const feastIntro =
  "The Enchanted Kitchen — one serving per delicacy per night. The next cast remembers what you ate.";

export function renownTitleHint(renown: number): string {
  if (renown >= 40) return "Your name is spoken in the upper gallery.";
  if (renown >= 20) return "Patrons ask if you study at the Rim or merely haunt it.";
  if (renown >= 8) return "Patrons swear Demplar's Herald would spell your name wrong anyway — the tavern gets it right.";
  return "The well is patient. Legends start as ripples.";
}
