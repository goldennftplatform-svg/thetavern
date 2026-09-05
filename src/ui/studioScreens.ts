import "../css/tavern-select.css";
import type { Season } from "../content/lore";
import type { CatchResult } from "../game/types";
import type { DemplarRunResult } from "../minigames/demplarWarrior";
import type { BouyMode, BouyResult } from "../minigames/conflicBouy";
import type { FoodId } from "../content/tavernNights";
import { FISHING_POLES, type FishingPole, type PoleId } from "../content/fishingPoles";
import { nextPoleUnlock } from "../content/fishingPoles";
import { MOONWELL_DECK_LORE } from "../minigames/moonwellDeck";
import { CHANCE_GAMES, HI_LO_RANK_LADDER } from "../minigames/chance";
import type { XLoreFeed, XLorePost } from "../lore/xFeed";
import { formatXPostAge, heraldScrollMeta, heraldScrollPosts, isRealXPost } from "../lore/xFeed";
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
  hubTileHtml,
  studioStageHtml,
} from "./tavernHub";
import { avatarFaceHtml, avatarLabel, houseAvatarPickerHtml } from "./avatarFace";
import type { HouseAvatarId } from "../content/houseAvatars";
import { type NoticeEntry, renderNoticeList } from "./notices";
import {
  CONFLIC_TABLE_IDS,
  CONFLIC_TABLE_LABELS,
  type ConflicRoomSummary,
  type ConflicTableId,
} from "../net/conflicProtocol";

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
  avatarId: HouseAvatarId;
  avatarCustom?: string;
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
  poleHint?: string,
  overheard: XLorePost[] = [],
): string {
  const titleLine =
    s.titles.length > 0
      ? `<p class="tavern-select__titles">${escapeHtml(s.titles.slice(-2).join(" · "))}</p>`
      : "";
  const crest = crestSrc
    ? `<img class="tavern-select__crest" src="${escapeHtml(crestSrc)}" alt="" />`
    : "";
  const poleLine = poleHint
    ? `<span class="tavern-select__pole">${escapeHtml(poleHint)}</span>`
    : "";
  const face = avatarFaceHtml(s.avatarId, s.avatarCustom, {
    size: "md",
    className: "tavern-select__avatar",
    interactive: true,
  });
  const wire =
    overheard.length > 0
      ? `<section class="tavern-overheard" aria-label="Overheard from X">
      <header class="tavern-overheard__head">
        <span>⚔ Overheard on X</span>
        <button type="button" class="btn ghost tavern-overheard__more" data-hub-action="herald_scroll">Doom scroll ↓</button>
      </header>
      <ul class="tavern-overheard__list">
        ${overheard
          .map((p) => {
            const live = isRealXPost(p) ? "live" : "charter";
            const text = p.text.length > 110 ? `${p.text.slice(0, 108)}…` : p.text;
            return `<li class="tavern-overheard__item tavern-overheard__item--${live}">
              <span class="tavern-overheard__who">@${escapeHtml(p.handle.replace(/^@/, ""))} · ${formatXPostAge(p.createdAt)}</span>
              <p class="tavern-overheard__text">${escapeHtml(text)}</p>
            </li>`;
          })
          .join("")}
      </ul>
    </section>`
      : `<p class="tavern-select__quiet">The wire is quiet. Visit the Herald for neighbor lore.</p>`;

  // Integer-coordinate silhouettes keep the game art crisp without emoji/platform branding.
  const art = (kind: string, path: string) => `<span class="tavern-select__art tavern-select__art--${kind}" aria-hidden="true"><svg viewBox="0 0 96 64" shape-rendering="crispEdges"><path class="select-stars" d="M12 10h2v2h-2zM78 8h2v2h-2zM86 25h2v2h-2zM22 22h2v2h-2z"/><path d="${path}"/></svg></span>`;
  const fishingArt = art("well", "M62 6h12v4H66v12h-4zM30 28h36v6H30zM26 34h44v8H26zM30 44h36v14H30zM34 46v8h10v-8zM48 46v8h14v-8zM44 14h4v14h-4zM48 14h12v4H48zM16 56h64v4H16z");
  const puzzleArt = art("puzzle", "M22 12h12v12H22zM36 12h12v12H36zM36 26h12v12H36zM50 26h12v12H50zM22 40h12v12H22zM36 40h12v12H36zM50 40h12v12H50zM68 12h8v4h4v16h-4v4h-8v-4h-4V16h4z");
  const fleetArt = art("fleet", "M46 8h4v34h-4zM52 14h4v4h4v4h4v4h4v8H52zM40 20h4v14H30v-4h4v-4h6zM24 40h52v6h-4v4h-4v4H32v-4h-4v-4h-4zM16 58h16v-2h16v2h16v-2h16v4H16z");

  return `<div class="tavern-select">
    <header class="tavern-select__head">
      ${crest}
      <div><p class="tavern-select__eyebrow">Moonwell tavern / adventure select</p>
      <h2>The Great Table</h2>
      <p class="tavern-select__night">${escapeHtml(nightTitle)} <span>${escapeHtml(nightTagline)}</span></p></div>
      <span class="tavern-select__night-number">${escapeHtml(charterNight)}<small>Resets 4am PT</small></span>
    </header>
    <section class="tavern-select__hud" aria-label="Your player">
      ${face}
      <div class="tavern-select__identity"><strong>${escapeHtml(s.nickname)}</strong><span>${escapeHtml(s.seasonName)}</span>${titleLine}</div>
      <dl class="tavern-select__stats"><div><dt>Legend</dt><dd>${s.renown}</dd></div><div><dt>Tokens</dt><dd>${s.tokens}</dd></div><div><dt>Caught</dt><dd>${s.catalogSize}</dd></div></dl>
    </section>
    <section class="tavern-select__games" aria-labelledby="select-heading">
      <div class="tavern-select__section-head"><h3 id="select-heading">Choose your adventure</h3><span>Three ways to make a legend</span></div>
      <div class="tavern-select__grid" id="hub-grid">
        <button type="button" class="tavern-select__game" data-hub-action="fish"><span class="tavern-select__index">01 / THE MOONWELL</span>${fishingArt}<strong>Cast the Well</strong><span class="tavern-select__hint">Fish for renown &amp; pole XP</span><span class="tavern-select__start">Go fishing <b aria-hidden="true">&gt;</b></span></button>
        <button type="button" class="tavern-select__game tavern-select__game--jade" data-hub-action="demplar_warrior"><span class="tavern-select__index">02 / BACK-ROOM ARCADE</span>${puzzleArt}<strong>Puzzle Combo</strong><span class="tavern-select__hint">Stack Attack + Veil Cure</span><span class="tavern-select__start">Play the combo <b aria-hidden="true">&gt;</b></span></button>
        <button type="button" class="tavern-select__game" data-hub-action="conflic_bouy_entry"><span class="tavern-select__index">03 / THE FIVE WATERS</span>${fleetArt}<strong>Conflic Bouy</strong><span class="tavern-select__hint">Fleet tactics / solo &amp; rivals</span><span class="tavern-select__start">Command a fleet <b aria-hidden="true">&gt;</b></span></button>
      </div>
      <div class="tavern-select__sidequests">
        <button type="button" data-hub-action="chance_menu"><span class="tavern-select__mini-icon" aria-hidden="true">&#9830;</span><span><strong>Divination Cards</strong><small>Hi-Lo &amp; Red / Black</small></span><b aria-hidden="true">&gt;</b></button>
        <button type="button" data-hub-action="pole_rack"><span class="tavern-select__mini-icon" aria-hidden="true">/</span><span><strong>Pole Rack</strong><small>Equip wilder rods</small>${poleLine}</span><b aria-hidden="true">&gt;</b></button>
      </div>
    </section>
    <nav class="tavern-select__utilities" aria-label="Tavern services">
      <button type="button" data-hub-action="avatar_closet">Face</button>
      <button type="button" data-hub-action="hall_view">Hall view</button>
      <button type="button" data-hub-action="feast_menu">Kitchen</button>
      <button type="button" data-hub-action="ledger">Ledger</button>
      <button type="button" data-hub-action="herald_scroll">Herald / X</button>
      <button type="button" data-hub-action="charter">Rim notice</button>
    </nav>
    <section class="tavern-select__chronicle" aria-label="Tonight at the tavern">
      <div><p class="tavern-select__eyebrow">Tonight at the tavern</p><p>${escapeHtml(hubVerse)}</p><details><summary>Season lore &amp; overheard</summary><p>${escapeHtml(s.seasonVerse)}</p><p>${escapeHtml(extraLore)}</p>${wire}</details></div>
      <span class="tavern-select__seal" aria-hidden="true">MW<br>EST. 8-BIT</span>
    </section>
  </div>`;
}

