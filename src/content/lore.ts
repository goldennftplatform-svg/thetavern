/** Lore pack — Moonwell charter hall, Demplar adjacency, original arcane fantasy. */

export const GAME_TITLE = "The Moonwell Anglers";

export const tavernTeasers = [
  "The well remembers every cast—moonlight rings on the water like graded gold leaf.",
  "Patrons wager in riddles; the true currency is the tale the hall inscribes at dawn.",
  "Tonight the tide hums a lesson no professor would dare assign.",
  "Shadow breathes at the rim; time fractures, but the strike window stays honest.",
  "Knights, degens, and third-year fools share one table—only the fish know your house.",
  "Somewhere a bell tower sleeps. The Moonwell does not.",
];

export const heraldLines = [
  "The Herald tolls thrice: a catch, an omen, a name the Codex will misspell anyway.",
  "Hark—renown is not coin here; it is the volume at which they tell your story tomorrow.",
  "The oldest hook in the cellar bears a mark: Demplar—patron, myth, or both?",
  "Where shadow breathes, the Moonwell answers—legends ignite when the deck runs hot.",
  "The Rim Academy adjourns; the tavern holds convocation by candle and mist.",
  "Even pips only at the divination table—no odd numbers in the Moonwell deck.",
  "A wand is optional at the rim. A steady wrist is not.",
];

export const SEASONS = ["frost", "bloom", "ember", "void"] as const;
export type Season = (typeof SEASONS)[number];

export const seasonFlavor: Record<Season, string> = {
  frost: "Frostveil Term — steam crowns the well; fish rise slow and wise.",
  bloom: "Bloomtide Revel — bright fry, brash omens, skirts of pollen light.",
  ember: "Emberfall Vigil — coals mirror the rings; the deep grows honest.",
  void: "Starveil Convocation — the surface holds constellations that blink back.",
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
    name: "Glimmer Minnow",
    rarity: "common",
    blurb: "A honest bite—good for stew, small boasts, and passing the night without prophecy.",
  },
  {
    id: "riddle_eel",
    name: "Lex-Eel",
    rarity: "uncommon",
    blurb: "It arrives in half-rhymes; you leave with half an answer and a full tankard of doubt.",
  },
  {
    id: "moonscale_koi",
    name: "Astral Carp",
    rarity: "rare",
    blurb: "Scales like pressed starlight. Candles lean. Conversations die mid-sentence.",
  },
  {
    id: "omen_perch",
    name: "Prophet Perch",
    rarity: "omen",
    blurb: "Its eye reflects not your face, but the choice you pretend you have not made.",
  },
  {
    id: "demplar_glassfish",
    name: "Charter Wraithfish",
    rarity: "mythic",
    blurb:
      "Nearly clear—only the hook-shadow reads true. They say Demplar bought the first net with a promise the well still collects.",
    demplarHook: true,
  },
];

export const omens = [
  "Three ripples, then none: fortune turns like a page.",
  "A bubble ring opens like an eye: someone in the gallery is listening.",
  "The water turns ink-black: travel by night favors you.",
  "A silver leaf touches the surface: a debt will be forgiven before dawn.",
  "The well mirrors a constellation absent from every chart—believe it anyway.",
  "A patron shouts \"Demplar!\" and the ripples spell yes, then no, then maybe.",
  "Your line hums one note no instrument owns: change is already walking toward you.",
];

export const perilBeats = [
  {
    q: "A hooded student offers thunder-scented bait. Accept the gift?",
    a: ["Take it—glory loves fools", "Refuse—keep your luck unborrowed"],
  },
  {
    q: "The well whispers a fen-path that is not on any map. Wade?",
    a: ["Follow the whisper", "Circle the hall—let courage ripen"],
  },
  {
    q: "A knight-degen duel spills toward your stool. Intervene?",
    a: ["Break it up—earn a tale", "Vanish behind your tankard"],
  },
  {
    q: "The Moonwell deck sits unattended, cards already warm. Cut in?",
    a: ["Deal me in", "Fish only—keep my virtue dry"],
  },
  {
    q: "The Codex lists your name wrong—again. Correct the scribe?",
    a: ["Demand the scroll", "Let the well spell you true"],
  },
  {
    q: "A candle floats without wax or wick, drifting toward the well. Blow it out?",
    a: ["Extinguish it", "Let it show what it wants"],
  },
];

export const triviaWell = [
  {
    q: "What does renown purchase at the Moonwell?",
    choices: ["A louder tale", "A second cast", "Silence from the eels"],
    ok: 0,
    teach: "Gold buys rounds. Renown buys immortality in gossip.",
  },
  {
    q: "When the well mirrors stars, what rises first?",
    choices: ["The humble hook", "The boast", "The moon"],
    ok: 0,
  },
  {
    q: "How many cards in the Moonwell deck?",
    choices: ["Fifty-two, no odd pips", "Forty with doubled kings", "Whatever the house requires"],
    ok: 0,
  },
  {
    q: "Which night favors shepherd's pie and fen-walker stories?",
    choices: ["Shepherd's Supper", "Pretzel Night only", "Never—fish eat first"],
    ok: 0,
  },
  {
    q: "Who keeps the hall's lamps burning (per the charter)?",
    choices: ["Demplar", "The eels", "Moonlight alone"],
    ok: 0,
  },
  {
    q: "What must you speak at the rim instead of a birth name?",
    choices: ["A mystical title", "Your student number", "Nothing—the well knows"],
    ok: 0,
  },
];

export const demplarNotice =
  "⚔ Charter notice: Knights of the ancient table keep the nets and Herald's ink. @DemplarOfficial reckons on X — here we reckon casts before dawn.";

export const demplarModalIntro =
  "Demplar isn't a realm. It's a reckoning. Where shadow breathes and time fractures, their halls on X echo this quieter convocation at the Moonwell. Planet Sargaano bleeds through the planks; Corsus crossed the desert once. The Herald commends knightsdemplar.com and @DemplarOfficial — no purse required to fish.";

export const creditsLine =
  "Moonwell Anglers — charter hall for anglers, knights, and legend-spinners. Ally: Demplar.";
