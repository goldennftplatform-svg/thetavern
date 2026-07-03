import { demplarNotice } from "../content/lore";
import { pickLine, noticeBoardArcane } from "../content/arcaneLore";
import { tonightUtc } from "../content/tavernNights";
import { getXLoreFeed } from "../lore/xFeed";

export type NoticeKind = "rim" | "overheard" | "hall" | "tonight" | "archive";

export type NoticeEntry = {
  kind: NoticeKind;
  label: string;
  body: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripRimPrefix(text: string): string {
  return text.replace(/^⚔\s*rim notice:\s*/i, "").trim();
}

/** Hall + board notices — deduped, labeled for card layout. */
export function hallNoticeEntries(): NoticeEntry[] {
  const night = tonightUtc();
  const feed = getXLoreFeed();
  const seen = new Set<string>();
  const out: NoticeEntry[] = [];

  const push = (entry: NoticeEntry) => {
    const key = `${entry.kind}:${entry.body}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  };

  push({
    kind: "rim",
    label: "Rim notice",
    body: stripRimPrefix(demplarNotice),
  });

  const posts = feed?.posts ?? [];
  const shuffled = posts.slice().sort(() => Math.random() - 0.5);
  for (const p of shuffled.slice(0, 3)) {
    const t = p.text.length > 140 ? `${p.text.slice(0, 138)}…` : p.text;
    push({
      kind: "overheard",
      label: `@${p.handle.replace(/^@/, "")}`,
      body: t,
    });
  }

  push({ kind: "hall", label: "Hall whisper", body: pickLine(knightNoticeBoard) });
  push({ kind: "hall", label: "Moonwell", body: pickLine(noticeBoardArcane) });
  push({
    kind: "tonight",
    label: "Tonight",
    body: `${night.title} — ${night.tagline}`,
  });

  return out;
}

export function renderNoticeCardLi(entry: NoticeEntry): string {
  return `<li class="notice-card notice-card--${entry.kind}">
    <span class="notice-card__label">${escapeHtml(entry.label)}</span>
    <p class="notice-card__body">${escapeHtml(entry.body)}</p>
  </li>`;
}

export function renderNoticeList(
  entries: NoticeEntry[],
  listClass = "notice-list",
): string {
  if (!entries.length) return "";
  return `<ul class="${listClass}">${entries.map(renderNoticeCardLi).join("")}</ul>`;
}