export type CatchFlair = {
  flawless?: boolean;
  chainBonus?: number;
  isNew?: boolean;
};

export function catchResolveHtml(
  c: CatchResult,
  flourish: string,
  blurb: string,
  poleNote?: string,
  fishGlyph = "🐟",
  flair: CatchFlair = {},
): string {
  const omen = c.omen ? `<p class="studio-omen"><em>Omen:</em> ${escapeHtml(c.omen)}</p>` : "";
  const demplar = c.demplarTease
    ? `<p class="studio-demplar">Overheard rumor: the name <strong>Demplar</strong> rides this catch — neighbor lore, not our crest.</p>`
    : "";
  const pole = poleNote ? `<p class="studio-pole-xp">${escapeHtml(poleNote)}</p>` : "";
  const chain =
    flair.flawless && (flair.chainBonus ?? 0) > 0
      ? `<p class="studio-catch-flair studio-catch-flair--chain">⚡ MOONFIRE CHAIN · +${flair.chainBonus} bonus Legend</p>`
      : "";
  const fresh = flair.isNew
    ? `<p class="studio-catch-flair studio-catch-flair--new">✦ NEW SPECIES — codex updated</p>`
    : "";
  return studioStageHtml(
    "Catch inscribed",
    `<div class="studio-catch-hero" aria-hidden="true">
      <span class="studio-catch-glyph studio-catch-glyph--${c.rarity}">${fishGlyph}</span>
    </div>
    <p class="rarity-badge rarity-badge--${c.rarity}">${c.rarity}</p>
    <h3 class="studio-catch-name">${escapeHtml(c.name)}</h3>
    <p class="studio-score-delta">+${c.renown} Legend · +${c.tokens} ◎</p>
    ${chain}${fresh}
    <p class="studio-flourish">${flourish}</p>
    <p class="studio-fish-lore">${escapeHtml(blurb)}</p>
    ${omen}${demplar}${pole}`,
    "studio-stage--resolve",
    `<button type="button" class="btn primary big studio-continue" data-continue="renown">Inscribe &amp; continue</button>`,
  );
}

