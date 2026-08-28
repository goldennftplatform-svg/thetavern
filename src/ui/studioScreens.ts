import { warriorCompleteLines } from "../content/demplarKnights";
import { pickLine } from "../content/arcaneLore";
import type { Season } from "../content/lore";
import type { CatchResult } from "../game/types";
import type { DemplarRunResult } from "../minigames/demplarWarrior";
import type { BouyResult } from "../minigames/conflicBouy";
import type { FoodId } from "../content/tavernNights";
import { FISHING_POLES, type FishingPole, type PoleId } from "../content/fishingPoles";
import { nextPoleUnlock } from "../content/fishingPoles";
import { MOONWELL_DECK_LORE } from "../minigames/moonwellDeck";
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
  hubTableSeatHtml,
  hubTileHtml,
  studioStageHtml,
} from "./tavernHub";
import { avatarFaceHtml, avatarLabel, houseAvatarPickerHtml } from "./avatarFace";
import type { HouseAvatarId } from "../content/houseAvatars";
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
  const tableBg = `${import.meta.env.BASE_URL}media/tavern-table-bg.png`;
  const titleLine =
    s.titles.length > 0
      ? `<p class="tavern-table-scene__titles">${escapeHtml(s.titles.slice(-2).join(" · "))}</p>`
      : "";
  const crest = crestSrc
    ? `<img class="tavern-table__crest" src="${escapeHtml(crestSrc)}" alt="" />`
    : "";
  const poleLine = poleHint
    ? `<p class="tavern-table-scene__pole">${escapeHtml(poleHint)}</p>`
    : "";
  const face = avatarFaceHtml(s.avatarId, s.avatarCustom, {
    size: "md",
    className: "tavern-table-scene__avatar",
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
      : `<p class="tavern-table-scene__lore tavern-table-scene__lore--wire"><button type="button" class="btn ghost" data-hub-action="herald_scroll">⚔ Neighbor lore / X wire ↓</button></p>`;

  const conflicBouyIcon = `<svg viewBox="0 0 32 32" role="img" aria-label="Anchor">
    <path d="M14 4a2 2 0 1 1 4 0a2 2 0 0 1-4 0Zm1 4h2v14.7c3.9-.4 6.7-2.5 8-6.2l-3.2.8-.5-2.1 6.7-1.7-.2 7-2.2-.1.1-1.3c-1.8 4.2-5.1 6.5-9.7 6.5s-7.9-2.3-9.7-6.5l.1 1.3-2.2.1-.2-7 6.7 1.7-.5 2.1-3.2-.8c1.3 3.7 4.1 5.8 8 6.2V8Z" fill="currentColor"/>
  </svg>`;

  return `<div class="tavern-table-scene" style="--table-bg: url('${tableBg}')">
    <div class="tavern-table-scene__veil" aria-hidden="true"></div>
    <header class="tavern-table-scene__head">
      <p class="tavern-table-scene__kicker">Tavern night · ${escapeHtml(charterNight)} <small>(resets 4am PT)</small></p>
      <h2 class="tavern-table-scene__title">The Great Table</h2>
      <p class="tavern-table-scene__night">${escapeHtml(nightTitle)}</p>
      <p class="tavern-table-scene__tag">${escapeHtml(nightTagline)}</p>
    </header>

    <div class="tavern-table-scene__identity">
      ${face}
      <div class="tavern-table-scene__stats" aria-label="Your run">
        <span class="tavern-table-scene__stat"><em>★</em> ${s.renown} <small>Legend</small></span>
        <span class="tavern-table-scene__stat"><em>◎</em> ${s.tokens} <small>Tokens</small></span>
        <span class="tavern-table-scene__stat"><em>🐟</em> ${s.catalogSize} <small>Caught</small></span>
        <span class="tavern-table-scene__name">${escapeHtml(s.nickname)} · ${escapeHtml(s.seasonName)}</span>
      </div>
    </div>
    ${titleLine}
    ${poleLine}

    <div class="tavern-table-wrap">
      <div class="tavern-table" id="hub-grid" role="group" aria-label="Pick an adventure">
        <div class="tavern-table__well" aria-hidden="true">
          <span class="tavern-table__well-glow"></span>
          ${crest}
          <span class="tavern-table__well-label">☽ Moonwell</span>
          <span class="tavern-table__well-hint">Pick what&apos;s in front of you</span>
        </div>
        ${hubTableSeatHtml("fish", "🎣", "Cast the Well", "Fish for renown & pole XP", "north", "gold")}
        ${hubTableSeatHtml("demplar_warrior", "🕹", "Back-Room Arcade", "Sprint · stack · cure", "east", "gold")}
        ${hubTableSeatHtml("conflic_bouy_entry", conflicBouyIcon, "Conflic Bouy", "Fleet tactics · 5 waters", "northeast", "gold", "NEW")}
        ${hubTableSeatHtml("chance_menu", "🃏", "Divination Cards", "Hi-Lo & Red / Black", "south", "jade")}
        ${hubTableSeatHtml("pole_rack", "🪓", "Pole Rack", "Equip wilder rods", "west", "jade")}
        <span class="tavern-table__candle tavern-table__candle--a" aria-hidden="true"></span>
        <span class="tavern-table__candle tavern-table__candle--b" aria-hidden="true"></span>
        <span class="tavern-table__candle tavern-table__candle--c" aria-hidden="true"></span>
      </div>
    </div>

    <p class="tavern-table-scene__verse">${escapeHtml(s.seasonVerse)}</p>
    <p class="tavern-table-scene__lore">${escapeHtml(hubVerse)}</p>
    <p class="tavern-table-scene__lore tavern-table-scene__lore--extra">${escapeHtml(extraLore)}</p>
    ${wire}

    <footer class="tavern-table-scene__footer">
      <button type="button" class="btn ghost tavern-table-scene__link" data-hub-action="avatar_closet">☺ Face</button>
      <button type="button" class="btn ghost tavern-table-scene__link" data-hub-action="hall_view">📺 Hall view</button>
      <button type="button" class="btn ghost tavern-table-scene__link" data-hub-action="feast_menu">🍖 Kitchen</button>
      <button type="button" class="btn ghost tavern-table-scene__link" data-hub-action="ledger">Ledger</button>
      <button type="button" class="btn primary tavern-table-scene__link" data-hub-action="herald_scroll">⚔ Neighbor lore ↓</button>
      <button type="button" class="btn ghost tavern-table-scene__link" data-hub-action="charter">Rim notice</button>
    </footer>
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
    `<p class="studio-flourish">${escapeHtml(pickLine(warriorCompleteLines))}</p>
    <p class="studio-lore-line studio-lore-line--hint">Three back-room trials — scores on the tavern wall.</p>
    <div class="studio-scoreboard studio-scoreboard--demplar">
      <span class="studio-stat"><em>I</em> ${r.platform} <small>Run</small></span>
      <span class="studio-stat"><em>II</em> ${r.race} <small>Tetris</small></span>
      <span class="studio-stat"><em>III</em> ${r.asteroids} <small>Dr Mario</small></span>
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
  mode: "agent" | "hotseat",
): string {
  const isVictory = r.winner === "player" || r.winner === "player1";
  const accuracy = r.playerHits + r.playerMisses > 0
    ? Math.round((r.playerHits / (r.playerHits + r.playerMisses)) * 100)
    : 0;
  const modeLabel = mode === "agent" ? "vs AGENT" : "1v1 HOTSEAT";
  const resultLabel = isVictory ? "VICTORY" : "DEFEAT";
  const resultColor = isVictory ? "#68e8a8" : "#e87850";
  const flashClass = isVictory ? "bouy-victory-flash--victory" : "bouy-victory-flash--defeat";
  const tagline = isVictory
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
    ? `<div class="studio-panel studio-panel--mine">
        <p class="studio-lore-line studio-lore-line--hint" style="margin-bottom:6px;">⛏ MINE THE BLOCK — claim settled</p>
        <div class="studio-scoreboard studio-scoreboard--mine">
          <span class="studio-stat"><em>🔍</em> ${mineStats!.scansUsed} <small>Scans</small></span>
          <span class="studio-stat"><em>🪨</em> ${mineStats!.oreFound} <small>Ore</small></span>
          <span class="studio-stat"><em>💰</em> ${mineStats!.payNodesHit} <small>Paydays</small></span>
          <span class="studio-stat"><em>🧱</em> ${mineStats!.blocksMined} <small>Blocks</small></span>
        </div>
        <p class="studio-reward" style="margin:8px 0 0;">Pool fed ${mineStats!.poolContributed} ◎ · 95% back → <span style="color:#e0c060;">+${mine.payout} ◎ miner</span><span style="opacity:0.7;"> · ${mine.poolAfter} ◎ remaining</span></p>
        <p class="studio-lore-line studio-lore-line--hint" style="margin-top:4px;">Burn to earn — mine more, the pool deepens, payouts grow.</p>
      </div>`
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
      <button type="button" class="btn primary big studio-continue" data-hub-action="conflic_bouy">⚓ Play Again (Same Mode)</button>
      <button type="button" class="btn ghost big studio-continue" data-hub-action="conflic_bouy_change">🔄 Change Mode/Theme</button>
      <button type="button" class="btn ghost big studio-continue" data-continue="well">Back to the Well</button>
    </div>`,
  );
}

export function conflicThemePickStudioHtml(): string {
  // First screen: choose mode, then theme
  const modeTiles = [
    { icon: "🤖", label: "vs AGENT", desc: "Battle Captain Jack Sparrow", mode: "agent" },
    { icon: "👥", label: "1v1 HOTSEAT", desc: "Pass & play with a friend", mode: "hotseat" },
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
  return studioStageHtml(
    "Divination Table",
    `<p class="studio-lore-line">${escapeHtml(intro)}</p>
    <p class="studio-lore-line studio-lore-line--hint">${escapeHtml(MOONWELL_DECK_LORE)}</p>
    <div class="hub-grid hub-grid--tiles hub-grid--studio" id="hub-grid">
      ${hubTileHtml("▲", "Hi-Lo", "chance:high_low", "gold")}
      ${hubTileHtml("◆", "Red / Black", "chance:red_black", "jade")}
    </div>`,
    "studio-stage--pick",
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
