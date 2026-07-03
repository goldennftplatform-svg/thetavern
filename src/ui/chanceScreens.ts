import type { ChanceResult } from "../minigames/chance";
import { HI_LO_RANK_LADDER } from "../minigames/chance";
import type { MoonwellCard } from "../minigames/moonwellDeck";
import { cardColor, cardRankChar } from "../minigames/moonwellDeck";
import { renderPlayingCard, studioStageHtml } from "./tavernHub";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Hi-Lo — rank comparison only; suits stay neutral ink so it never reads as a color game. */
export function chanceHighLowPlayHtml(card: MoonwellCard): string {
  const rank = cardRankChar(card);
  return studioStageHtml(
    `<span class="chance-game-kicker">Rank game</span> Hi-Lo`,
    `<div class="chance-hilo-board">
      ${renderPlayingCard(card, { hero: true, neutral: true })}
      <p class="chance-rank-ladder" aria-label="Rank order">${HI_LO_RANK_LADDER}</p>
    </div>
    <p class="studio-stage-lead">Showing <strong class="chance-rank-callout">${rank}</strong>. Will the next draw rank higher or lower?</p>
    <div class="chance-actions chance-actions--studio chance-actions--hilo" id="chance-actions">
      <button type="button" class="btn studio-choice studio-choice--high" data-guess="high" data-chance-game="high_low">
        <span class="studio-choice-label">Higher</span>
        <span class="studio-choice-hint">▲ next rank</span>
      </button>
      <button type="button" class="btn studio-choice studio-choice--low" data-guess="low" data-chance-game="high_low">
        <span class="studio-choice-label">Lower</span>
        <span class="studio-choice-hint">▼ next rank</span>
      </button>
    </div>`,
    "chance-stage chance-stage--hilo",
  );
}

/** Red / Black — face-down draw; color call only. */
export function chanceRedBlackPlayHtml(): string {
  return studioStageHtml(
    `<span class="chance-game-kicker">Color game</span> Red / Black`,
    `<div class="chance-color-board">
      ${renderPlayingCard({ suit: "wands", rank: 2, label: "?", id: "back" }, { face: "down", hero: true })}
      <p class="chance-color-legend muted">Red = ♥ ♦ · Black = ♣ ♠</p>
    </div>
    <p class="studio-stage-lead">The card stays hidden. Call the suit color before it turns.</p>
    <div class="chance-actions chance-actions--studio chance-actions--color" id="chance-actions">
      <button type="button" class="btn studio-choice studio-choice--red" data-guess="red" data-chance-game="red_black">
        <span class="studio-choice-label">Red</span>
        <span class="studio-choice-hint">♥ ◆</span>
      </button>
      <button type="button" class="btn studio-choice studio-choice--black" data-guess="black" data-chance-game="red_black">
        <span class="studio-choice-label">Black</span>
        <span class="studio-choice-hint">♣ ♠</span>
      </button>
    </div>`,
    "chance-stage chance-stage--color",
  );
}

function hiloRevealHtml(cards: MoonwellCard[]): string {
  const [first, second] = cards;
  if (!first || !second) return "";
  const arrow =
    second.rank === first.rank ? "=" : second.rank > first.rank ? "▲" : "▼";
  return `<div class="chance-hilo-reveal" aria-label="Draw result">
    ${renderPlayingCard(first, { hero: true, neutral: true })}
    <span class="chance-hilo-arrow" aria-hidden="true">${arrow}</span>
    ${renderPlayingCard(second, { hero: true, neutral: true })}
  </div>`;
}

function colorRevealHtml(card: MoonwellCard): string {
  const color = cardColor(card);
  const label = color === "red" ? "RED" : "BLACK";
  return `<div class="chance-color-reveal chance-color-reveal--${color}" aria-label="Draw result">
    <span class="chance-color-badge">${label}</span>
    ${renderPlayingCard(card, { hero: true, colorReveal: true })}
  </div>`;
}

export function chanceResultStudioHtml(r: ChanceResult): string {
  const cls =
    r.outcome === "win" ? "win" : r.outcome === "push" ? "push" : "lose";
  const cards =
    r.game === "high_low"
      ? hiloRevealHtml(r.cards)
      : r.cards[0]
        ? colorRevealHtml(r.cards[0])
        : "";
  const stageClass =
    r.game === "high_low" ? "chance-stage chance-stage--hilo" : "chance-stage chance-stage--color";
  return studioStageHtml(
    r.title,
    `<p class="studio-flourish studio-flourish--${cls}">${escapeHtml(r.detail)}</p>
    ${cards}
    <p class="studio-reward">${r.tokenDelta >= 0 ? "+" : ""}${r.tokenDelta} ◎ · +${r.renownDelta} ★</p>
    <button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>`,
    stageClass,
  );
}