export function renownStudioHtml(s: RunSnapshot, hint: string): string {
  return studioStageHtml(
    "Legend grows",
    `${scoreboardHtml(s)}
    <p class="studio-flourish">${escapeHtml(hint)}</p>`,
    "studio-stage--renown",
    `<button type="button" class="btn primary big studio-continue" data-continue="interlude">Face the well's trial</button>`,
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
    "studio-stage--choice",
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
    "studio-stage--choice",
  );
}

export function triviaTeachHtml(teach: string): string {
  return studioStageHtml(
    "The well teaches",
    `<p class="studio-flourish">${escapeHtml(teach)}</p>`,
    "studio-stage--choice",
    `<button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>`,
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
    `<p class="studio-flourish">Puzzle combo complete. Your mark is on the tavern wall.</p>
    <p class="studio-lore-line studio-lore-line--hint">Stack Attack + Veil Cure / two trials, one total.</p>
    <div class="studio-scoreboard studio-scoreboard--demplar">
      <span class="studio-stat"><em>I</em> ${r.race} <small>Stack Attack</small></span>
      <span class="studio-stat"><em>II</em> ${r.asteroids} <small>Veil Cure</small></span>
    </div>
    <p class="studio-reward">Total ${r.total} · +${renown} ★ · +${tokens} ◎</p>
    ${bestLine}`,
    "studio-stage--result",
    `<button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>`,
  );
}

import { getSparrowLine } from "../minigames/conflicBouyPersonality";

