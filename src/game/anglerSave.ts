/**
 * Per-name angler progress — localStorage vault + cookie for last bound name.
 * Charter night resets at 4am Pacific; prior nights archive in the vault.
 */

import type { Season } from "../content/lore";
import type { FoodId } from "../content/tavernNights";
import { charterDayId, formatCharterDayLabel, CHARTER_RESET_BLURB } from "./charterDay";
import { buildMoonwellDeck, shuffleDeck, type MoonwellCard } from "../minigames/moonwellDeck";
import { initialState } from "./state";
import type { GameState } from "./types";
import { normalizePoleProgress, type PoleProgress } from "./poleProgress";
import type { PoleId } from "../content/fishingPoles";

const VAULT_KEY = "moonwell_angler_vault";
const SAVE_VERSION = 3;
const COOKIE_NAME = "moonwell_name";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;
const ARCHIVE_MAX = 40;
const DAILY_TOKEN_STIPEND = 2;

export type CharterDayArchive = {
  dayId: string;
  closedAt: number;
  renown: number;
  tokens: number;
  catalog: string[];
  runCount: number;
};

type AnglerSaveV1 = {
  v: 1;
  nickname: string;
  season: Season;
  runCount: number;
  renown: number;
  tokens: number;
  titles: string[];
  catalog: string[];
  perilIndex: number;
  triviaIndex: number;
  feastsEaten: FoodId[];
  deckIds: string[];
  demplarBest?: number;
  updatedAt: number;
};

type AnglerSaveV2 = {
  v: 2;
  nickname: string;
  charterDayId: string;
  season: Season;
  runCount: number;
  renown: number;
  tokens: number;
  titles: string[];
  catalog: string[];
  perilIndex: number;
  triviaIndex: number;
  feastsEaten: FoodId[];
  deckIds: string[];
  demplarBest?: number;
  /** Sticky wall trophies — survive charter night rollover. */
  trophies?: Array<{
    id: string;
    fish: string;
    rarity: "mythic" | "omen";
    from: string;
    ts: number;
    charterNight?: string;
  }>;
  archive: CharterDayArchive[];
  updatedAt: number;
  /** Older vaults may already carry pole scratch — keep if present. */
  poleXp?: number;
  equippedPoleId?: PoleId;
  unlockedPoleIds?: PoleId[];
};

type AnglerSaveV3 = {
  v: 3;
  nickname: string;
  charterDayId: string;
  season: Season;
  runCount: number;
  renown: number;
  tokens: number;
  titles: string[];
  catalog: string[];
  perilIndex: number;
  triviaIndex: number;
  feastsEaten: FoodId[];
  deckIds: string[];
  demplarBest?: number;
  trophies?: Array<{
    id: string;
    fish: string;
    rarity: "mythic" | "omen";
    from: string;
    ts: number;
    charterNight?: string;
  }>;
  /** Sticky pole ecosystem — survives charter night. */
  poleXp: number;
  equippedPoleId: PoleId;
  unlockedPoleIds: PoleId[];
  archive: CharterDayArchive[];
  updatedAt: number;
};

export type AnglerSavePeek = {
  nickname: string;
  renown: number;
  tokens: number;
  catalogSize: number;
  titles: string[];
  trophyCount: number;
  charterNight: string;
  archiveCount: number;
  poleXp: number;
  equippedPoleId: PoleId;
  updatedAt: number;
};

const TROPHY_VAULT_MAX = 24;

type Vault = Record<string, AnglerSaveV1 | AnglerSaveV2 | AnglerSaveV3>;

function poleFieldsFrom(raw: { poleXp?: number; equippedPoleId?: PoleId; unlockedPoleIds?: PoleId[] }): PoleProgress {
  return normalizePoleProgress({
    poleXp: raw.poleXp,
    equippedPoleId: raw.equippedPoleId,
    unlockedPoleIds: raw.unlockedPoleIds,
  });
}

function nameKey(name: string): string {
  return name.trim().toLowerCase().slice(0, 28);
}

