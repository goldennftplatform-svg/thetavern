/**
 * Persistent live chronicle rail in Play — Zemota-style chip + collapsible feed.
 */

import type { MobileHallSnapshot } from "../hall/mobileHall";
import { mobileHallFeedHtml } from "../hall/mobileHall";

const FEED_VISIBLE = 14;

let expanded = true;
let boardHref = "bigboard.html";

let elPanel: HTMLElement | null = null;
let elChip: HTMLButtonElement | null = null;
let elBody: HTMLElement | null = null;
let elList: HTMLElement | null = null;
let elPatrons: HTMLElement | null = null;
let elMeta: HTMLElement | null = null;
let elBoardLink: HTMLAnchorElement | null = null;

function deedKey(d: { ts?: number; from?: string; chronicle?: string; text?: string; kind?: string }): string {
  return `${d.ts ?? 0}|${d.from ?? ""}|${d.chronicle ?? ""}|${d.text ?? ""}|${d.kind ?? ""}`;
}

export function mountPlayLiveFeed(href: string): void {
  boardHref = href;
  elPanel = document.getElementById("play-live-feed");
  elChip = document.getElementById("play-live-chip") as HTMLButtonElement | null;
  elBody = document.getElementById("play-live-feed-body");
  elList = document.getElementById("play-live-feed-list");
  elPatrons = document.getElementById("play-live-feed-patrons");
  elMeta = document.getElementById("play-live-feed-meta");
  elBoardLink = document.getElementById("play-live-feed-board") as HTMLAnchorElement | null;

  if (elBoardLink) elBoardLink.href = href;

  elPanel?.querySelector<HTMLButtonElement>(".play-live-feed__head")?.addEventListener("click", () => {
    expanded = !expanded;
    elPanel?.classList.toggle("play-live-feed--collapsed", !expanded);
  });

  elChip?.addEventListener("click", () => {
    expanded = true;
    elPanel?.classList.remove("play-live-feed--collapsed");
    elPanel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

export function setPlayLiveFeedExpanded(open: boolean): void {
  expanded = open;
  elPanel?.classList.toggle("play-live-feed--collapsed", !open);
}

export function renderPlayLiveFeed(snap: MobileHallSnapshot, latestDeedKey?: string): void {
  if (!elPanel) return;

  const patronN = snap.patrons.length;
  const live = snap.live;
  const status = live
    ? patronN > 0
      ? `${patronN} at the table`
      : "Live hall"
    : "Solo preview";

  elPanel.classList.toggle("play-live-feed--off", !live);
  elPanel.hidden = false;

  if (elMeta) elMeta.textContent = status;

  if (elPatrons) {
    elPatrons.innerHTML = snap.patrons.length
      ? `<strong>Great Table</strong> ${snap.patrons.map((n) => escapeHtml(n)).join(" · ")}`
      : `<strong>Great Table</strong> empty — cast to take a seat.`;
  }

  if (elList) {
    const slice = snap.deeds.slice(0, FEED_VISIBLE);
    const html = mobileHallFeedHtml(slice);
    if (elList.innerHTML !== html) elList.innerHTML = html;
    markPlayLiveFeedDeeds(slice);
    if (latestDeedKey) {
      const hit = elList.querySelector(`[data-deed-key="${CSS.escape(latestDeedKey)}"]`);
      hit?.classList.add("mobile-hall-deed--fresh");
      window.setTimeout(() => hit?.classList.remove("mobile-hall-deed--fresh"), 3500);
    }
  }

  if (elChip) {
    elChip.hidden = false;
    elChip.classList.toggle("play-live-chip--off", !live);
    elChip.innerHTML = `<span class="play-live-chip__dot" aria-hidden="true"></span><span>${patronN || (live ? "●" : "○")}</span>`;
    elChip.title = live ? `Live hall · ${patronN} patron${patronN === 1 ? "" : "s"}` : "Hall offline — solo play";
  }

  elPanel.classList.toggle("play-live-feed--collapsed", !expanded);
}

export function markPlayLiveFeedDeeds(deeds: MobileHallSnapshot["deeds"]): string | undefined {
  if (!elList) return undefined;
  const keys = deeds.slice(0, FEED_VISIBLE).map(deedKey);
  elList.querySelectorAll<HTMLElement>(".mobile-hall-deed").forEach((row, i) => {
    const k = keys[i];
    if (k) row.dataset.deedKey = k;
  });
  return keys[0];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