export function conflicResultStudioHtml(
  r: BouyResult,
  renown: number,
  tokens: number,
  mode: BouyMode,
): string {
  const isHotseat = mode === "hotseat";
  const isVictory = isHotseat || r.winner === "player" || r.winner === "player1";
  const accuracy = r.playerHits + r.playerMisses > 0
    ? Math.round((r.playerHits / (r.playerHits + r.playerMisses)) * 100)
    : 0;
  const modeLabel = mode === "agent" ? "vs AGENT" : mode === "online" ? "ONLINE TABLE" : "1v1 HOTSEAT";
  const resultLabel = isHotseat
    ? `PLAYER ${r.winner === "player1" ? 1 : 2} WINS`
    : isVictory ? "VICTORY" : "DEFEAT";
  const resultColor = isVictory ? "#68e8a8" : "#e87850";
  const flashClass = isVictory ? "bouy-victory-flash--victory" : "bouy-victory-flash--defeat";
  const tagline = isHotseat
    ? `${r.winner === "player1" ? "Player 1" : "Player 2"} commands the table.`
    : isVictory
    ? (accuracy === 100 ? "A flawless engagement. Not a shot wasted." : accuracy >= 75 ? "Sharp shooting, Captain." : "The fleet prevails.")
    : (accuracy >= 50 ? "A valiant effort against impossible odds." : "Better luck next voyage.");
  const shipGraveyard = isVictory
    ? ""
    : `<p class="studio-lore-line" style="margin-top:8px;font-size:0.95rem;color:#e87850;">Your fleet rests on the ocean floor.</p>`;
  const sparrowLine = getSparrowLine(isVictory ? "victory" : "defeat", {
    turns: r.turns,
    playerHits: r.playerHits,
    agentHits: r.agentHits,
  });
  const mine = r.mine;
  const mineStats = mine?.stats;
  const mineHtml = mine
    ? `<section class="studio-panel studio-panel--mine" aria-label="Mining claim settlement">
        <header class="mine-ledger__head">
          <span class="mine-ledger__mark">⛏</span>
          <span><strong>Mine the Block</strong><small>Claim settled · Mining 201</small></span>
          <span class="mine-ledger__stamp">PAID</span>
        </header>
        <div class="studio-scoreboard studio-scoreboard--mine">
          <span class="studio-stat"><em>🔍</em> ${mineStats!.scansUsed} <small>Scans</small></span>
          <span class="studio-stat"><em>🪨</em> ${mineStats!.oreFound} <small>Ore</small></span>
          <span class="studio-stat"><em>💰</em> ${mineStats!.payNodesHit} <small>Paydays</small></span>
          <span class="studio-stat"><em>🧱</em> ${mineStats!.blocksMined} <small>Blocks</small></span>
        </div>
        <dl class="mine-ledger__settlement">
          <div><dt>Pool fed</dt><dd>${mineStats!.poolContributed} ◎</dd></div>
          <div class="mine-ledger__payout"><dt>Miner&apos;s share</dt><dd>+${mine.payout} ◎</dd></div>
          <div><dt>Pool remains</dt><dd>${mine.poolAfter} ◎</dd></div>
        </dl>
        <p class="mine-ledger__motto">95% returned · Burn to earn · The pool deepens for the next claim</p>
      </section>`
    : "";
  return studioStageHtml(
    "Conflic Bouy",
    `<div class="bouy-victory-flash ${flashClass}" aria-hidden="true"></div>
    <p class="studio-flourish" style="color:${resultColor}">${resultLabel} — ${modeLabel}</p>
    <p class="studio-lore-line studio-lore-line--hint" style="margin-bottom:4px;">Fleet engagement complete · ${r.turns} turns</p>
    <p class="studio-lore-line" style="font-style:italic;color:#b8a0d8;margin-bottom:4px;">${tagline}</p>
    <p class="studio-lore-line" style="font-size:1rem;color:#e0c060;margin-bottom:16px;">"${sparrowLine}"</p>
    <div class="studio-scoreboard studio-scoreboard--conflic">
      <span class="studio-stat"><em>⚓</em> ${r.playerHits} <small>Hits</small></span>
      <span class="studio-stat"><em>💧</em> ${r.playerMisses} <small>Misses</small></span>
      <span class="studio-stat"><em>🎯</em> ${accuracy}% <small>Accuracy</small></span>
    </div>
    ${mineHtml}
    <p class="studio-reward">Turns ${r.turns} · +${renown} ★ · +${tokens} ◎</p>
    ${shipGraveyard}`,
    "studio-stage--result",
    `<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
      <button type="button" class="btn primary big studio-continue" data-hub-action="${mode === "online" ? "conflic_online_return" : "conflic_bouy"}">${mode === "online" ? "Return to Online Tables" : "⚓ Play Again (Same Mode)"}</button>
      <button type="button" class="btn ghost big studio-continue" data-hub-action="conflic_bouy_change">🔄 ${mode === "online" ? "Local / Solo Modes" : "Change Mode/Theme"}</button>
      <button type="button" class="btn ghost big studio-continue" data-continue="well">Back to the Well</button>
    </div>`,
  );
}

