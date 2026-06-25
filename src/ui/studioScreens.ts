import { warriorCompleteLines } from "../content/demplarKnights";
import { pickLine } from "../content/arcaneLore";
import type { Season } from "../content/lore";
import type { CatchResult } from "../game/types";
import type { ChanceResult } from "../minigames/chance";
import type { DemplarRunResult } from "../minigames/demplarWarrior";
import type { MoonwellCard } from "../minigames/moonwellDeck";
import type { FoodId } from "../content/tavernNights";
import { MOONWELL_DECK_LORE } from "../minigames/moonwellDeck";
import type { XLoreFeed } from "../lore/xFeed";
import { formatXPostAge } from "../lore/xFeed";
import {
  feastButtonHtml,
  hubBackHtml,
  hubTileHtml,
  renderCardRow,
  studioStageHtml,
} from "./tavernHub";

export type RunSnapshot = {
  renown: number;
  tokens: number;
  catalogSize: number;
  titles: string[];
  nickname: string;
  season: Season;
  seasonName: string;
  seasonVerse: string;
  seasonNote: string;
};

export function scoreboardHtml(s: RunSnapshot): string {
  const titleLine =
    s.titles.length > 0
      ? `<p class="studio-titles">${s.titles.slice(-2).join(" · ")}</p>`
      : "";
  return `<div class="studio-scoreboard" aria-label="Your run">
    <span class="studio-stat"><em>★</em> ${s.renown} <small>Legend</small></span>
    <span class="studio-stat"><em>◎</em> ${s.tokens} <small>Tokens</small></span>
    <span class="studio-stat"><em>🐟</em> ${s.catalogSize} <small>Caught</small></span>
  </div>
  <p class="studio-angler">${escapeHtml(s.nickname)} · ${escapeHtml(s.seasonName)}</p>
  ${titleLine}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hubWellHtml(
  s: RunSnapshot,
  nightTitle: string,
  nightTagline: string,
  hubVerse: string,
  extraLore: string,
  charterNight: string,
): string {
  return studioStageHtml(
    "The Moonwell",
    `${scoreboardHtml(s)}
    <p class="studio-charter-night">Charter night · ${escapeHtml(charterNight)} <small>(resets 4am PT)</small></p>
    <p class="studio-night">${escapeHtml(nightTitle)}</p>
    <p class="studio-lore-line">${escapeHtml(nightTagline)}</p>
    <p class="studio-lore-line studio-lore-line--verse">${escapeHtml(s.seasonVerse)}</p>
    <p class="studio-lore-line studio-lore-line--hint">${escapeHtml(s.seasonNote)}</p>
    <div class="hub-grid hub-grid--tiles hub-grid--studio" id="hub-grid">
      ${hubTileHtml("🎣", "Cast", "fish", "gold")}
      ${hubTileHtml("⚔", "Warrior", "demplar_warrior", "gold")}
      ${hubTileHtml("🃏", "Cards", "chance_menu", "jade")}
      ${hubTileHtml("🍖", "Eat", "feast_menu", "jade")}
    </div>
    <p class="studio-lore-line studio-lore-line--hint">${escapeHtml(hubVerse)}</p>
    <p class="studio-lore-line">${escapeHtml(extraLore)}</p>
    <div class="studio-hub-footer">
      <button type="button" class="btn ghost studio-link-btn" data-hub-action="ledger">Ledger &amp; lore</button>
      <button type="button" class="btn ghost studio-link-btn" data-hub-action="herald_scroll">Demplar on X ↓</button>
      <button type="button" class="btn ghost studio-link-btn" data-hub-action="charter">Rim notice</button>
    </div>`,
  );
}

export function catchResolveHtml(c: CatchResult, flourish: string, blurb: string): string {
  const omen = c.omen ? `<p class="studio-omen"><em>Omen:</em> ${escapeHtml(c.omen)}</p>` : "";
  const demplar = c.demplarTease
    ? `<p class="studio-demplar">Overheard rumor: the name <strong>Demplar</strong> rides this catch — neighbor lore, not our crest.</p>`
    : "";
  return studioStageHtml(
    "Catch inscribed",
    `<p class="rarity-badge rarity-badge--${c.rarity}">${c.rarity}</p>
    <h3 class="studio-catch-name">${escapeHtml(c.name)}</h3>
    <p class="studio-score-delta">+${c.renown} Legend · +${c.tokens} ◎</p>
    <p class="studio-flourish">${flourish}</p>
    <p class="studio-fish-lore">${escapeHtml(blurb)}</p>
    ${omen}${demplar}
    <button type="button" class="btn primary big studio-continue" data-continue="renown">Inscribe &amp; continue</button>`,
  );
}

export function renownStudioHtml(s: RunSnapshot, hint: string): string {
  return studioStageHtml(
    "Legend grows",
    `${scoreboardHtml(s)}
    <p class="studio-flourish">${escapeHtml(hint)}</p>
    <button type="button" class="btn primary big studio-continue" data-continue="interlude">Face the well's trial</button>`,
  );
}

