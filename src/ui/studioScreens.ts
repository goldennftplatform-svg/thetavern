import { warriorCompleteLines } from "../content/demplarKnights";
import { pickLine } from "../content/arcaneLore";
import type { Season } from "../content/lore";
import type { CatchResult } from "../game/types";
import type { DemplarRunResult } from "../minigames/demplarWarrior";
import type { FoodId } from "../content/tavernNights";
import { MOONWELL_DECK_LORE } from "../minigames/moonwellDeck";
import type { XLoreFeed } from "../lore/xFeed";
import { formatXPostAge, heraldScrollMeta, heraldScrollPosts } from "../lore/xFeed";
import type { MobileHallSnapshot } from "../hall/mobileHall";
import {
  mobileHallFeedHtml,
  mobileHallLeaderboardHtml,
  mobileHallStakesHtml,
  mobileHallTrophiesHtml,
} from "../hall/mobileHall";
import { formatPatronCaption } from "../hall/hallAssets";
import {
  feastButtonHtml,
  hubBackHtml,
  hubTableSeatHtml,
  hubTileHtml,
  studioStageHtml,
} from "./tavernHub";
import { type NoticeEntry, renderNoticeList } from "./notices";

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
  crestSrc?: string,
): string {
  const tableBg = `${import.meta.env.BASE_URL}media/tavern-table-bg.png`;
  const titleLine =
    s.titles.length > 0
      ? `<p class="tavern-table-scene__titles">${escapeHtml(s.titles.slice(-2).join(" · "))}</p>`
      : "";
  const crest = crestSrc
    ? `<img class="tavern-table__crest" src="${escapeHtml(crestSrc)}" alt="" />`
    : "";
  return `<div class="tavern-table-scene" style="--table-bg: url('${tableBg}')">
    <div class="tavern-table-scene__veil" aria-hidden="true"></div>
    <header class="tavern-table-scene__head">
      <p class="tavern-table-scene__kicker">Tavern night · ${escapeHtml(charterNight)} <small>(resets 4am PT)</small></p>
      <h2 class="tavern-table-scene__title">The Great Table</h2>
      <p class="tavern-table-scene__night">${escapeHtml(nightTitle)}</p>
      <p class="tavern-table-scene__tag">${escapeHtml(nightTagline)}</p>
    </header>

    <div class="tavern-table-scene__stats" aria-label="Your run">
      <span class="tavern-table-scene__stat"><em>★</em> ${s.renown} <small>Legend</small></span>
      <span class="tavern-table-scene__stat"><em>◎</em> ${s.tokens} <small>Tokens</small></span>
      <span class="tavern-table-scene__stat"><em>🐟</em> ${s.catalogSize} <small>Caught</small></span>
      <span class="tavern-table-scene__name">${escapeHtml(s.nickname)} · ${escapeHtml(s.seasonName)}</span>
    </div>
    ${titleLine}

    <div class="tavern-table-wrap">
      <div class="tavern-table" id="hub-grid" role="group" aria-label="Pick an adventure">
        <div class="tavern-table__well" aria-hidden="true">
          <span class="tavern-table__well-glow"></span>
          ${crest}
          <span class="tavern-table__well-label">☽ Moonwell</span>
          <span class="tavern-table__well-hint">Pick what&apos;s in front of you</span>
        </div>
        ${hubTableSeatHtml("fish", "🎣", "Cast the Well", "Fish for renown", "north", "gold")}
        ${hubTableSeatHtml("demplar_warrior", "🕹", "Back-Room Arcade", "Sprint · stack · cure", "east", "gold")}
        ${hubTableSeatHtml("chance_menu", "🃏", "Divination Cards", "Hi-Lo & Red / Black", "south", "jade")}
        ${hubTableSeatHtml("feast_menu", "🍖", "Kitchen Spread", "Buffs before you cast", "west", "jade")}
        <span class="tavern-table__candle tavern-table__candle--a" aria-hidden="true"></span>
        <span class="tavern-table__candle tavern-table__candle--b" aria-hidden="true"></span>
        <span class="tavern-table__candle tavern-table__candle--c" aria-hidden="true"></span>
      </div>
    </div>

    <p class="tavern-table-scene__verse">${escapeHtml(s.seasonVerse)}</p>
    <p class="tavern-table-scene__lore">${escapeHtml(hubVerse)}</p>
    <p class="tavern-table-scene__lore tavern-table-scene__lore--extra">${escapeHtml(extraLore)}</p>

    <footer class="tavern-table-scene__footer">
      <button type="button" class="btn ghost tavern-table-scene__link" data-hub-action="hall_view">📺 Hall view</button>
      <button type="button" class="btn ghost tavern-table-scene__link" data-hub-action="ledger">Ledger</button>
      <button type="button" class="btn ghost tavern-table-scene__link" data-hub-action="herald_scroll">Neighbor lore ↓</button>
      <button type="button" class="btn ghost tavern-table-scene__link" data-hub-action="charter">Rim notice</button>
    </footer>
  </div>`;
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

export function demplarResultStudioHtml(
  r: DemplarRunResult,
  renown: number,
  tokens: number,
  best?: number,
): string {
  const bestLine =
    best != null
      ? `<p class="studio-lore-line studio-lore-line--hint">Tavern best: ${best}</p>`
      : "";
  return studioStageHtml(
    "Tavern Arcade",
    `<p class="studio-flourish">${escapeHtml(pickLine(warriorCompleteLines))}</p>
    <p class="studio-lore-line studio-lore-line--hint">Three back-room trials — scores on the tavern wall.</p>
    <div class="studio-scoreboard studio-scoreboard--demplar">
      <span class="studio-stat"><em>I</em> ${r.platform} <small>Run</small></span>
      <span class="studio-stat"><em>II</em> ${r.race} <small>Tetris</small></span>
      <span class="studio-stat"><em>III</em> ${r.asteroids} <small>Dr Mario</small></span>
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
      ${hubTileHtml("◆", "Red / Black", "chance:red_black", "jade")}
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

export function ledgerStudioHtml(s: RunSnapshot, notices: NoticeEntry[], archiveLines: string[]): string {
  const archiveEntries: NoticeEntry[] = archiveLines.map((body) => ({
    kind: "archive" as const,
    label: "Prior charter night",
    body,
  }));
  return studioStageHtml(
    "Ledger &amp; notices",
    `${scoreboardHtml(s)}
    <p class="studio-stage-lead">Tavern archive</p>
    ${renderNoticeList(archiveEntries, "notice-list notice-list--ledger notice-list--archive")}
    <p class="studio-stage-lead">Hall notices</p>
    ${renderNoticeList(notices, "notice-list notice-list--ledger")}
    <button type="button" class="btn ghost studio-link-btn" data-hub-action="hall_view">📺 Hall view</button>
    <button type="button" class="btn ghost studio-link-btn" data-hub-action="herald_scroll">Demplar on X — doom scroll ↓</button>
    <button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>`,
    "studio-stage--ledger",
  );
}

export function mobileHallStudioHtml(hall: MobileHallSnapshot, bigboardHref: string): string {
  const liveCls = hall.live ? "mobile-hall-live" : "mobile-hall-live mobile-hall-live--off";
  const liveLabel = hall.live ? "Live hall connected" : "Solo / preview — run npm run live for a shared hall";
  const patrons = hall.patrons.length
    ? escapeHtml(formatPatronCaption(hall.patrons))
    : "Empty chairs — enter a name and cast to appear at the Great Table";

  return studioStageHtml(
    "Tavern hall",
    `<p class="${liveCls}" role="status"><span class="mobile-hall-live-dot" aria-hidden="true"></span> ${liveLabel}</p>
    <p class="studio-charter-night">Tavern night ${escapeHtml(hall.charterNight)} <small>· resets 4am PT</small></p>
    <p class="mobile-hall-patrons"><strong>At the table</strong> ${patrons}</p>
    <section class="mobile-hall-block" aria-labelledby="mobile-hall-trophy-title">
      <h3 id="mobile-hall-trophy-title" class="mobile-hall-block-title">Trophy rail</h3>
      ${mobileHallTrophiesHtml(hall.trophies)}
    </section>
    <section class="mobile-hall-block" aria-labelledby="mobile-hall-stake-title">
      <h3 id="mobile-hall-stake-title" class="mobile-hall-block-title">Table money</h3>
      ${mobileHallStakesHtml(hall.stakes)}
    </section>
    <section class="mobile-hall-block" aria-labelledby="mobile-hall-lb-title">
      <h3 id="mobile-hall-lb-title" class="mobile-hall-block-title">Leaderboard</h3>
      ${mobileHallLeaderboardHtml(hall.leaderboard)}
    </section>
    <section class="mobile-hall-block mobile-hall-block--feed" aria-labelledby="mobile-hall-feed-title">
      <h3 id="mobile-hall-feed-title" class="mobile-hall-block-title">Live chronicle</h3>
      <div class="mobile-hall-feed">${mobileHallFeedHtml(hall.deeds)}</div>
    </section>
    <div class="studio-hub-footer studio-hub-footer--scroll">
      <a class="btn ghost studio-link-btn" href="${escapeHtml(bigboardHref)}">Projector wall ↗</a>
      <button type="button" class="btn primary big studio-continue" data-hub-action="back:well">← Back to games</button>
    </div>`,
    "studio-stage--hall",
  );
}

export function heraldScrollStudioHtml(s: RunSnapshot, feed: XLoreFeed): string {
  const posts = heraldScrollPosts(feed);
  const accounts = Array.isArray(feed.accounts) ? feed.accounts : [];
  const ally = accounts
    .map((a) => `@${escapeHtml(a.handle)}${a.site ? ` · ${escapeHtml(a.site)}` : ""}`)
    .join(" — ");

  const cards = posts.length
    ? posts
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
        .join("")
    : `<p class="studio-lore-line studio-lore-line--hint">Live syndication is quiet — open @DemplarOfficial on X for tonight&apos;s wire. Charter seed lines stay in the Ledger, not here.</p>`;

  return studioStageHtml(
    "Overheard from X",
    `<p class="studio-stage-lead">Doom scroll neighbor lore — live relay from @DemplarOfficial (real posts only). ${ally}</p>
    <p class="studio-lore-line studio-lore-line--hint">${heraldScrollMeta(feed, posts)}</p>
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