export function conflicThemePickStudioHtml(): string {
  // First screen: choose mode, then theme
  const modeTiles = [
    { icon: "🤖", label: "vs AGENT", desc: "Battle Captain Jack Sparrow", mode: "agent" },
    { icon: "👥", label: "1v1 HOTSEAT", desc: "Pass & play with a friend", mode: "hotseat" },
    { icon: "⚔", label: "ONLINE TABLES", desc: "Five private two-captain tables", mode: "online" },
  ];
  const modeHtml = modeTiles.map((m, i) => 
    `<button type="button" class="hub-tile hub-tile--gold" data-hub-action="conflic_mode:${m.mode}" style="min-height:120px;animation-delay:${0.05 + i * 0.08}s;">
      <span class="hub-tile-icon" style="font-size:3rem;">${m.icon}</span>
      <span class="hub-tile-label" style="font-size:1.2rem;font-weight:bold;">${m.label}</span>
      <span class="hub-tile-hint" style="font-size:0.85rem;opacity:0.8;margin-top:8px;display:block;">${m.desc}</span>
    </button>`
  ).join("");

  const themes = [
    { id: "charter", icon: "⚓", name: "CHARTER NAVY", accent: "gold", desc: "Pirate knights · gold & charter", effects: "" },
    { id: "odyssey", icon: "🚀", name: "ODYSSEY PROTOCOL", accent: "cyan", desc: "Void hunters · neon & glitch", effects: "CRT + Scanlines" },
    { id: "abyssal", icon: "🐙", name: "ABYSSAL DEPTHS", accent: "teal", desc: "Deep horror · bioluminescent", effects: "Particles + Glow" },
    { id: "corsair", icon: "☠️", name: "CORSAIR'S GAMBIT", accent: "amber", desc: "Golden age pirates · rum & cannon", effects: "CRT Effect" },
    { id: "voidwalker", icon: "👁️", name: "VOIDWALKER", accent: "violet", desc: "Cyber swarm · ice & intrusion", effects: "Scanlines + Glitch" },
  ];

  const themeHtml = themes.map((t, i) => 
    `<button type="button" class="hub-tile hub-tile--${t.accent}" data-hub-action="conflic_theme:${t.id}" style="min-height:120px;opacity:0.5;pointer-events:none;animation-delay:${0.1 + i * 0.06}s;">
      <span class="hub-tile-icon" style="font-size:3rem;">${t.icon}</span>
      <span class="hub-tile-label" style="font-size:1.2rem;font-weight:bold;">${t.name}</span>
      <span class="hub-tile-hint" style="font-size:0.85rem;opacity:0.8;margin-top:6px;display:block;">${t.desc}</span>
      ${t.effects ? `<span class="hub-tile-hint" style="font-size:0.7rem;opacity:0.5;margin-top:4px;display:block;color:#8898b0;">✦ ${t.effects}</span>` : ""}
    </button>`
  ).join("");

  return studioStageHtml(
    "Conflic Bouy — Choose Mode & Theme",
    `<p class="studio-lore-line">Step 1: Pick your battle type</p>
    <div class="hub-grid hub-grid--tiles hub-grid--studio" id="hub-grid">${modeHtml}</div>
    <p class="studio-lore-line studio-lore-line--hint" style="margin-top:24px;">Step 2: Pick your theater (select mode first)</p>
    <div class="hub-grid hub-grid--tiles hub-grid--studio" id="hub-grid" style="opacity:0.4;">${themeHtml}</div>`,
    "studio-stage--pick",
    hubBackHtml(),
  );
}

export function conflicLobbyStudioHtml(rooms: ConflicRoomSummary[], connected: boolean, currentTable?: ConflicTableId | null): string {
  const byId = new Map(rooms.map((room) => [room.tableId, room]));
  const statusLabel = (status: ConflicRoomSummary["status"]) => ({
    empty: "OPEN TABLE",
    waiting: "WAITING FOR RIVAL",
    placing: "FLEETS DEPLOYING",
    playing: "BATTLE IN PROGRESS",
    finished: "MATCH COMPLETE",
  })[status];
  const cards = CONFLIC_TABLE_IDS.map((tableId) => {
    const room = byId.get(tableId) ?? {
      tableId,
      label: CONFLIC_TABLE_LABELS[tableId],
      status: "empty" as const,
      occupants: [],
    };
    const seats = ([0, 1] as const).map((seat) => {
      const player = room.occupants.find((occupant) => occupant.seat === seat);
      return `<span class="conflic-table-seat ${player ? "conflic-table-seat--taken" : ""}">
        <small>Seat ${seat + 1}</small>
        <strong>${player ? escapeHtml(player.name) : "Open seat"}</strong>
        <em>${player ? (player.connected ? (player.deployed ? "Fleet locked" : "At table") : "Reconnecting") : "Join now"}</em>
      </span>`;
    }).join("");
    const resuming = currentTable === tableId;
    const full = room.occupants.length >= 2 && !resuming;
    const disabled = !connected || full;
    return `<article class="conflic-table-card conflic-table-card--${tableId}">
      <header><span>${escapeHtml(room.label)}</span><small>${room.occupants.length}/2 captains</small></header>
      <p>${statusLabel(room.status)}</p>
      <div class="conflic-table-seats">${seats}</div>
      <button type="button" class="btn ${disabled ? "ghost" : "primary"}" data-hub-action="conflic_online_join:${tableId}" ${disabled ? "disabled" : ""}>
        ${!connected ? "Online API unavailable" : resuming ? "Resume your seat" : full ? "Table full" : "Take open seat"}
      </button>
    </article>`;
  }).join("");

  return studioStageHtml(
    "Conflic Bouy Online",
    `<p class="studio-flourish">Five waters · ten captains · private fleets</p>
    <p class="studio-lore-line studio-lore-line--hint">Choose a themed table. Battles begin when both captains lock their fleets.</p>
    <section class="conflic-table-lobby" aria-label="Online Conflic Bouy tables">${cards}</section>`,
    "studio-stage--pick studio-stage--conflic-lobby",
    `<div class="conflic-lobby-actions">
      <button type="button" class="btn ghost" data-hub-action="conflic_local">Local / solo modes</button>
      <button type="button" class="btn ghost" data-hub-action="conflic_lobby_refresh">Refresh tables</button>
      ${hubBackHtml()}
    </div>`,
  );
}