export function perilStudioHtml(question: string, choices: string[]): string {
  const btns = choices
    .map(
      (label, i) =>
        `<button type="button" class="btn big ${i === 0 ? "primary studio-choice" : "ghost studio-choice"}" data-peril-choice="${i}">${escapeHtml(label)}</button>`,
    )
    .join("");
  return studioStageHtml(
    "Crossroads",
    `<p class="studio-stage-lead">${escapeHtml(question)}</p>
    <div class="studio-choice-stack">${btns}</div>`,
  );
}

export function triviaStudioHtml(question: string, choices: string[]): string {
  const btns = choices
    .map(
      (label, i) =>
        `<button type="button" class="btn big ghost studio-choice" data-trivia-choice="${i}">${escapeHtml(label)}</button>`,
    )
    .join("");
  return studioStageHtml(
    "Well riddle",
    `<p class="studio-stage-lead">${escapeHtml(question)}</p>
    <div class="studio-choice-stack">${btns}</div>`,
  );
}

export function triviaTeachHtml(teach: string): string {
  return studioStageHtml(
    "The well teaches",
    `<p class="studio-flourish">${escapeHtml(teach)}</p>
    <button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>`,
  );
}

export function chanceResultStudioHtml(r: ChanceResult): string {
  const cards = renderCardRow(r.cards, { hero: r.cards.length <= 2 });
  const cls =
    r.outcome === "win" ? "win" : r.outcome === "push" ? "push" : "lose";
  return studioStageHtml(
    r.title,
    `<p class="studio-flourish studio-flourish--${cls}">${escapeHtml(r.detail)}</p>
    ${cards}
    <p class="studio-reward">${r.tokenDelta >= 0 ? "+" : ""}${r.tokenDelta} ◎ · +${r.renownDelta} ★</p>
    <button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>`,
  );
}

export function demplarResultStudioHtml(
  r: DemplarRunResult,
  renown: number,
  tokens: number,
  best?: number,
): string {
  const bestLine =
    best != null
      ? `<p class="studio-lore-line studio-lore-line--hint">Charter best: ${best}</p>`
      : "";
  return studioStageHtml(
    "Demplar Warrior",
    `<p class="studio-flourish">${escapeHtml(pickLine(warriorCompleteLines))}</p>
    <p class="studio-lore-line studio-lore-line--hint">Knights of the ancient charter — three trials sealed.</p>
    <div class="studio-scoreboard studio-scoreboard--demplar">
      <span class="studio-stat"><em>I</em> ${r.platform} <small>Run</small></span>
      <span class="studio-stat"><em>II</em> ${r.race} <small>Circuit</small></span>
      <span class="studio-stat"><em>III</em> ${r.asteroids} <small>Shards</small></span>
    </div>
    <p class="studio-reward">Total ${r.total} · +${renown} ★ · +${tokens} ◎</p>
    ${bestLine}
    <button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>`,
  );
}

export function chancePickStudioHtml(intro: string): string {
  return studioStageHtml(
    "Divination Table",
    `<p class="studio-lore-line">${escapeHtml(intro)}</p>
    <p class="studio-lore-line studio-lore-line--hint">${escapeHtml(MOONWELL_DECK_LORE)}</p>
    <div class="hub-grid hub-grid--tiles hub-grid--studio" id="hub-grid">
      ${hubTileHtml("▲", "Hi-Lo", "chance:high_low", "gold")}
      ${hubTileHtml("◎", "O / U", "chance:over_under", "jade")}
    </div>${hubBackHtml()}`,
  );
}

