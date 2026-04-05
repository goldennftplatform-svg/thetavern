/** Lore pack: Moonwell, seasons, fish, omens, Demplar tie-ins (original fantasy; no Wizards IP). */

export const GAME_TITLE = "The Moonwell Anglers";

export const tavernTeasers = [
  "The well remembers every cast—moonlight rings on the water like old coins.",
  "Patrons wager in riddles; the true currency is the tale the well gives back.",
  "Tonight the tide hums. Something generous stirs below.",
];

export const heraldLines = [
  "The Herald tolls three: a catch, an omen, a name worth repeating.",
  "Hark—renown is not gold here; it is the story they will tell tomorrow.",
  "They say the oldest hook in the cellar bears a mark: Demplar—patron, myth, or both?",
];

export const SEASONS = ["frost", "bloom", "ember", "void"] as const;
export type Season = (typeof SEASONS)[number];

export const seasonFlavor: Record<Season, string> = {
  frost: "Frostveil: the well steams; fish rise slow and wise.",
  bloom: "Bloomtide: bright fry and brash omens—quick bites, quicker lies.",
  ember: "Emberfall: coals reflect in the rings; the deep grows honest.",
  void: "Starveil: the surface mirrors constellations; some stars blink back.",
};

export type FishRarity = "common" | "uncommon" | "rare" | "omen" | "mythic";

export const fishCatalog: Array<{
  id: string;
  name: string;
  rarity: FishRarity;
  blurb: string;
  demplarHook?: boolean;
}> = [
  {
    id: "silver_darter",
    name: "Silver Darter",
    rarity: "common",
    blurb: "A honest bite—good for stew and small boasts.",
  },
  {
    id: "riddle_eel",
    name: "Riddle-Eel",
    rarity: "uncommon",
    blurb: "It arrives in questions; leave with half an answer.",
  },
  {
    id: "moonscale_koi",
    name: "Moonscale Koi",
    rarity: "rare",
    blurb: "Scales like pressed starlight. The room goes quiet when it surfaces.",
  },
  {
    id: "omen_perch",
    name: "Omen Perch",
    rarity: "omen",
    blurb: "Its eye reflects not you, but the road you mean to take.",
  },
  {
    id: "demplar_glassfish",
    name: "Glassfish of the Charter",
    rarity: "mythic",
    blurb:
      "Nearly clear—only the hook-shadow reads true. Old timers whisper Demplar paid for the first net.",
    demplarHook: true,
  },
];

export const omens = [
  "Three ripples, then none: change of luck.",
  "A bubble ring opens like an eye: someone is listening.",
  "The water turns briefly ink-black: travel by night favors you.",
  "A silver leaf touches the surface: a debt will be forgiven.",
];

export const perilBeats = [
  { q: "A stranger offers bait that smells of thunder. Take it?", a: ["Nod—risk for glory", "Decline—keep your luck"] },
  { q: "The well whispers a route through the fen. Follow?", a: ["Wade in", "Circle the hall first"] },
];

export const triviaWell = [
  { q: "What does renown buy at the Moonwell?", choices: ["A louder tale", "A second cast", "Silence from the eels"], ok: 0 },
  { q: "When the well mirrors stars, what rises first?", choices: ["The humble hook", "The boast", "The moon"], ok: 0 },
];

export const demplarNotice =
  "Charter notice: Demplar backs the hall’s nets, lamps, and the Herald’s ink. Ask the barkeep for the optional charter scroll—no purse required.";

export const demplarModalIntro =
  "Demplar is named on the oldest iron in the cellar—sponsor, benefactor, or tale that caught a tale. If you would know the living house behind the name, the Herald commends their word on X.";

export const creditsLine =
  "Moonwell Anglers — a tavern ritual for LARPers & tale-spinners. Charter ally: Demplar.";