export function conflicStakePickStudioHtml(mode: "agent" | "hotseat", themeId: string): string {
  const themes = {
    charter: { icon: "⚓", name: "CHARTER NAVY", accent: "gold" },
    odyssey: { icon: "🚀", name: "ODYSSEY PROTOCOL", accent: "cyan" },
    abyssal: { icon: "🐙", name: "ABYSSAL DEPTHS", accent: "teal" },
    corsair: { icon: "☠️", name: "CORSAIR'S GAMBIT", accent: "amber" },
    voidwalker: { icon: "👁️", name: "VOIDWALKER", accent: "violet" },
  };
  const modeLabel = mode === "agent" ? "vs AGENT" : "1v1 HOTSEAT";

  const stakes = [
    { amount: 0, label: "FRIENDLY", desc: "No tokens wagered · pride only", color: "jade", icon: "🤝", risk: "" },
    { amount: 1, label: "ANTE 1 ◎", desc: "Winner takes 2 ◎", color: "gold", icon: "💰", risk: "Low risk" },
    { amount: 3, label: "ANTE 3 ◎", desc: "Winner takes 6 ◎", color: "amber", icon: "💰", risk: "High stakes" },
    { amount: 5, label: "ANTE 5 ◎", desc: "Winner takes 10 ◎", color: "crimson", icon: "💰", risk: "All or nothing" },
  ];
  const stakeHtml = stakes.map((s, i) => 
    `<button type="button" class="hub-tile hub-tile--${s.color}" data-hub-action="conflic_stake:${s.amount}" style="min-height:110px;animation-delay:${0.05 + i * 0.08}s;">
      <span class="hub-tile-icon" style="font-size:2.5rem;">${s.icon}</span>
      <span class="hub-tile-label" style="font-size:1.2rem;font-weight:bold;">${s.label}</span>
      <span class="hub-tile-hint" style="font-size:0.85rem;opacity:0.8;margin-top:6px;display:block;">${s.desc}</span>
      ${s.risk ? `<span class="hub-tile-hint" style="font-size:0.7rem;opacity:0.5;margin-top:4px;display:block;color:#8898b0;">${s.risk}</span>` : ""}
    </button>`
  ).join("");

  const themeInfo = themes[themeId as keyof typeof themes] ?? themes.charter;

  return studioStageHtml(
    `Conflic Bouy — ${mode === "agent" ? "vs Agent" : "1v1 Hotseat"} — ${themeInfo.name}`,
    `<p class="studio-lore-line">Step 3: Place your wager</p>
    <p class="studio-lore-line studio-lore-line--hint">Mode: ${modeLabel} · Theme: ${themeInfo.name}</p>
    <div class="hub-grid hub-grid--tiles hub-grid--studio" id="hub-grid">${stakeHtml}</div>`,
    "studio-stage--pick",
    hubBackHtml(),
  );
}

export function conflicThemePickStudioHtmlForMode(mode: "agent" | "hotseat"): string {
  const themes = [
    { id: "charter", icon: "⚓", name: "CHARTER NAVY", accent: "gold", desc: "Pirate knights · gold & charter" },
    { id: "odyssey", icon: "🚀", name: "ODYSSEY PROTOCOL", accent: "cyan", desc: "Void hunters · neon & glitch" },
    { id: "abyssal", icon: "🐙", name: "ABYSSAL DEPTHS", accent: "teal", desc: "Deep horror · bioluminescent" },
    { id: "corsair", icon: "☠️", name: "CORSAIR'S GAMBIT", accent: "amber", desc: "Golden age pirates · rum & cannon" },
    { id: "voidwalker", icon: "👁️", name: "VOIDWALKER", accent: "violet", desc: "Cyber swarm · ice & intrusion" },
  ];
  const tiles = themes.map(t => hubTileHtml(t.icon, t.name, `conflic_theme:${t.id}`, t.accent as "gold" | "jade" | "amber" | "cyan" | "teal" | "violet")).join("");
  return studioStageHtml(
    `Conflic Bouy — ${mode === "agent" ? "vs Agent" : "1v1 Hotseat"} — Choose Theme`,
    `<p class="studio-lore-line">Select your theater of war</p>
    <div class="hub-grid hub-grid--tiles hub-grid--studio" id="hub-grid">${tiles}</div>`,
    "studio-stage--pick",
    hubBackHtml(),
  );
}

