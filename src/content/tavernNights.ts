/** Special tavern nights — kitchen specials rotate by UTC weekday. */

export type FoodId =
  | "pretzel_twist"
  | "cheesecake_peanuts"
  | "corndog_carnival"
  | "shepherds_pie";

export type TavernNight = {
  id: string;
  title: string;
  tagline: string;
  /** Featured kitchen special tonight */
  special: FoodId;
  /** All specials available (Grand Hall nights) */
  specials: FoodId[];
  herald: string;
};

export const FOOD_MENU: Record<
  FoodId,
  {
    name: string;
    cost: number;
    blurb: string;
    buffLabel: string;
    /** Bite window ms bonus when fishing */
    biteBonusMs?: number;
    /** Extra renown on next catch */
    renownBonus?: number;
    /** Extra tokens on next catch */
    tokenBonus?: number;
    /** Minimum cast quality floor 0–1 */
    castFloor?: number;
  }
> = {
  pretzel_twist: {
    name: "Moon-salt pretzel twists",
    cost: 1,
    blurb: "Twisted dough and rim-salt—the well loves a daring wrist.",
    buffLabel: "Salty luck — +1 token on your next landing.",
    tokenBonus: 1,
  },
  cheesecake_peanuts: {
    name: "Cheesecake peanuts",
    cost: 1,
    blurb: "Sweet crunch from a recipe the Codex redacted in footnotes.",
    buffLabel: "Slow bite — the well waits longer when it nibbles.",
    biteBonusMs: 280,
  },
  corndog_carnival: {
    name: "Corndog carnival sticks",
    cost: 2,
    blurb: "Fairground on a stick. The batter holds like a good cast.",
    buffLabel: "Steady arm — your cast starts truer.",
    castFloor: 0.35,
  },
  shepherds_pie: {
    name: "Shepherd's pie of the fen",
    cost: 2,
    blurb: "Steam, mash, and stories of paths walked where maps refuse to go.",
    buffLabel: "Full belly — +2 renown on your next catch.",
    renownBonus: 2,
  },
};

const NIGHTS: Record<number, TavernNight> = {
  0: {
    id: "rest_riddles",
    title: "Rest & Riddles",
    tagline: "Quiet boards, loud wit.",
    special: "pretzel_twist",
    specials: ["pretzel_twist", "cheesecake_peanuts"],
    herald: "The hall dims early; riddles buy rounds when gold runs thin.",
  },
  1: {
    id: "pretzel_night",
    title: "Pretzel Night",
    tagline: "Twists, salt, and side bets.",
    special: "pretzel_twist",
    specials: ["pretzel_twist"],
    herald: "Twisted dough at every table — the well loves a salty wrist.",
  },
  2: {
    id: "cheesecake_peanuts",
    title: "Cheesecake Peanut Hour",
    tagline: "Sweet crunch, sharp tongues.",
    special: "cheesecake_peanuts",
    specials: ["cheesecake_peanuts"],
    herald: "Patrons trade Codex gossip over bowls of cheesecake peanuts.",
  },
  3: {
    id: "corndog_carnival",
    title: "Corndog Carnival",
    tagline: "Fair smoke in a fantasy hall.",
    special: "corndog_carnival",
    specials: ["corndog_carnival"],
    herald: "Batter sizzles; dice click — carnival luck rides the mist.",
  },
  4: {
    id: "shepherds_supper",
    title: "Shepherd's Pie Supper",
    tagline: "Steam, mash, and moon hooks.",
    special: "shepherds_pie",
    specials: ["shepherds_pie"],
    herald: "Shepherd's pie steam fogs the windows — fen-walkers tell true tales tonight.",
  },
  5: {
    id: "grand_hall",
    title: "Grand Convocation",
    tagline: "Every delicacy, every table alight.",
    special: "shepherds_pie",
    specials: ["pretzel_twist", "cheesecake_peanuts", "corndog_carnival", "shepherds_pie"],
    herald: "Grand Convocation: pretzels, peanuts, corndogs, pie—and the Moonwell deck runs hot as prophecy.",
  },
  6: {
    id: "knightly_revel",
    title: "Knightly Revel",
    tagline: "Shadow breathes; legends wager.",
    special: "cheesecake_peanuts",
    specials: ["pretzel_twist", "cheesecake_peanuts", "corndog_carnival"],
    herald:
      "They say the Demplarverse frays at the rim tonight — travelers and degens share one tavern, one well.",
  },
};

export function tonightUtc(): TavernNight {
  const day = new Date().getUTCDay();
  return NIGHTS[day] ?? NIGHTS[5]!;
}

export function foodItem(id: FoodId) {
  return FOOD_MENU[id];
}
