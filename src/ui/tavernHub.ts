import type { ChanceGameId } from "../minigames/chance";
import type { FoodId } from "../content/tavernNights";
import { foodItem } from "../content/tavernNights";
import type { MoonwellCard } from "../minigames/moonwellDeck";

export type HubAction =
  | { type: "fish" }
  | { type: "chance_menu" }
  | { type: "feast_menu" };

export function hubChoiceHtml(
  letter: string,
  title: string,
  blurb: string,
  action: string,
  accent?: "gold" | "jade" | "danger",
): string {
  const cls = accent ? ` hub-pick--${accent}` : "";
  return `<button type="button" class="hub-pick${cls}" data-hub-action="${action}">
    <span class="hub-pick-letter">${letter}</span>
    <span class="hub-pick-body">
      <strong>${title}</strong>
      <span class="muted">${blurb}</span>
    </span>
  </button>`;
}

export function renderNightBanner(title: string, tagline: string, herald: string): string {
  return `<div class="night-banner" role="status">
    <p class="night-banner-eyebrow">Tonight at the hall</p>
    <p class="night-banner-title">${title}</p>
    <p class="night-banner-tag">${tagline}</p>
    <p class="night-banner-herald muted">${herald}</p>
  </div>`;
}

export function renderPlayingCard(c: MoonwellCard, face: "up" | "down" = "up"): string {
  if (face === "down") {
    return `<div class="playing-card playing-card--back" aria-hidden="true"><span>?</span></div>`;
  }
  return `<div class="playing-card playing-card--${c.suit}" aria-label="${c.label}">
    <span class="playing-card-rank">${c.label}</span>
  </div>`;
}

export function renderCardRow(cards: MoonwellCard[], opts?: { hideLast?: boolean }): string {
  return `<div class="card-row">${cards
    .map((c, i) => {
      const hide = opts?.hideLast && i === cards.length - 1;
      return renderPlayingCard(c, hide ? "down" : "up");
    })
    .join("")}</div>`;
}

export function feastButtonHtml(id: FoodId, eaten: boolean): string {
  const f = foodItem(id);
  const disabled = eaten ? " disabled" : "";
  return `<button type="button" class="hub-pick hub-pick--jade" data-feast-id="${id}"${disabled}>
    <span class="hub-pick-letter">🍽</span>
    <span class="hub-pick-body">
      <strong>${f.name}</strong>
      <span class="muted">${f.cost} token${f.cost === 1 ? "" : "s"} — ${f.blurb}</span>
      ${eaten ? `<span class="muted feast-ate">Already supped tonight.</span>` : ""}
    </span>
  </button>`;
}

export function chanceGameButtonHtml(id: ChanceGameId, name: string, blurb: string, stake: number): string {
  return hubChoiceHtml(
    id === "high_low" ? "H" : "O",
    name,
    `${blurb} (stake ${stake} token)`,
    `chance:${id}`,
    id === "high_low" ? "gold" : "jade",
  );
}

export function wireHubClicks(
  host: HTMLElement,
  onAction: (action: string) => void,
): void {
  host.querySelectorAll<HTMLElement>("[data-hub-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const a = el.getAttribute("data-hub-action");
      if (a) onAction(a);
    });
  });
  host.querySelectorAll<HTMLElement>("[data-feast-id]").forEach((el) => {
    if ((el as HTMLButtonElement).disabled) return;
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-feast-id");
      if (id) onAction(`feast:${id}`);
    });
  });
}