export function chancePickStudioHtml(intro: string): string {
  const games = CHANCE_GAMES.map((game) => {
    const hilo = game.id === "high_low";
    return `<button type="button" class="hub-tile hub-tile--${hilo ? "gold" : "jade"}" data-hub-action="chance:${game.id}">
      <span class="hub-tile-label">${escapeHtml(game.name)}</span>
      <span class="chance-menu-description">${escapeHtml(game.blurb)}</span>
      <span class="chance-menu-stakes">Risk ${game.stake} token · Win +${hilo ? game.stake * 2 : game.stake + 1} tokens and +${hilo ? 1 : 2} Legend · Lose ${game.stake} token</span>
      <span class="chance-menu-description">${hilo ? `Rank order: ${HI_LO_RANK_LADDER}. Ace is high. Equal ranks: no tokens or Legend gained or lost.` : "Red: hearts / diamonds. Black: clubs / spades. Rank does not matter."}</span>
    </button>`;
  }).join("");
  return studioStageHtml(
    "Divination Table",
    `<p class="studio-lore-line">${escapeHtml(intro)}</p>
    <p class="studio-lore-line studio-lore-line--hint">${escapeHtml(MOONWELL_DECK_LORE)}</p>
    <p class="studio-lore-line">Choose a game, then make one call to settle the round. Rewards below are net changes to your balance; choosing a game does not spend tokens.</p>
    <div class="hub-grid hub-grid--tiles hub-grid--studio chance-menu-grid" id="hub-grid">${games}</div>`,
    "studio-stage--pick studio-stage--chance-menu",
    hubBackHtml(),
  );
}

export function feastStudioHtml(intro: string, nightTitle: string, specials: FoodId[], eaten: FoodId[]): string {
  const grid = specials.map((id) => feastButtonHtml(id, eaten.includes(id))).join("");
  return studioStageHtml(
    "Enchanted Kitchen",
    `<p class="studio-night">${escapeHtml(nightTitle)}</p>
    <p class="studio-lore-line">${escapeHtml(intro)}</p>
    <div class="hub-grid hub-grid--feast" id="hub-grid">${grid}</div>`,
    "studio-stage--feast",
    hubBackHtml(),
  );
}

export function poleRackStudioHtml(args: {
  xp: number;
  equippedId: PoleId;
  unlockedIds: PoleId[];
}): string {
  const unlocked = new Set(args.unlockedIds);
  const next = nextPoleUnlock(args.xp);
  const progress = next
    ? `<p class="studio-rack-progress">Pole XP <strong>${args.xp}</strong> · ${next.xpUnlock - args.xp} more to wake <strong>${escapeHtml(next.name)}</strong></p>`
    : `<p class="studio-rack-progress">Pole XP <strong>${args.xp}</strong> · rack complete</p>`;
  const cards = FISHING_POLES.map((p) => poleRackCardHtml(p, unlocked.has(p.id), p.id === args.equippedId, args.xp)).join("");
  return studioStageHtml(
    "Pole Rack",
    `${progress}
    <div class="pole-rack" role="list">${cards}</div>`,
    "studio-stage--pole-rack",
    hubBackHtml(),
  );
}

export function avatarClosetStudioHtml(args: {
  avatarId: HouseAvatarId;
  avatarCustom?: string;
}): string {
  const preview = avatarFaceHtml(args.avatarId, args.avatarCustom, { size: "lg" });
  const label = avatarLabel(args.avatarId, !!args.avatarCustom);
  return studioStageHtml(
    "Login face",
    `<div class="avatar-closet-head">
      ${preview}
      <p class="studio-rack-progress">Wearing <strong>${escapeHtml(label)}</strong></p>
      <p class="studio-lore-line">Pick a house face, or upload a quiet portrait. Halls see the house mark; custom stays on your seat.</p>
    </div>
    ${houseAvatarPickerHtml(args.avatarId, args.avatarCustom)}
    <div class="avatar-closet-actions">
      <label class="btn ghost big avatar-upload-btn">
        Upload portrait
        <input id="avatar-upload-input" type="file" accept="image/*" hidden />
      </label>
      ${
        args.avatarCustom
          ? `<button type="button" class="btn ghost big" data-hub-action="avatar_clear_custom">Use house face</button>`
          : ""
      }
    </div>`,
    "studio-stage--avatar-closet",
    hubBackHtml(),
  );
}

