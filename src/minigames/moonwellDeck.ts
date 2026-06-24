/**
 * Moonwell deck — 52 cards, no odd pips, doubled face cards.
 * Pips: 2,4,6,8,10 · Faces: J,J,Q,Q,K,K per suit · Moonwell Aces · lucky duplicate tens.
 */

export const MOONWELL_SUITS = ["wands", "cups", "coins", "swords"] as const;
export type MoonwellSuit = (typeof MOONWELL_SUITS)[number];

export type MoonwellCard = {
  suit: MoonwellSuit;
  rank: number;
  label: string;
  id: string;
};

const SUIT_GLYPH: Record<MoonwellSuit, string> = {
  wands: "⚚",
  cups: "♡",
  coins: "◎",
  swords: "†",
};

function pipLabel(rank: number): string {
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  return String(rank);
}

function card(suit: MoonwellSuit, rank: number, tag?: string): MoonwellCard {
  const label = `${pipLabel(rank)}${SUIT_GLYPH[suit]}`;
  return {
    suit,
    rank,
    label,
    id: `${suit}-${rank}-${tag ?? "0"}`,
  };
}

/** Build the canonical 52-card Moonwell deck. */
export function buildMoonwellDeck(): MoonwellCard[] {
  const deck: MoonwellCard[] = [];
  for (const suit of MOONWELL_SUITS) {
    for (const rank of [2, 4, 6, 8, 10]) {
      deck.push(card(suit, rank));
    }
    for (const rank of [11, 11, 12, 12, 13, 13]) {
      deck.push(card(suit, rank, String(deck.length)));
    }
    deck.push(card(suit, 14, "ace"));
    deck.push(card(suit, 10, "lucky"));
  }
  return deck;
}

export function shuffleDeck(deck: MoonwellCard[]): MoonwellCard[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function drawCards(deck: MoonwellCard[], n: number): { drawn: MoonwellCard[]; rest: MoonwellCard[] } {
  const drawn = deck.slice(0, n);
  return { drawn, rest: deck.slice(n) };
}

export function cardRankLabel(c: MoonwellCard): string {
  return c.label;
}

/** Deck lore blurb for the tavern UI */
export const MOONWELL_DECK_LORE =
  "The Moonwell deck: fifty-two cards, no odd pips — only evens, doubled faces, and four Moonwell Aces. House says ties favor the mist.";
