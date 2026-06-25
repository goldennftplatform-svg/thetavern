/**
 * Per-name angler progress — localStorage vault + cookie for last bound name.
 */

import type { Season } from "../content/lore";
import type { FoodId } from "../content/tavernNights";
import { buildMoonwellDeck, shuffleDeck, type MoonwellCard } from "../minigames/moonwellDeck";
import { initialState } from "./state";
import type { GameState } from "./types";

const VAULT_KEY = "moonwell_angler_vault";
const SAVE_VERSION = 1;
const COOKIE_NAME = "moonwell_name";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~400 days

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
  updatedAt: number;
};

export type AnglerSavePeek = {
  nickname: string;
  renown: number;
  tokens: number;
  catalogSize: number;
  titles: string[];
  updatedAt: number;
};

type Vault = Record<string, AnglerSaveV1>;

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

export function peekAnglerSave(name: string): AnglerSavePeek | null {
  const key = nameKey(name);
  if (!key) return null;
  const save = readVault()[key];
  if (!save || save.v !== SAVE_VERSION) return null;
  return {
    nickname: save.nickname,
    renown: save.renown,
    tokens: save.tokens,
    catalogSize: save.catalog.length,
    titles: save.titles,
    updatedAt: save.updatedAt,
  };
}

export function loadAnglerState(name: string): GameState | null {
  const key = nameKey(name);
  if (!key) return null;
  const save = readVault()[key];
  if (!save || save.v !== SAVE_VERSION) return null;

  const base = initialState(save.nickname);
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
  };
}

export function saveAnglerState(state: GameState): void {
  const key = nameKey(state.nickname);
  if (!key) return;

  const vault = readVault();
  vault[key] = {
    v: SAVE_VERSION,
    nickname: state.nickname.trim().slice(0, 28),
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
