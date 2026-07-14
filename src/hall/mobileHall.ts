/**
 * In-play hall view — live chronicle + leaderboard + assets for mobile (mirrors bigboard feed).
 */

import type { Socket } from "socket.io-client";
import { renderFeedCardsHtml } from "../bigboard/bbFeedCards";
import { bbIconForKind } from "../bigboard/bbIcons";
import type { Deed } from "../bigboard/chronicleDirector.types";
import {
  bumpLeaderboardRow,
  initHallLeaderboard,
  persistHallLeaderboard,
  sortLeaderboard,
  topLeaderboard,
  type LeaderboardRow,
} from "../bigboard/hallLeaderboard";
import { charterDayId, formatCharterDayLabel } from "../game/charterDay";
import {
  formatPatronCaption,
  type HallPatronIdentity,
  type HallStakeSnap,
  type HallTrophy,
} from "./hallAssets";

export type MobileHallSnapshot = {
  live: boolean;
  patrons: HallPatronIdentity[];
  deeds: Deed[];
  leaderboard: LeaderboardRow[];
  trophies: HallTrophy[];
  stakes: HallStakeSnap[];
  charterNight: string;
};

const FEED_MAX = 28;
const LB_CAP = 6;
const TROPHY_CAP = 8;
const STAKE_CAP = 8;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deedMain(d: Deed): string {
  if (d.chronicle) {
    const tail = d.renown ? ` ★${d.renown}` : "";
    const stake =
      typeof d.stake === "number" && d.stake > 0 ? ` · ◎${d.stake}` : "";
    return `${d.chronicle}${tail}${stake}`;
  }
  const who = d.from ?? "A patron";
  if (d.kind === "catch" && d.fish) {
    return `${who} landed ${d.fish}${d.rarity ? ` (${d.rarity})` : ""}`;
  }
  if (d.text) return `${who}: ${d.text}`;
  return `${who} did a deed worth telling.`;
}

function deedKey(d: Deed): string {
  return `${d.ts ?? 0}|${d.from ?? ""}|${d.chronicle ?? ""}|${d.text ?? ""}|${d.kind ?? ""}`;
}

function deedRowHtml(d: Deed): string {
  const cards =
    d.cards && d.cards.length > 0 ? renderFeedCardsHtml(d.cards, d.outcome) : "";
  const sub = d.text && d.chronicle ? `<p class="mobile-hall-deed-sub">${escapeHtml(d.text)}</p>` : "";
  let cls = "mobile-hall-deed";
  if (d.kind === "gamble" && d.outcome === "win") cls += " mobile-hall-deed--win";
  if (d.kind === "gamble" && d.outcome === "lose") cls += " mobile-hall-deed--lose";
  if (d.kind === "demplar") cls += " mobile-hall-deed--demplar";
  return `<article class="${cls}" data-deed-key="${escapeHtml(deedKey(d))}">
    ${bbIconForKind(d.kind)}
    <div class="mobile-hall-deed-body">
      <p class="mobile-hall-deed-main">${escapeHtml(deedMain(d))}</p>
      ${sub}${cards}
    </div>
  </article>`;
}

export function mobileHallFeedHtml(deeds: Deed[]): string {
  if (!deeds.length) {
    return `<p class="mobile-hall-empty">Chronicle waits — cast, wager, or run the Warrior trials. Deeds chalk here live.</p>`;
  }
  return deeds.map(deedRowHtml).join("");
}

export function mobileHallLeaderboardHtml(rows: LeaderboardRow[]): string {
  const top = topLeaderboard(rows, LB_CAP);
  if (!top.length) {
    return `<p class="mobile-hall-empty mobile-hall-empty--lb">★ scores appear as patrons play tonight.</p>`;
  }
  return `<ol class="mobile-hall-lb" aria-label="Charter leaderboard">
    ${top
      .map(
        (r, i) => `<li class="mobile-hall-lb-row${i === 0 ? " mobile-hall-lb-row--top" : ""}">
          <span class="mobile-hall-lb-rank">${i + 1}</span>
          <span class="mobile-hall-lb-name">${escapeHtml(r.name)}</span>
          <span class="mobile-hall-lb-score">★${r.renown}</span>
        </li>`,
      )
      .join("")}
  </ol>`;
}

