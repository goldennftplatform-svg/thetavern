import type { ChanceGameId } from "../minigames/chance";
import type { FoodId } from "../content/tavernNights";
import { foodItem } from "../content/tavernNights";
import type { MoonwellCard } from "../minigames/moonwellDeck";
import { cardRankChar, MOONWELL_SUIT_SYMBOL } from "../minigames/moonwellDeck";

export function hubChoiceHtml(
  letter: string,
  title: string,
  blurb: string,
  action: string,
  accent?: "gold" | "jade" | "danger" | "ghost",
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

export function hubTableSeatHtml(
  action: string,
  icon: string,
  title: string,
  hint: string,
  seat: "north" | "east" | "south" | "west",
  accent?: "gold" | "jade",
): string {
  const cls = accent ? ` tavern-table__seat--${accent}` : "";
  return `<button type="button" class="tavern-table__seat tavern-table__seat--${seat}${cls}" data-hub-action="${action}">
    <span class="tavern-table__prop-icon" aria-hidden="true">${icon}</span>
    <span class="tavern-table__prop-name">${title}</span>
    <span class="tavern-table__prop-hint">${hint}</span>
  </button>`;
}

export function hubTileHtml(
  icon: string,
  label: string,
  action: string,
  accent?: "gold" | "jade",
): string {
  const cls = accent ? ` hub-tile--${accent}` : "";
  return `<button type="button" class="hub-tile${cls}" data-hub-action="${action}">
    <span class="hub-tile-icon" aria-hidden="true">${icon}</span>
    <span class="hub-tile-label">${label}</span>
  </button>`;
}

export function hubBackHtml(): string {
  return `<div class="hub-back-row"><button type="button" class="btn ghost big" data-hub-action="back:well">← Back</button></div>`;
}

export function renderNightBanner(title: string, tagline: string, herald: string): string {
  return `<div class="night-banner" role="status">
    <p class="night-banner-eyebrow">Tonight at the hall</p>
    <p class="night-banner-title">${title}</p>
    <p class="night-banner-tag">${tagline}</p>
    <p class="night-banner-herald muted">${herald}</p>
  </div>`;
}

export function renderPlayingCard(
  c: MoonwellCard,
  opts?: { face?: "up" | "down"; hero?: boolean; neutral?: boolean; colorReveal?: boolean },
): string {
  const face = opts?.face ?? "up";
  const hero = opts?.hero ? " playing-card--hero" : "";
  if (face === "down") {
    return `<div class="playing-card playing-card--back${hero}" aria-hidden="true"><span class="playing-card-back-mark">?</span></div>`;
  }
  const rank = cardRankChar(c);
  const sym = MOONWELL_SUIT_SYMBOL[c.suit];
  const mode = opts?.neutral
    ? " playing-card--neutral"
    : opts?.colorReveal
      ? ` playing-card--color-${c.suit === "cups" || c.suit === "coins" ? "red" : "black"}`
      : "";
  return `<div class="playing-card playing-card--${c.suit}${mode}${hero}" aria-label="${c.label}">
    <div class="playing-card-corner playing-card-corner--tl">
      <span class="playing-card-rank">${rank}</span>
      <span class="playing-card-suit-sm">${sym}</span>
    </div>
    <div class="playing-card-pip" aria-hidden="true">${sym}</div>
    <div class="playing-card-corner playing-card-corner--br">
      <span class="playing-card-rank">${rank}</span>
      <span class="playing-card-suit-sm">${sym}</span>
    </div>
  </div>`;
}

export function renderCardRow(cards: MoonwellCard[], opts?: { hideLast?: boolean; hero?: boolean }): string {
  return `<div class="card-row${opts?.hero ? " card-row--hero" : ""}">${cards
    .map((c, i) => {
      const hide = opts?.hideLast && i === cards.length - 1;
      return renderPlayingCard(c, { face: hide ? "down" : "up", hero: opts?.hero });
    })
    .join("")}</div>`;
}

export function studioStageHtml(title: string, body: string, extraClass = ""): string {
  const cls = extraClass ? ` ${extraClass}` : "";
  return `<div class="studio-stage${cls}">
    <header class="studio-stage-head">${title}</header>
    <div class="studio-stage-body">${body}</div>
  </div>`;
}

export function chancePickHtml(): string {
  return studioStageHtml(
    "Divination Table",
    `<div class="hub-grid hub-grid--tiles hub-grid--studio" id="hub-grid">
      ${hubTileHtml("▲", "Hi-Lo", "chance:high_low", "gold")}
      ${hubTileHtml("◆", "Red / Black", "chance:red_black", "jade")}
    </div>${hubBackHtml()}`,
  );
}

export function hubStudioHtml(): string {
  return studioStageHtml(
    "The Moonwell",
    buildWellHubInner(),
  );
}

function buildWellHubInner(): string {
  return `<div class="hub-grid hub-grid--tiles hub-grid--studio" id="hub-grid">
      ${hubTileHtml("🎣", "Cast", "fish", "gold")}
      ${hubTileHtml("🃏", "Cards", "chance_menu", "jade")}
      ${hubTileHtml("🍖", "Eat", "feast_menu", "jade")}
    </div>`;
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
    id === "high_low" ? "H" : "R",
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
