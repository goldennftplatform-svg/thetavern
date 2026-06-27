import { charterDayId } from "../game/charterDay";
import type { Deed } from "./chronicleDirector.types";

export type LeaderboardRow = {
  name: string;
  renown: number;
  deeds: number;
  lastTs: number;
};

type LeaderboardStore = {
  v: 1;
  dayId: string;
  rows: LeaderboardRow[];
};

const KEY = "moonwell_hall_leaderboard";
const MAX_ROWS = 24;

function readStore(): LeaderboardStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { v: 1, dayId: charterDayId(), rows: [] };
    const parsed = JSON.parse(raw) as LeaderboardStore;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.rows)) {
      return { v: 1, dayId: charterDayId(), rows: [] };
    }
    return {
      v: 1,
      dayId: parsed.dayId ?? charterDayId(),
      rows: parsed.rows.filter((r) => r && typeof r.name === "string"),
    };
  } catch {
    return { v: 1, dayId: charterDayId(), rows: [] };
  }
}

function writeStore(store: LeaderboardStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function initHallLeaderboard(): { dayId: string; rows: LeaderboardRow[] } {
  const today = charterDayId();
  let store = readStore();
  if (store.dayId !== today) {
    store = { v: 1, dayId: today, rows: [] };
    writeStore(store);
  }
  return { dayId: store.dayId, rows: store.rows };
}

export function persistHallLeaderboard(dayId: string, rows: LeaderboardRow[]): void {
  writeStore({ v: 1, dayId, rows: rows.slice(0, MAX_ROWS) });
}

export function bumpLeaderboardRow(rows: LeaderboardRow[], deed: Deed): LeaderboardRow[] {
  const name = deed.from?.trim();
  if (!name) return rows;

  const ts = deed.ts ?? Date.now();
  const gain = (deed.renown ?? 0) + (typeof deed.score === "number" ? Math.floor(deed.score / 500) : 0);
  const idx = rows.findIndex((r) => r.name === name);
  const next =
    idx >= 0
      ? {
          ...rows[idx]!,
          renown: rows[idx]!.renown + gain,
          deeds: rows[idx]!.deeds + 1,
          lastTs: ts,
        }
      : { name, renown: gain, deeds: 1, lastTs: ts };

  const out = idx >= 0 ? rows.map((r, i) => (i === idx ? next : r)) : [...rows, next];
  return sortLeaderboard(out).slice(0, MAX_ROWS);
}

export function sortLeaderboard(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => b.renown - a.renown || b.deeds - a.deeds || b.lastTs - a.lastTs);
}

export function topLeaderboard(rows: LeaderboardRow[], cap: number): LeaderboardRow[] {
  return sortLeaderboard(rows).slice(0, cap);
}