export function mobileHallTrophiesHtml(trophies: HallTrophy[]): string {
  if (!trophies.length) {
    return `<p class="mobile-hall-empty">Land a mythic or omen catch — it pins to the trophy rail.</p>`;
  }
  return `<div class="mobile-hall-chips" aria-label="Trophy rail">${trophies
    .slice(0, TROPHY_CAP)
    .map(
      (t) =>
        `<span class="mobile-hall-chip mobile-hall-chip--${t.rarity}"><strong>${t.rarity === "mythic" ? "Mythic" : "Omen"}</strong> ${escapeHtml(t.fish)} <em>${escapeHtml(t.from)}</em></span>`,
    )
    .join("")}</div>`;
}

export function mobileHallStakesHtml(stakes: HallStakeSnap[]): string {
  if (!stakes.length) {
    return `<p class="mobile-hall-empty">Wager or feast — ◎ stakes chalk for the table.</p>`;
  }
  return `<div class="mobile-hall-chips" aria-label="Table money">${stakes
    .slice(0, STAKE_CAP)
    .map(
      (s) =>
        `<span class="mobile-hall-chip mobile-hall-chip--${s.kind}"><strong>◎${s.stake}</strong> ${escapeHtml(s.from)} · ${escapeHtml(s.label)}${typeof s.tokensLeft === "number" ? ` · left ◎${s.tokensLeft}` : ""}</span>`,
    )
    .join("")}</div>`;
}

export type MobileHall = {
  bindSocket: (socket: Socket | null) => void;
  pushLocalDeed: (deed: Deed) => void;
  snapshot: () => MobileHallSnapshot;
};

