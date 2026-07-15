/** Lore pack — Moonwell tavern on Demplarverse land; we relay their lore, we are not the charter. */

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
  "Overheard on X: Demplar's Herald tolls thrice — a catch, an omen, a name their Codex will misspell anyway.",
  "Hark—renown is not coin here; it is the volume at which the tavern tells your story tomorrow.",
  "The oldest hook in the cellar bears a mark: Demplar—neighbor myth, not our crest.",
  "Where shadow breathes on this land, the Moonwell answers—we fish; they reckon on X.",
  "The Rim Academy adjourns; our tavern holds convocation by candle and mist.",
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
  glyph: string;
  demplarHook?: boolean;
}> = [
  {
    id: "silver_darter",
    name: "Glimmer Minnow",
    rarity: "common",
    glyph: "🐟",
    blurb:
      "An honest bite—scales like kitchen tin. Good for stew, small boasts, and a night that ends without prophecy knocking.",
  },
  {
    id: "riddle_eel",
    name: "Lex-Eel",
    rarity: "uncommon",
    glyph: "🐍",
    blurb:
      "It arrives in half-rhymes and leaves you with half an answer, a full tankard of doubt, and a rumor the deck tables already know.",
  },
  {
    id: "moonscale_koi",
    name: "Astral Carp",
    rarity: "rare",
    glyph: "✨",
    blurb:
      "Scales like pressed starlight. Candles lean. Conversations die mid-sentence. The rim chalks your name slower than usual.",
  },
  {
    id: "omen_perch",
    name: "Prophet Perch",
    rarity: "omen",
    glyph: "👁",
    blurb:
      "Its eye reflects not your face, but the choice you pretend you have not made. Omens swim; they do not apologize.",
  },
  {
    id: "demplar_glassfish",
    name: "Charter Wraithfish",
    rarity: "mythic",
    glyph: "👻",
    blurb:
      "Nearly clear—only the hook-shadow reads true. They say Demplar bought the first net with a promise the well still collects, interest in teeth.",
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
    q: "Who keeps the tavern's lamps burning?",
    choices: ["The house, with moonlight help", "Demplar's Herald on X", "The eels alone"],
    ok: 0,
  },
  {
    q: "What must you speak at the rim instead of a birth name?",
    choices: ["A mystical title", "Your student number", "Nothing—the well knows"],
    ok: 0,
  },
];

export const demplarNotice =
  "⚔ Rim notice: this is the Moonwell Tavern — fish, feast, cards, arcade. Neighbor lore posts on @DemplarOfficial; we don't speak for them.";

export const demplarModalIntro =
  "The Moonwell Tavern — anglers, degens, and anyone with a name. Fish the well, eat, play cards, or hit the back-room arcade. We sit on Demplarverse land and sometimes borrow their scenery for trial night; @DemplarOfficial and knightsdemplar.com are theirs, not ours. No purse required to cast.";

export const creditsLine =
  "Moonwell Tavern — fish, renown, and back-room arcade. Neighbor lore on X.";