function cookiePath(): string {
  const base = import.meta.env.BASE_URL || "/";
  if (base === "/") return "/";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function readVault(): Vault {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Vault;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeVault(vault: Vault): void {
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  } catch {
    /* private mode / quota */
  }
}

function restoreDeck(savedIds: string[]): MoonwellCard[] {
  const all = buildMoonwellDeck();
  const pool = new Map(all.map((c) => [c.id, c]));
  const deck: MoonwellCard[] = [];
  for (const id of savedIds) {
    const card = pool.get(id);
    if (card) {
      deck.push(card);
      pool.delete(id);
    }
  }
  const rest = shuffleDeck([...pool.values()]);
  if (deck.length < 8) return shuffleDeck([...deck, ...rest]);
  return deck.length > 0 ? deck : shuffleDeck(buildMoonwellDeck());
}

function freshDeckIds(): string[] {
  return shuffleDeck(buildMoonwellDeck()).map((c) => c.id);
}

function migrateV1(v1: AnglerSaveV1): AnglerSaveV3 {
  const poles = normalizePoleProgress(null);
  return {
    v: 3,
    nickname: v1.nickname,
    charterDayId: charterDayId(),
    season: v1.season,
    runCount: v1.runCount,
    renown: v1.renown,
    tokens: v1.tokens,
    titles: [...v1.titles],
    catalog: [...v1.catalog],
    perilIndex: v1.perilIndex,
    triviaIndex: v1.triviaIndex,
    feastsEaten: [...v1.feastsEaten],
    deckIds: [...v1.deckIds],
    demplarBest: v1.demplarBest,
    ...poles,
    archive: [],
    updatedAt: v1.updatedAt,
  };
}

function migrateV2(v2: AnglerSaveV2): AnglerSaveV3 {
  const poles = poleFieldsFrom(v2);
  return {
    v: 3,
    nickname: v2.nickname,
    charterDayId: v2.charterDayId,
    season: v2.season,
    runCount: v2.runCount,
    renown: v2.renown,
    tokens: v2.tokens,
    titles: [...v2.titles],
    catalog: [...v2.catalog],
    perilIndex: v2.perilIndex,
    triviaIndex: v2.triviaIndex,
    feastsEaten: [...v2.feastsEaten],
    deckIds: [...v2.deckIds],
    demplarBest: v2.demplarBest,
    trophies: v2.trophies ? [...v2.trophies] : [],
    ...poles,
    archive: [...(v2.archive ?? [])],
    updatedAt: v2.updatedAt,
  };
}

function hadDailyActivity(save: AnglerSaveV3): boolean {
  return save.runCount > 0 || save.renown > 0 || save.catalog.length > 0 || save.tokens > DAILY_TOKEN_STIPEND;
}

function applyCharterRollover(save: AnglerSaveV3): AnglerSaveV3 {
  const today = charterDayId();
  if (save.charterDayId === today) return save;

  const archive = [...save.archive];
  if (hadDailyActivity(save)) {
    archive.unshift({
      dayId: save.charterDayId,
      closedAt: Date.now(),
      renown: save.renown,
      tokens: save.tokens,
      catalog: [...save.catalog],
      runCount: save.runCount,
    });
    if (archive.length > ARCHIVE_MAX) archive.length = ARCHIVE_MAX;
  }

  const poles = poleFieldsFrom(save);
  return {
    ...save,
    charterDayId: today,
    runCount: 0,
    renown: 0,
    tokens: DAILY_TOKEN_STIPEND,
    catalog: [],
    feastsEaten: [],
    perilIndex: 0,
    triviaIndex: 0,
    deckIds: freshDeckIds(),
    trophies: [...(save.trophies ?? [])],
    poleXp: poles.poleXp,
    equippedPoleId: poles.equippedPoleId,
    unlockedPoleIds: [...poles.unlockedPoleIds],
    archive,
    updatedAt: Date.now(),
  };
}

function normalizeSave(raw: AnglerSaveV1 | AnglerSaveV2 | AnglerSaveV3 | undefined): AnglerSaveV3 | null {
  if (!raw) return null;
  let save: AnglerSaveV3;
  if (raw.v === 1) save = migrateV1(raw);
  else if (raw.v === 2) save = migrateV2(raw);
  else if (raw.v === 3) {
    const poles = poleFieldsFrom(raw);
    save = {
      ...raw,
      archive: [...(raw.archive ?? [])],
      poleXp: poles.poleXp,
      equippedPoleId: poles.equippedPoleId,
      unlockedPoleIds: [...poles.unlockedPoleIds],
    };
  } else return null;
  return applyCharterRollover(save);
}

function prepareSave(name: string): AnglerSaveV3 | null {
  const key = nameKey(name);
  if (!key) return null;
  const vault = readVault();
  const raw = vault[key];
  const rolled = normalizeSave(raw);
  if (!rolled) return null;
  const prevDay = raw && raw.v === 2 ? raw.charterDayId : null;
  const needsWrite = !raw || raw.v !== SAVE_VERSION || prevDay !== rolled.charterDayId;
  if (needsWrite) {
    vault[key] = rolled;
    writeVault(vault);
  }
  return rolled;
}

export function formatCharterArchives(archive: CharterDayArchive[]): string[] {
  if (archive.length === 0) {
    return [CHARTER_RESET_BLURB];
  }
  const lines = archive
    .slice(0, 10)
    .map(
      (a) =>
        `${formatCharterDayLabel(a.dayId)} — ★${a.renown} · ◎${a.tokens} · ${a.catalog.length} species · ${a.runCount} runs`,
    );
  lines.push(CHARTER_RESET_BLURB);
  return lines;
}

export function peekAnglerSave(name: string): AnglerSavePeek | null {
  const save = prepareSave(name);
  if (!save) return null;
  return {
    nickname: save.nickname,
    renown: save.renown,
    tokens: save.tokens,
    catalogSize: save.catalog.length,
    titles: save.titles,
    trophyCount: save.trophies?.length ?? 0,
    charterNight: formatCharterDayLabel(save.charterDayId),
    archiveCount: save.archive.length,
    poleXp: save.poleXp,
    equippedPoleId: save.equippedPoleId,
    updatedAt: save.updatedAt,
  };
}

export function loadAnglerTrophies(name: string) {
  return prepareSave(name)?.trophies ?? [];
}

export function pinAnglerTrophy(
  name: string,
  trophy: {
    id: string;
    fish: string;
    rarity: "mythic" | "omen";
    from: string;
    ts: number;
    charterNight?: string;
  },
): void {
  const key = nameKey(name);
  if (!key) return;
  const vault = readVault();
  const existing = normalizeSave(vault[key]);
  if (!existing) return;
  const list = [...(existing.trophies ?? [])];
  if (list.some((t) => t.id === trophy.id || (t.fish === trophy.fish && t.from === trophy.from))) {
    return;
  }
  list.unshift(trophy);
  if (list.length > TROPHY_VAULT_MAX) list.length = TROPHY_VAULT_MAX;
  vault[key] = { ...existing, trophies: list, updatedAt: Date.now() };
  writeVault(vault);
}

export function loadAnglerArchives(name: string): CharterDayArchive[] {
  const save = prepareSave(name);
  return save?.archive ?? [];
}

export function loadAnglerState(name: string): GameState | null {
  const save = prepareSave(name);
  if (!save) return null;

  const base = initialState(save.nickname);
  const poles = poleFieldsFrom(save);
  return {
    ...base,
    phase: "enter",
    season: save.season,
    runCount: save.runCount,
    renown: save.renown,
    tokens: save.tokens,
    titles: [...save.titles],
    catalog: new Set(save.catalog),
    perilIndex: save.perilIndex,
    triviaIndex: save.triviaIndex,
    feastsEaten: [...save.feastsEaten],
    deck: restoreDeck(save.deckIds),
    nickname: save.nickname,
    demplarBest: save.demplarBest,
    poleXp: poles.poleXp,
    equippedPoleId: poles.equippedPoleId,
    unlockedPoleIds: [...poles.unlockedPoleIds],
  };
}

export function saveAnglerState(state: GameState): void {
  const key = nameKey(state.nickname);
  if (!key) return;

  const vault = readVault();
  const poles = normalizePoleProgress({
    poleXp: state.poleXp,
    equippedPoleId: state.equippedPoleId,
    unlockedPoleIds: state.unlockedPoleIds,
  });
  const existing = normalizeSave(vault[key]) ?? migrateV1({
    v: 1,
    nickname: state.nickname.trim().slice(0, 28),
    season: state.season,
    runCount: 0,
    renown: 0,
    tokens: DAILY_TOKEN_STIPEND,
    titles: [],
    catalog: [],
    perilIndex: 0,
    triviaIndex: 0,
    feastsEaten: [],
    deckIds: freshDeckIds(),
    updatedAt: Date.now(),
  });

  vault[key] = {
    ...existing,
    v: 3,
    nickname: state.nickname.trim().slice(0, 28),
    charterDayId: charterDayId(),
    season: state.season,
    runCount: state.runCount,
    renown: state.renown,
    tokens: state.tokens,
    titles: [...state.titles],
    catalog: [...state.catalog],
    perilIndex: state.perilIndex,
    triviaIndex: state.triviaIndex,
    feastsEaten: [...state.feastsEaten],
    deckIds: state.deck.map((c) => c.id),
    demplarBest: state.demplarBest,
    trophies: existing.trophies ?? [],
    poleXp: poles.poleXp,
    equippedPoleId: poles.equippedPoleId,
    unlockedPoleIds: [...poles.unlockedPoleIds],
    updatedAt: Date.now(),
  };
  writeVault(vault);
  rememberLastName(state.nickname);
}

export function rememberLastName(name: string): void {
  const trimmed = name.trim().slice(0, 28);
  if (!trimmed) return;
  try {
    const path = cookiePath();
    const enc = encodeURIComponent(trimmed);
    document.cookie = `${COOKIE_NAME}=${enc}; path=${path}; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    localStorage.setItem(COOKIE_NAME, trimmed);
  } catch {
    /* ignore */
  }
}

export function loadLastName(): string {
  try {
    const fromStorage = localStorage.getItem(COOKIE_NAME);
    if (fromStorage?.trim()) return fromStorage.trim().slice(0, 28);
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]).trim().slice(0, 28);
  } catch {
    return "";
  }
}