export function createMobileHall(opts?: { onUpdate?: () => void }): MobileHall {
  let patrons: HallPatronIdentity[] = [];
  let deeds: Deed[] = [];
  let trophies: HallTrophy[] = [];
  let stakes: HallStakeSnap[] = [];
  let live = false;
  let bound: Socket | null = null;
  const seen = new Set<string>();

  const lbBoot = initHallLeaderboard();
  let lbDayId = lbBoot.dayId;
  let lbRows = lbBoot.rows;

  function syncDay() {
    const today = charterDayId();
    if (lbDayId !== today) {
      lbDayId = today;
      lbRows = [];
      seen.clear();
      persistHallLeaderboard(lbDayId, lbRows);
    }
  }

  function ingestTrophyFromDeed(d: Deed) {
    if (d.kind !== "catch" || (d.rarity !== "mythic" && d.rarity !== "omen") || !d.fish || !d.from) {
      return;
    }
    const t: HallTrophy = {
      id: `${d.from}|${d.fish}|${d.ts ?? Date.now()}`,
      fish: d.fish,
      rarity: d.rarity,
      from: d.from,
      ts: d.ts ?? Date.now(),
      charterNight: d.charterNight,
    };
    if (trophies.some((x) => x.id === t.id)) return;
    trophies = [t, ...trophies].slice(0, 24);
  }

  function ingestStakeFromDeed(d: Deed) {
    if ((d.kind !== "gamble" && d.kind !== "feast") || typeof d.stake !== "number" || !d.from) {
      return;
    }
    if (d.stake <= 0) return;
    const s: HallStakeSnap = {
      from: d.from,
      kind: d.kind === "feast" ? "feast" : "chance",
      label:
        d.kind === "feast"
          ? d.food ?? "Kitchen"
          : d.game === "red_black"
            ? "Red/Black"
            : d.game === "high_low"
              ? "Hi-Lo"
              : "Chance",
      stake: d.stake,
      tokensLeft: d.tokensLeft,
      ts: d.ts ?? Date.now(),
    };
    stakes = [s, ...stakes].slice(0, 16);
  }

  function ingest(d: Deed, skipDedup = false) {
    syncDay();
    const key = deedKey(d);
    if (!skipDedup && seen.has(key)) return;
    seen.add(key);

    deeds.unshift({ ...d, ts: d.ts ?? Date.now() });
    if (deeds.length > FEED_MAX) {
      deeds.length = FEED_MAX;
      seen.clear();
      for (const item of deeds) seen.add(deedKey(item));
    }
    lbRows = bumpLeaderboardRow(lbRows, d);
    persistHallLeaderboard(lbDayId, lbRows);
    ingestTrophyFromDeed(d);
    ingestStakeFromDeed(d);
    opts?.onUpdate?.();
  }

  function hydrateSync(list: Deed[]) {
    syncDay();
    deeds = [];
    seen.clear();
    lbRows = [];
    for (const d of [...list].reverse()) {
      const item = { ...d, ts: d.ts ?? Date.now() };
      seen.add(deedKey(item));
      deeds.unshift(item);
      lbRows = bumpLeaderboardRow(lbRows, item);
      ingestTrophyFromDeed(item);
      ingestStakeFromDeed(item);
    }
    if (deeds.length > FEED_MAX) deeds.length = FEED_MAX;
    persistHallLeaderboard(lbDayId, lbRows);
    opts?.onUpdate?.();
  }

  function bindSocket(socket: Socket | null) {
    if (bound) {
      bound.off("hall:deed");
      bound.off("hall:deed:sync");
      bound.off("hall:trophy");
      bound.off("hall:trophy:sync");
      bound.off("hall:stake");
      bound.off("hall:stake:sync");
      bound.off("moonwell:patrons");
      bound.off("connect");
      bound.off("disconnect");
    }
    bound = socket;
    if (!socket) {
      live = false;
      opts?.onUpdate?.();
      return;
    }
    live = socket.connected;
    socket.on("connect", () => {
      live = true;
      socket.emit("hall:deed:request");
      opts?.onUpdate?.();
    });
    socket.on("disconnect", () => {
      live = false;
      opts?.onUpdate?.();
    });
    socket.on("hall:deed:sync", (list: Deed[]) => {
      if (Array.isArray(list) && list.length > 0) hydrateSync(list);
      else opts?.onUpdate?.();
    });
    socket.on("hall:deed", (d: Deed) => ingest(d));
    socket.on("hall:trophy:sync", (list: HallTrophy[]) => {
      if (!Array.isArray(list)) return;
      trophies = list.slice(0, 24);
      opts?.onUpdate?.();
    });
    socket.on("hall:trophy", (t: HallTrophy) => {
      if (!trophies.some((x) => x.id === t.id)) {
        trophies = [t, ...trophies].slice(0, 24);
        opts?.onUpdate?.();
      }
    });
    socket.on("hall:stake:sync", (list: HallStakeSnap[]) => {
      if (!Array.isArray(list)) return;
      stakes = list.slice(0, 16);
      opts?.onUpdate?.();
    });
    socket.on("hall:stake", (s: HallStakeSnap) => {
      stakes = [s, ...stakes].slice(0, 16);
      opts?.onUpdate?.();
    });
    socket.on("moonwell:patrons", (p: { patrons: HallPatronIdentity[] }) => {
      patrons = (p.patrons ?? []).map((x) => ({
        name: x.name,
        title: x.title,
        catalogSize: x.catalogSize,
        tokens: x.tokens,
      }));
      opts?.onUpdate?.();
    });
  }

  return {
    bindSocket,
    pushLocalDeed: (d) => ingest(d, true),
    snapshot: () => {
      syncDay();
      return {
        live,
        patrons: [...patrons],
        deeds: [...deeds],
        leaderboard: sortLeaderboard(lbRows),
        trophies: [...trophies],
        stakes: [...stakes],
        charterNight: formatCharterDayLabel(lbDayId),
      };
    },
  };
}