export function feastStudioHtml(intro: string, nightTitle: string, specials: FoodId[], eaten: FoodId[]): string {
  const grid = specials.map((id) => feastButtonHtml(id, eaten.includes(id))).join("");
  return studioStageHtml(
    "Enchanted Kitchen",
    `<p class="studio-night">${escapeHtml(nightTitle)}</p>
    <p class="studio-lore-line">${escapeHtml(intro)}</p>
    <div class="hub-grid hub-grid--feast" id="hub-grid">${grid}</div>
    ${hubBackHtml()}`,
  );
}

export function ledgerStudioHtml(s: RunSnapshot, notices: string[], archiveLines: string[]): string {
  const noticeLis = notices.map((n) => `<li>${escapeHtml(n)}</li>`).join("");
  const archiveLis = archiveLines.map((n) => `<li class="studio-archive-line">${escapeHtml(n)}</li>`).join("");
  return studioStageHtml(
    "Ledger &amp; notices",
    `${scoreboardHtml(s)}
    <p class="studio-stage-lead">Tavern archive</p>
    <ul class="studio-ledger-list studio-ledger-list--archive">${archiveLis}</ul>
    <p class="studio-stage-lead">Hall notices</p>
    <ul class="studio-ledger-list">${noticeLis}</ul>
    <button type="button" class="btn ghost studio-link-btn" data-hub-action="herald_scroll">Demplar on X — doom scroll ↓</button>
    <button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>`,
  );
}

export function heraldScrollStudioHtml(s: RunSnapshot, feed: XLoreFeed): string {
  const ally = feed.accounts
    .map((a) => `@${escapeHtml(a.handle)}${a.site ? ` · ${escapeHtml(a.site)}` : ""}`)
    .join(" — ");
  const synced =
    feed.syncedAt && Date.parse(feed.syncedAt) > 0
      ? new Date(feed.syncedAt).toLocaleString()
      : "charter seed";

  const cards = feed.posts
    .map(
      (p) => `<article class="studio-x-post" role="article">
      <header class="studio-x-post-head">
        <span class="studio-x-avatar" aria-hidden="true">⚔</span>
        <div class="studio-x-meta">
          <strong class="studio-x-name">${escapeHtml(p.label)}</strong>
          <span class="studio-x-handle">@${escapeHtml(p.handle.replace(/^@/, ""))}</span>
        </div>
        <time class="studio-x-age" datetime="${escapeHtml(p.createdAt)}">${formatXPostAge(p.createdAt)}</time>
      </header>
      <p class="studio-x-text">${escapeHtml(p.text)}</p>
      <footer class="studio-x-foot">
        <a class="studio-x-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">Open on X ↗</a>
      </footer>
    </article>`,
    )
    .join("");

  return studioStageHtml(
    "Overheard from X",
    `<p class="studio-stage-lead">Doom scroll neighbor lore — we relay @DemplarOfficial; this tavern is on their land, not in their charter. ${ally}</p>
    <p class="studio-lore-line studio-lore-line--hint">Relay synced ${escapeHtml(synced)} · <strong>${feed.posts.length}</strong> missives — keep scrolling</p>
    <div class="studio-x-scroll" role="feed" aria-label="Relay of Demplar posts from X">${cards}</div>
    <div class="studio-hub-footer studio-hub-footer--scroll">
      <a class="btn ghost studio-link-btn" href="https://x.com/DemplarOfficial" target="_blank" rel="noopener noreferrer">Follow on X</a>
      <button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>
    </div>`,
    "studio-stage--herald",
  );
}

export function wireStudioActions(
  host: HTMLElement,
  handlers: {
    onContinue?: (target: string) => void;
    onPeril?: (index: number) => void;
    onTrivia?: (index: number) => void;
  },
): void {
  host.querySelectorAll<HTMLButtonElement>("[data-continue]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-continue");
      if (t && handlers.onContinue) handlers.onContinue(t);
    });
  });
  host.querySelectorAll<HTMLButtonElement>("[data-peril-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-peril-choice"));
      if (!Number.isNaN(i) && handlers.onPeril) handlers.onPeril(i);
    });
  });
  host.querySelectorAll<HTMLButtonElement>("[data-trivia-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-trivia-choice"));
      if (!Number.isNaN(i) && handlers.onTrivia) handlers.onTrivia(i);
    });
  });
}