function poleRackCardHtml(p: FishingPole, unlocked: boolean, equipped: boolean, xp: number): string {
  const sprite = `${import.meta.env.BASE_URL}media/poles/${p.id}.png`;
  if (!unlocked) {
    return `<article class="pole-card pole-card--locked" role="listitem">
      <div class="pole-card__art" aria-hidden="true"><span class="pole-card__lock">🔒</span></div>
      <div class="pole-card__body">
        <p class="pole-card__tier">Tier ${p.tier}</p>
        <h3 class="pole-card__name">${escapeHtml(p.name)}</h3>
        <p class="pole-card__tag muted">XP ${p.xpUnlock} · need ${Math.max(0, p.xpUnlock - xp)}</p>
      </div>
    </article>`;
  }
  const eq = equipped ? " pole-card--equipped" : "";
  const action = equipped
    ? `<span class="pole-card__equipped">Equipped</span>`
    : `<button type="button" class="btn primary pole-card__equip" data-hub-action="equip_pole:${p.id}">Equip</button>`;
  return `<article class="pole-card${eq}" role="listitem">
    <div class="pole-card__art" aria-hidden="true">
      <img src="${escapeHtml(sprite)}" alt="" loading="lazy" onerror="this.style.display='none'" />
      <span class="pole-card__icon">${p.icon}</span>
    </div>
    <div class="pole-card__body">
      <p class="pole-card__tier">Tier ${p.tier}</p>
      <h3 class="pole-card__name">${escapeHtml(p.name)}</h3>
      <p class="pole-card__tag">${escapeHtml(p.tagline)}</p>
      <p class="pole-card__lore">${escapeHtml(p.lore)}</p>
      ${action}
    </div>
  </article>`;
}

export function poleUnlockStudioHtml(poles: FishingPole[]): string {
  const bodies = poles
    .map(
      (p) => `<article class="pole-unlock">
        <p class="pole-unlock__kicker">${p.icon} Tier ${p.tier} wakes</p>
        <h3 class="pole-unlock__name">${escapeHtml(p.name)}</h3>
        <p class="pole-unlock__tag">${escapeHtml(p.tagline)}</p>
        <p class="pole-unlock__lore">${escapeHtml(p.unlockLore)}</p>
        <p class="pole-unlock__body muted">${escapeHtml(p.lore)}</p>
        <button type="button" class="btn primary big" data-hub-action="equip_pole:${p.id}">Equip ${escapeHtml(p.name)} &amp; continue</button>
      </article>`,
    )
    .join("");
  return studioStageHtml(
    "The rack howls",
    bodies,
    "studio-stage--pole-unlock",
    `<button type="button" class="btn ghost big studio-continue" data-continue="renown">Keep the old grip</button>`,
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
    ${renderNoticeList(notices, "notice-list notice-list--ledger")}`,
    "studio-stage--ledger",
    `<div class="studio-hub-footer">
      <button type="button" class="btn ghost studio-link-btn" data-hub-action="hall_view">📺 Hall view</button>
      <button type="button" class="btn ghost studio-link-btn" data-hub-action="herald_scroll">Demplar on X — doom scroll ↓</button>
      <button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>
    </div>`,
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
    </section>`,
    "studio-stage--hall",
    `<div class="studio-hub-footer">
      <a class="btn ghost studio-link-btn" href="${escapeHtml(bigboardHref)}">Projector wall ↗</a>
      <button type="button" class="btn primary big studio-continue" data-hub-action="back:well">← Back to games</button>
    </div>`,
  );
}

export function heraldScrollStudioHtml(s: RunSnapshot, feed: XLoreFeed): string {
  void s;
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
    : `<p class="studio-lore-line studio-lore-line--hint">Wire is quiet for a breath — charter missives still ride the Ledger. Follow @DemplarOfficial on X, then pull again.</p>`;

  return studioStageHtml(
    "Overheard from X",
    `<p class="studio-stage-lead">Doom scroll neighbor lore — @DemplarOfficial live relay + charter wire. ${ally}</p>
    <p class="studio-lore-line studio-lore-line--hint">${heraldScrollMeta(feed, posts)}</p>
    <div class="studio-x-scroll" role="feed" aria-label="Relay of Demplar posts from X">${cards}</div>`,
    "studio-stage--herald",
    `<div class="studio-hub-footer">
      <a class="btn ghost studio-link-btn" href="https://x.com/DemplarOfficial" target="_blank" rel="noopener noreferrer">Follow on X</a>
      <button type="button" class="btn primary big studio-continue" data-continue="well">Back to the well</button>
    </div>`,
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
