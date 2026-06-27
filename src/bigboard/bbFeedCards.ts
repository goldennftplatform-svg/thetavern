import { rankLabel, suitColor, suitSymbol } from "./chanceTable";

export type FeedCardSnap = { label: string; rank: number; suit: string };

export function renderFeedCardsHtml(
  cards: FeedCardSnap[],
  outcome?: string,
): string {
  if (!cards.length) return "";

  const verdict =
    outcome === "win"
      ? `<span class="bb-deed-cards__verdict bb-deed-cards__verdict--win">WIN</span>`
      : outcome === "lose"
        ? `<span class="bb-deed-cards__verdict bb-deed-cards__verdict--lose">LOSE</span>`
        : outcome === "push"
          ? `<span class="bb-deed-cards__verdict">PUSH</span>`
          : "";

  const chips = cards
    .map((card) => {
      const col = suitColor(card.suit);
      const sym = suitSymbol(card.suit);
      const rank = rankLabel(card.rank);
      return `<span class="bb-mini-card" style="--bb-card-accent:${col}" title="${card.label}">
        <span class="bb-mini-card__rank">${rank}</span>
        <span class="bb-mini-card__suit">${sym}</span>
      </span>`;
    })
    .join("");

  return `<div class="bb-deed-cards" aria-label="Moonwell deck">${chips}${verdict}</div>`;
}
