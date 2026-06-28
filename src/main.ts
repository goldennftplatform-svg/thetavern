/**
 * Moonwell tavern loop — implementation map (fishing as spine):
 * - Phases `enter` → `herald` → `well` frame the ritual; most returns land on `well`.
 * - `fish_cast` / `fish_wait` / `fish_reel` reuse the shared canvas (`drawMoonwell`) plus large touch targets.
 * - `resolve` / `renown` apply catalog + renown; `peril` + `trivia` are existing “slots” between casts.
 * - Socket.IO `hall:announce_deed` mirrors bigboard feed; `moonwell:presence` marks who stands at the well.
 */
import {
  GAME_TITLE,
  creditsLine,
  demplarModalIntro,
  demplarNotice,
  fishCatalog,
  heraldLines,
  perilBeats,
  triviaWell,
} from "./content/lore";
import {
  pickLine,
  noticeBoardArcane,
  chanceTableIntro,
  feastIntro,
  hubVerse,
  hubLoreLines,
  renownTitleHint,
  resolveFlourish,
  seasonArcane,
} from "./content/arcaneLore";
import { composeCatchDeed, composeDemplarDeed, composeFeastDeed, composeGambleDeed, composePerilDeed, composeRenownDeed, composeTriviaDeed, crossedRenownMilestones } from "./content/deedLore";
import type { FoodBuff } from "./game/types";
import { foodItem, tonightUtc, type FoodId } from "./content/tavernNights";
import { initialState } from "./game/state";
import {
  loadAnglerState,
  loadLastName,
  peekAnglerSave,
  rememberLastName,
  saveAnglerState,
  loadAnglerArchives,
  formatCharterArchives,
} from "./game/anglerSave";
import type { CatchResult, GamePhase, GameState } from "./game/types";
import { drawMoonwell, seasonTints } from "./minigames/fishingCanvas";
import { rollCatch } from "./minigames/fishing";
import {
  CHANCE_GAMES,
  resolveHighLow,
  resolveOverUnder,
  rollOverUnderTarget,
  type ChanceGameId,
} from "./minigames/chance";
import { buildMoonwellDeck, shuffleDeck } from "./minigames/moonwellDeck";
import { loadDailyMediaTheme } from "./media/loadTheme";
import type { LoadedMediaTheme } from "./media/types";
import {
  DemplarWarrior,
  renownFromDemplarScore,
  tokensFromDemplarScore,
  type DemplarRunResult,
} from "./minigames/demplarWarrior";
import { connectTrail } from "./net/trailClient";
import { resolveTrailServerUrl } from "./net/trailResolve";
import type { Socket } from "socket.io-client";
import { initMobileShellClass } from "./mobile-detect";
import { bindHallMusicGestures, playCatchFanfare, primeHallMusic } from "./audio/hallMusic";
import { primeWarriorSfx } from "./audio/warriorSfx";
import { demplarEpigraphs, knightNoticeBoard } from "./content/demplarKnights";
import { charterDayId, formatCharterDayLabel } from "./game/charterDay";
import { createMobileHall } from "./hall/mobileHall";
import { getXLoreFeed, loadXLoreFeed } from "./lore/xFeed";
import {
  chanceHighLowHtml,
  chanceOverUnderHtml,
  hubBackHtml,
} from "./ui/tavernHub";
import {
  catchResolveHtml,
  chancePickStudioHtml,
  chanceResultStudioHtml,
  demplarResultStudioHtml,
  feastStudioHtml,
  hubWellHtml,
  heraldScrollStudioHtml,
  ledgerStudioHtml,
  mobileHallStudioHtml,
  perilStudioHtml,
  renownStudioHtml,
  triviaStudioHtml,
  triviaTeachHtml,
  type RunSnapshot,
} from "./ui/studioScreens";

initMobileShellClass();
bindHallMusicGestures();
primeHallMusic();

const boardMq = window.matchMedia("(min-width: 800px)");
function syncBoardDetails() {
  const boardWrap = document.querySelector<HTMLDetailsElement>(".play-board-wrap");
  if (boardWrap) boardWrap.open = boardMq.matches;
}
boardMq.addEventListener("change", syncBoardDetails);
syncBoardDetails();
document.documentElement.classList.add("gate-open");

const PLAY_HINT = {
  cast: "Hold ↓ release to cast",
  wait: "STRIKE when it bites",
  reel: "Hold SLACK / HEAVE — fill the bar",
} as const;

const SEASON_TAG: Record<string, string> = {
  frost: "❄",
  bloom: "🌸",
  ember: "🔥",
  void: "✦",
};

let autoPhaseTimer = 0;
let toastTimer = 0;
let stageBanner = "";

function clearAutoPhase() {
  if (autoPhaseTimer) window.clearTimeout(autoPhaseTimer);
  autoPhaseTimer = 0;
}

function clearFishingTimers() {
  window.cancelAnimationFrame(rafCast);
  window.cancelAnimationFrame(reelRaf);
  window.clearTimeout(biteTimer);
  window.clearTimeout(biteOpenTimer);
  window.clearTimeout(reelFailsafeTimer);
  window.clearTimeout(waitFailsafeTimer);
  reelHoldDir = 0;
  reelFinishing = false;
}

function fishingBanner(msg: string) {
  stageBanner = msg.toUpperCase();
  showToast(msg, 0);
}

function showToast(msg: string, hideAfterMs = 0) {
  if (toastTimer) window.clearTimeout(toastTimer);
  elPlayToast.textContent = msg;
  elPlayToast.hidden = !msg;
  if (msg && hideAfterMs > 0) {
    toastTimer = window.setTimeout(() => {
      elPlayToast.hidden = true;
    }, hideAfterMs);
  }
}

function openMenu(html: string) {
  elPhase.innerHTML = html;
  elPlayMenu.hidden = false;
}

function closeMenu() {
  elPlayMenu.hidden = true;
  elPhase.innerHTML = "";
}

function juicePlay(kind: "bite" | "catch") {
  elPlayShell.classList.remove("juice-bite", "juice-catch");
  void elPlayShell.offsetWidth;
  elPlayShell.classList.add(kind === "bite" ? "juice-bite" : "juice-catch");
  window.setTimeout(() => elPlayShell.classList.remove("juice-bite", "juice-catch"), 480);
  if (kind === "bite" && navigator.vibrate) navigator.vibrate(28);
  if (kind === "catch" && navigator.vibrate) navigator.vibrate([18, 40, 18]);
}

const $ = (id: string) => document.getElementById(id)!;

/** Slightly longer strike window on touch (coarse pointer) */
const touchFriendly =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

const elTitle = $("title");
const elTag = $("tagline");
const elTrail = $("trail-status");
const elGate = $("nickname-gate");
const elGame = $("game");
const elPlayShell = $("play-shell");
const elPlayToast = $("play-toast");
const elPlayMenu = $("play-menu");
const elNick = $("nickname") as HTMLInputElement;
const elPhase = $("phase-text");
const elPrimary = $("btn-primary");
const elStrike = $("btn-strike");
const elReel = $("reel-controls");
const elSlack = $("btn-slack");
const elHeave = $("btn-heave");
const elHudR = $("hud-renown");
const elHudT = $("hud-tokens");
const elHudS = $("hud-season");
const elHudDeck = $("hud-deck");
const elHudBuff = $("hud-buff");
const canvas = $("well") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const elNotices = $("notices");
const elCredits = $("credits-text");
const elModal = $("modal-demplar") as HTMLDialogElement;
const elModalBody = $("modal-body");
const elBtnCharter = $("btn-charter");
const elBtnCloseModal = $("btn-close-modal");
const elBtnModalX = $("btn-modal-x");
const elBtnSkipGate = $("btn-skip-gate");
const elGateRecall = $("gate-recall");

function openDemplarModal() {
  elModalBody.textContent = demplarModalIntro;
  if (typeof elModal.showModal === "function") {
    if (!elModal.open) elModal.showModal();
  } else {
    elModal.setAttribute("open", "");
  }
}

function closeDemplarModal() {
  if (typeof elModal.close === "function") {
    elModal.close();
  } else {
    elModal.removeAttribute("open");
  }
}

elBtnCharter.addEventListener("click", () => {
  openDemplarModal();
});
elBtnCloseModal.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeDemplarModal();
});
elBtnModalX.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeDemplarModal();
});

/* Backdrop / scrim: any click not inside the charter card closes (works with native <dialog>) */
elModal.addEventListener("click", (e) => {
  const panel = elModal.querySelector(".charter-panel");
  if (panel && e.target instanceof Node && !panel.contains(e.target)) {
    closeDemplarModal();
  }
});

elTitle.textContent = GAME_TITLE;
elTag.textContent = pickLine(demplarEpigraphs);
elCredits.textContent = creditsLine;

let state: GameState = initialState("Traveler");
let socket: Socket | null = null;
let hallViewOpen = false;

function hallBoardHref(): string {
  const base = import.meta.env.BASE_URL || "/";
  const path = `${base.endsWith("/") ? base : `${base}/`}bigboard.html`;
  return new URL(path, window.location.href).href;
}

const mobileHall = createMobileHall({
  onUpdate: () => {
    if (hallViewOpen) openHallView();
  },
});

function openHallView() {
  hallViewOpen = true;
  openMenu(mobileHallStudioHtml(mobileHall.snapshot(), hallBoardHref()));
  elPrimary.hidden = true;
}

function closeHallView() {
  hallViewOpen = false;
}
let loadedTheme: LoadedMediaTheme | null = null;

/** Fishing tempo — lower = slower cast/reel (0.5 = half speed). */
const FISH_PACE = 0.5;
const REEL_DURATION_MS = 5500 / FISH_PACE;

/** Scratch for one fishing attempt */
let castQuality = 0;
let struckBite = false;
let reelQuality = 0;
let chargeActive = false;
let waitPulse = 0;
let rafCast = 0;
let reelRaf = 0;
let reelHoldDir = 0;
let reelFinishing = false;
let reelFailsafeTimer = 0;
let waitFailsafeTimer = 0;
let biteTimer = 0;
let biteOpenTimer = 0;
let saveTimer = 0;
let demplarGame: DemplarWarrior | null = null;
let demplarRaf = 0;
let lastDemplarT = 0;
let demplarLastRewards = { renown: 0, tokens: 0 };
let demplarLastResult: DemplarRunResult | null = null;

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (state.phase !== "enter" && state.phase !== "herald") saveAnglerState(state);
  }, 350);
}

function updateGateRecall() {
  const raw = elNick.value.trim();
  if (!raw) {
    elGateRecall.hidden = true;
    return;
  }
  const peek = peekAnglerSave(raw);
  if (!peek) {
    elGateRecall.hidden = true;
    return;
  }
  const title =
    peek.titles.length > 0 ? peek.titles[peek.titles.length - 1]! : "returning angler";
  const archiveBit =
    peek.archiveCount > 0 ? ` · ${peek.archiveCount} charter nights archived` : "";
  elGateRecall.textContent = `Welcome back, ${peek.nickname} — charter ${peek.charterNight}: ★${peek.renown} · ◎${peek.tokens} · ${peek.catalogSize} codex · ${title}${archiveBit}`;
  elGateRecall.hidden = false;
}

function initNicknameGate() {
  const last = loadLastName();
  if (last) {
    elNick.value = last;
    updateGateRecall();
  }
  elNick.addEventListener("input", updateGateRecall);
}

function setPresence(atWell: boolean) {
  socket?.emit("moonwell:presence", { atWell });
}

let lastFishBroadcast = 0;

function broadcastFishing(force = false) {
  if (!socket) return;
  const fishingPhases = ["fish_cast", "fish_wait", "fish_reel"] as const;
  const isFishing = fishingPhases.includes(state.phase as (typeof fishingPhases)[number]);
  const now = Date.now();
  if (!force && now - lastFishBroadcast < 100) return;
  lastFishBroadcast = now;

  if (!isFishing) {
    socket.emit("moonwell:fishing", { phase: "idle" });
    return;
  }

  socket.emit("moonwell:fishing", {
    phase: state.phase,
    castPower: state.castPower,
    biteOpen: state.biteWindowOpen,
    reelProgress: state.reelProgress,
  });
}

function broadcastChance() {
  if (!socket) return;
  const chancePhases = ["chance_pick", "chance_play", "chance_result"] as const;
  const isChance = chancePhases.includes(state.phase as (typeof chancePhases)[number]);

  if (!isChance) {
    socket.emit("moonwell:chance", { phase: "idle" });
    return;
  }

  const payload: Record<string, unknown> = { phase: state.phase };
  if (state.chanceGame) payload.game = state.chanceGame;
  if (state.overUnderTarget != null) payload.target = state.overUnderTarget;
  if (state.chanceCards.length > 0) {
    payload.cards = state.chanceCards.map((c) => ({
      label: c.label,
      rank: c.rank,
      suit: c.suit,
    }));
  }
  if (state.phase === "chance_result" && state.chanceLastResult) {
    payload.outcome = state.chanceLastResult.outcome;
  }
  socket.emit("moonwell:chance", payload);
}

function announceCatch(c: CatchResult, feastBeforeCatch?: FoodBuff) {
  const blurb = fishBlurb(c.fishId);
  const foodName = feastBeforeCatch ? foodItem(feastBeforeCatch.foodId).name : undefined;
  const { chronicle, subtext } = composeCatchDeed(
    state.nickname,
    c.name,
    c.rarity,
    c.renown,
    blurb,
    state.season,
    {
      omen: c.omen,
      foodName,
      demplarHook: fishDemplarHook(c.fishId),
      demplarTease: c.demplarTease,
    },
  );
  announceDeed("catch", chronicle, subtext, c.renown, {
    fish: c.name,
    rarity: c.rarity,
    combo: !!foodName,
    demplar: fishDemplarHook(c.fishId) || c.demplarTease,
  });
}

function ensureDeck(min = 8) {
  if (state.deck.length < min) {
    state.deck = shuffleDeck(buildMoonwellDeck());
  }
}

function drawFromDeck(n: number) {
  ensureDeck(n);
  const drawn = state.deck.splice(0, n);
  return drawn;
}

function applyFoodOnCatch(c: CatchResult): CatchResult {
  const buff = state.foodBuff;
  if (!buff) return c;
  let renown = c.renown + (buff.renownBonus ?? 0);
  let tokens = c.tokens + (buff.tokenBonus ?? 0);
  state.foodBuff = undefined;
  return { ...c, renown, tokens };
}

function consumeCastFloor(): number {
  return state.foodBuff?.castFloor ?? 0;
}

function biteWindowBonusMs(): number {
  return state.foodBuff?.biteBonusMs ?? 0;
}

function runSnapshot(): RunSnapshot {
  const arc = seasonArcane[state.season];
  return {
    renown: state.renown,
    tokens: state.tokens,
    catalogSize: state.catalog.size,
    titles: state.titles,
    nickname: state.nickname,
    season: state.season,
    seasonName: arc.name,
    seasonVerse: arc.verse,
    seasonNote: arc.anglerNote,
  };
}

const xFeedReady = loadXLoreFeed();

function hallNoticeItems(): string[] {
  const night = tonightUtc();
  const feed = getXLoreFeed();
  const xSnippets = (feed?.posts ?? [])
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((p) => {
      const t = p.text.length > 110 ? `${p.text.slice(0, 108)}…` : p.text;
      return `Overheard @${p.handle.replace(/^@/, "")}: ${t}`;
    });
  return [
    demplarNotice,
    ...xSnippets,
    pickLine(knightNoticeBoard),
    pickLine(noticeBoardArcane),
    `Tonight: ${night.title} — ${night.tagline}`,
    pickLine(noticeBoardArcane),
  ];
}

function fishBlurb(fishId: string): string {
  return fishCatalog.find((f) => f.id === fishId)?.blurb ?? "";
}

function fishDemplarHook(fishId: string): boolean {
  return !!fishCatalog.find((f) => f.id === fishId)?.demplarHook;
}

function announceDeed(
  kind: string,
  chronicle: string,
  subtext: string,
  renown?: number,
  extra?: Record<string, unknown>,
) {
  const payload = {
    kind,
    chronicle,
    text: subtext,
    renown,
    from: state.nickname,
    ts: Date.now(),
    ...extra,
  };
  socket?.emit("hall:announce_deed", payload);
  if (!socket?.connected) {
    mobileHall.pushLocalDeed(payload);
  }
}

function addRenown(delta: number) {
  if (delta <= 0) return;
  const before = state.renown;
  state.renown += delta;
  for (const milestone of crossedRenownMilestones(before, state.renown)) {
    const { chronicle, subtext } = composeRenownDeed(state.nickname, milestone, state.season);
    announceDeed("renown", chronicle, subtext, milestone, { milestone });
  }
}

function buildWellHubHtml(): string {
  const night = tonightUtc();
  return hubWellHtml(
    runSnapshot(),
    night.title,
    night.tagline,
    hubVerse,
    pickLine(hubLoreLines),
    formatCharterDayLabel(charterDayId()),
  );
}

function handleTriviaChoice(index: number) {
  const t = triviaWell[state.triviaIndex % triviaWell.length]!;
  const correct = index === t.ok;
  const renownGain = correct ? 4 : 1;
  const teach = correct && "teach" in t ? t.teach : undefined;
  const { chronicle, subtext } = composeTriviaDeed(
    state.nickname,
    t.q,
    correct,
    teach,
  );
  announceDeed("trivia", chronicle, subtext, renownGain, { correct });
  addRenown(renownGain);
  state.triviaIndex++;
  state.runCount++;
  hud();
  if (correct && teach) {
    openMenu(triviaTeachHtml(teach));
    elPrimary.hidden = true;
  } else {
    setPhase("well");
  }
}

let menuClickBound = false;

function ensureMenuClickDelegation() {
  if (menuClickBound) return;
  menuClickBound = true;
  elPhase.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-hub-action], [data-continue], [data-peril-choice], [data-trivia-choice], [data-feast-id], [data-guess]",
    );
    if (!btn || (btn as HTMLButtonElement).disabled) return;

    const guess = btn.getAttribute("data-guess");
    if (guess) {
      finishChance(guess as "high" | "low" | "over" | "under");
      return;
    }

    const cont = btn.getAttribute("data-continue");
    if (cont) {
      if (cont === "renown") setPhase("renown");
      else if (cont === "interlude") setPhase(state.runCount % 2 === 0 ? "peril" : "trivia");
      else if (cont === "well") {
        closeHallView();
        setPhase("well");
      }
      return;
    }

    const peril = btn.getAttribute("data-peril-choice");
    if (peril !== null) {
      const choiceIndex = Number(peril);
      const beat = perilBeats[state.perilIndex % perilBeats.length]!;
      const choice = beat.a[choiceIndex] ?? beat.a[0]!;
      const renownGain = 2 + choiceIndex;
      const { chronicle, subtext } = composePerilDeed(
        state.nickname,
        beat.q,
        choice,
        choiceIndex === 0,
      );
      announceDeed("peril", chronicle, subtext, renownGain, { bold: choiceIndex === 0 });
      addRenown(renownGain);
      state.perilIndex++;
      state.runCount++;
      hud();
      setPhase("well");
      return;
    }

    const trivia = btn.getAttribute("data-trivia-choice");
    if (trivia !== null) {
      handleTriviaChoice(Number(trivia));
      return;
    }

    const feastId = btn.getAttribute("data-feast-id");
    if (feastId) {
      buyFeast(feastId as FoodId);
      return;
    }

    const hub = btn.getAttribute("data-hub-action");
    if (hub) handleHubAction(hub);
  });
}

function wirePhaseHub() {
  ensureMenuClickDelegation();
}

function handleHubAction(action: string) {
  if (action === "fish") {
    if (state.tokens < 1) {
      state.tokens += 1;
      hud();
    }
    setPhase("fish_cast");
    return;
  }
  if (action === "chance_menu") {
    setPhase("chance_pick");
    return;
  }
  if (action === "feast_menu") {
    setPhase("feast");
    return;
  }
  if (action === "back:well") {
    closeHallView();
    setPhase("well");
    return;
  }
  if (action === "hall_view") {
    openHallView();
    return;
  }
  if (action === "ledger") {
    const archiveLines = formatCharterArchives(loadAnglerArchives(state.nickname));
    openMenu(ledgerStudioHtml(runSnapshot(), hallNoticeItems(), archiveLines));
    elPrimary.hidden = true;
    return;
  }
  if (action === "herald_scroll") {
    void xFeedReady.then((feed) => {
      openMenu(heraldScrollStudioHtml(runSnapshot(), feed));
      elPrimary.hidden = true;
    });
    return;
  }
  if (action === "charter") {
    openDemplarModal();
    return;
  }
  if (action === "demplar_warrior") {
    startDemplarWarrior();
    return;
  }
  if (action.startsWith("chance:")) {
    const id = action.slice(7) as ChanceGameId;
    startChanceGame(id);
    return;
  }
  if (action.startsWith("feast:")) {
    const id = action.slice(6) as FoodId;
    buyFeast(id);
  }
}

function startChanceGame(id: ChanceGameId) {
  const game = CHANCE_GAMES.find((g) => g.id === id)!;
  if (state.tokens < game.stake) {
    openMenu(`${hubBackHtml()}`);
    showToast(`Need ${game.stake} ◎`);
    elPrimary.hidden = true;
    wirePhaseHub();
    return;
  }
  state.chanceGame = id;
  state.chanceCards = [];
  if (id === "over_under") {
    state.overUnderTarget = rollOverUnderTarget();
  }
  setPhase("chance_play");
}

function buyFeast(id: FoodId) {
  const night = tonightUtc();
  if (!night.specials.includes(id)) return;
  if (state.feastsEaten.includes(id)) return;
  const f = foodItem(id);
  if (state.tokens < f.cost) {
    openMenu(`${hubBackHtml()}`);
    showToast(`Need ${f.cost} ◎`);
    elPrimary.hidden = true;
    wirePhaseHub();
    return;
  }
  state.tokens -= f.cost;
  state.feastsEaten.push(id);
  state.foodBuff = {
    foodId: id,
    label: f.buffLabel,
    biteBonusMs: f.biteBonusMs,
    renownBonus: f.renownBonus,
    tokenBonus: f.tokenBonus,
    castFloor: f.castFloor,
  };
  const { chronicle, subtext } = composeFeastDeed(state.nickname, f.name, f.blurb, f.buffLabel);
  announceDeed("feast", chronicle, subtext);
  hud();
  setPhase("well");
}

function finishChance(guess: "high" | "low" | "over" | "under") {
  const game = CHANCE_GAMES.find((g) => g.id === state.chanceGame)!;
  if (state.tokens < game.stake) {
    setPhase("well");
    return;
  }

  let result;
  if (state.chanceGame === "high_low") {
    const first = state.chanceCards[0]!;
    const second = drawFromDeck(1)[0]!;
    state.chanceCards = [first, second];
    result = resolveHighLow(game.stake, first, second, guess as "high" | "low");
  } else {
    const drawn = drawFromDeck(1)[0]!;
    state.chanceCards = [drawn];
    result = resolveOverUnder(
      game.stake,
      drawn,
      state.overUnderTarget ?? 8,
      guess as "over" | "under",
    );
  }

  state.tokens = Math.max(0, state.tokens + result.tokenDelta);
  if (result.renownDelta > 0) addRenown(result.renownDelta);
  if (result.outcome === "win" && !state.titles.includes("Moonwell Sharp")) {
    state.titles.push("Moonwell Sharp");
  }
  state.chanceLastResult = result;
  const { chronicle, subtext } = composeGambleDeed(
    state.nickname,
    result.game,
    result.outcome,
    result.cards,
    guess,
    result.target,
  );
  announceDeed("gamble", chronicle, subtext, result.renownDelta, {
    game: result.game,
    outcome: result.outcome,
    cards: result.cards.map((c) => ({ label: c.label, rank: c.rank, suit: c.suit })),
    target: result.target,
  });
  hud();
  setPhase("chance_result");
}

function hud() {
  elHudR.textContent = `★ ${state.renown}`;
  elHudT.textContent = `◎ ${state.tokens}`;
  elHudS.textContent = `${SEASON_TAG[state.season] ?? "·"} ${seasonArcane[state.season].name.split(" ")[0]}`;
  elHudDeck.hidden = true;
  if (state.foodBuff) {
    elHudBuff.textContent = `+ ${state.foodBuff.label}`;
    elHudBuff.hidden = false;
  } else {
    elHudBuff.hidden = true;
  }
}

function syncCanvasBuffer(): { w: number; h: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = Math.max(1, Math.round(rect.width));
  let h = Math.max(1, Math.round(rect.height));
  if (h <= 1 && w > 0) h = Math.round(w * (420 / 520));

  const bufW = Math.max(1, Math.floor(w * dpr));
  const bufH = Math.max(1, Math.floor(h * dpr));
  if (canvas.width !== bufW || canvas.height !== bufH) {
    canvas.width = bufW;
    canvas.height = bufH;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bufW, bufH);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function drawDemplar() {
  const { w, h } = syncCanvasBuffer();
  demplarGame?.draw(ctx, w, h, performance.now());
}

function stopDemplarLoop() {
  window.cancelAnimationFrame(demplarRaf);
  demplarRaf = 0;
}

function finishDemplarRun() {
  if (!demplarGame) return;
  stopDemplarLoop();
  const result = demplarGame.result;
  demplarLastResult = result;
  demplarLastRewards = {
    renown: renownFromDemplarScore(result.total),
    tokens: tokensFromDemplarScore(result.total),
  };
  addRenown(demplarLastRewards.renown);
  state.tokens += demplarLastRewards.tokens;
  if (!state.demplarBest || result.total > state.demplarBest) {
    state.demplarBest = result.total;
  }
  if (result.total >= 2500 && !state.titles.includes("Demplar Warrior")) {
    state.titles.push("Demplar Warrior");
  }
  const { chronicle, subtext } = composeDemplarDeed(
    state.nickname,
    result.platform,
    result.race,
    result.asteroids,
    result.total,
  );
  announceDeed("demplar", chronicle, subtext, demplarLastRewards.renown, { score: result.total });
  hud();
  setPhase("demplar_result");
}

function syncWarriorShell() {
  if (state.phase === "demplar_warrior" && demplarGame) {
    elPlayShell.dataset.warriorStage = demplarGame.stage;
  } else {
    delete elPlayShell.dataset.warriorStage;
  }
}

function startDemplarLoop() {
  lastDemplarT = performance.now();
  const tick = (now: number) => {
    if (state.phase !== "demplar_warrior" || !demplarGame) return;
    const dt = Math.min(48, now - lastDemplarT);
    lastDemplarT = now;
    demplarGame.update(dt, now);
    stageBanner = demplarGame.banner;
    syncWarriorShell();
    drawDemplar();
    if (demplarGame.done) {
      finishDemplarRun();
      return;
    }
    demplarRaf = requestAnimationFrame(tick);
  };
  demplarRaf = requestAnimationFrame(tick);
}

function startDemplarWarrior() {
  primeWarriorSfx();
  demplarGame = new DemplarWarrior();
  setPhase("demplar_warrior");
  syncWarriorShell();
}

function demplarPointer(e: PointerEvent) {
  if (state.phase !== "demplar_warrior" || !demplarGame) return;
  const rect = canvas.getBoundingClientRect();
  demplarGame.pointerDown(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
}

function drawWell(phaseOverride?: GamePhase) {
  const { w, h } = syncCanvasBuffer();
  const phase = phaseOverride ?? state.phase;
  drawMoonwell(
    ctx,
    {
      phase,
      castPower: state.castPower,
      biteOpen: state.biteWindowOpen,
      waitPulse,
      reelTension: state.reelTension,
      reelProgress: state.reelProgress,
      seasonTint: seasonTints[state.season] ?? "#8cb8d8",
      banner: stageBanner,
    },
    w,
    h,
  );
}

function setPhase(next: GamePhase) {
  state.phase = next;
  elPlayShell.dataset.phase = next;
  clearAutoPhase();
  stageBanner = "";
  elStrike.hidden = true;
  elReel.hidden = true;
  elPrimary.hidden = false;
  chargeActive = false;
  clearFishingTimers();
  stopDemplarLoop();

  setPresence(next !== "enter" && next !== "herald");

  switch (next) {
    case "well":
      openMenu(buildWellHubHtml());
      showToast(pickLine(heraldLines), 5000);
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    case "fish_cast":
      closeMenu();
      state.castPower = 0;
      elPrimary.textContent = "HOLD TO CAST";
      fishingBanner(PLAY_HINT.cast);
      requestAnimationFrame(() => {
        resizeCanvas();
        startCastLoop();
      });
      break;
    case "fish_wait":
      closeMenu();
      state.biteWindowOpen = false;
      struckBite = false;
      fishingBanner(PLAY_HINT.wait);
      elPrimary.hidden = true;
      scheduleBiteWindow();
      waitFailsafeTimer = window.setTimeout(() => {
        if (state.phase === "fish_wait") setPhase("fish_reel");
      }, 12_000);
      break;
    case "fish_reel":
      closeMenu();
      state.reelTension = 0.45;
      state.reelProgress = 0;
      reelQuality = 0;
      reelFinishing = false;
      fishingBanner(PLAY_HINT.reel);
      elPrimary.textContent = "LAND CATCH";
      elPrimary.hidden = false;
      elReel.hidden = false;
      startReelLoop();
      break;
    case "resolve": {
      const c = state.lastCatch!;
      state.runCount++;
      juicePlay("catch");
      void playCatchFanfare();
      stageBanner = `${c.name.toUpperCase()}  +${c.renown}`;
      openMenu(catchResolveHtml(c, pickLine(resolveFlourish[c.rarity]), fishBlurb(c.fishId)));
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    case "renown":
      openMenu(renownStudioHtml(runSnapshot(), renownTitleHint(state.renown)));
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    case "peril": {
      const p = perilBeats[state.perilIndex % perilBeats.length]!;
      openMenu(perilStudioHtml(p.q, p.a));
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    case "trivia": {
      const t = triviaWell[state.triviaIndex % triviaWell.length]!;
      openMenu(triviaStudioHtml(t.q, t.choices));
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    case "chance_pick":
      openMenu(chancePickStudioHtml(chanceTableIntro));
      showToast("");
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    case "chance_play": {
      if (state.chanceGame === "high_low") {
        if (state.chanceCards.length === 0) state.chanceCards = drawFromDeck(1);
        const first = state.chanceCards[0]!;
        openMenu(chanceHighLowHtml(first));
      } else {
        openMenu(chanceOverUnderHtml(state.overUnderTarget ?? 8));
      }
      showToast("");
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    case "chance_result": {
      const r = state.chanceLastResult!;
      stageBanner = r.outcome.toUpperCase();
      openMenu(chanceResultStudioHtml(r));
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    case "feast": {
      const night = tonightUtc();
      openMenu(feastStudioHtml(feastIntro, night.title, night.specials, state.feastsEaten));
      showToast("");
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    case "demplar_warrior":
      closeMenu();
      showToast("");
      elPrimary.hidden = true;
      requestAnimationFrame(() => {
        resizeCanvas();
        drawDemplar();
        startDemplarLoop();
      });
      break;
    case "demplar_result": {
      const r = demplarLastResult ?? demplarGame?.result ?? {
        total: 0,
        platform: 0,
        race: 0,
        asteroids: 0,
      };
      openMenu(
        demplarResultStudioHtml(
          r,
          demplarLastRewards.renown,
          demplarLastRewards.tokens,
          state.demplarBest,
        ),
      );
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    default:
      closeMenu();
      showToast("");
      break;
  }
  hud();
  drawWell();
  syncWarriorShell();
  broadcastFishing(true);
  broadcastChance();
  scheduleSave();
}

function startCastLoop() {
  const tick = () => {
    if (state.phase !== "fish_cast") return;
    if (chargeActive) {
      state.castPower = Math.min(1, state.castPower + 0.022 * FISH_PACE);
    } else {
      state.castPower = Math.max(0, state.castPower - 0.004 * FISH_PACE);
    }
    drawWell();
    broadcastFishing();
    rafCast = requestAnimationFrame(tick);
  };
  rafCast = requestAnimationFrame(tick);
}

function scheduleBiteWindow() {
  const delay = 1200 + Math.random() * 2200;
  biteTimer = window.setTimeout(() => {
    state.biteWindowOpen = true;
    elStrike.hidden = false;
    juicePlay("bite");
    drawWell();
    broadcastFishing(true);
    biteOpenTimer = window.setTimeout(() => {
      state.biteWindowOpen = false;
      elStrike.hidden = true;
      if (state.phase === "fish_wait") setPhase("fish_reel");
    }, touchFriendly ? 820 + biteWindowBonusMs() + Math.random() * 320 : 620 + biteWindowBonusMs() + Math.random() * 220);
  }, delay);
}

function finishReel(good: number, total: number) {
  if (reelFinishing || state.phase !== "fish_reel") return;
  reelFinishing = true;
  clearFishingTimers();
  reelHoldDir = 0;
  reelQuality = Math.min(1, good / (total * 0.45));
  try {
    const result = rollCatch({
      castQuality,
      struckBite,
      reelQuality,
      season: state.season,
    });
    const feastBuff = state.foodBuff;
    state.lastCatch = applyFoodOnCatch(result);
    addRenown(state.lastCatch.renown);
    state.tokens += state.lastCatch.tokens;
    state.catalog.add(result.fishId);
    if (result.rarity === "mythic" && !state.titles.includes("Charter Angler")) {
      state.titles.push("Charter Angler");
    }
    if (result.rarity === "omen" && !state.titles.includes("Omen Reader")) {
      state.titles.push("Omen Reader");
    }
    announceCatch(state.lastCatch, feastBuff);
    hud();
    setPhase("resolve");
  } catch (err) {
    console.error("[fishing] finishReel failed", err);
    reelFinishing = false;
    showToast("The line snagged — try another cast.", 4000);
    setPhase("well");
  }
}

function startReelLoop() {
  const t0 = performance.now();
  const total = REEL_DURATION_MS;
  let good = 0;
  let last = t0;

  reelFailsafeTimer = window.setTimeout(() => {
    if (state.phase === "fish_reel" && !reelFinishing) {
      finishReel(good, total);
    }
  }, total + 400);

  const tick = (now: number) => {
    if (state.phase !== "fish_reel" || reelFinishing) return;
    const dt = Math.min(48, Math.max(0, now - last));
    last = now;

    state.reelTension += 0.00008 * FISH_PACE * dt;
    state.reelTension += Math.sin(now * 0.004 * FISH_PACE) * 0.00022 * FISH_PACE * dt;
    if (reelHoldDir) {
      state.reelTension += reelHoldDir * 0.00055 * FISH_PACE * dt;
    }
    state.reelTension = Math.max(0.05, Math.min(0.95, state.reelTension));

    const inZone = state.reelTension >= 0.34 && state.reelTension <= 0.66;
    if (inZone) good += dt;
    good += dt * 0.12 * FISH_PACE;

    state.reelProgress = Math.min(1, good / (total * 0.42));

    waitPulse = now / 1000;
    drawWell();
    broadcastFishing();

    if (state.reelProgress >= 1 || now - t0 >= total) {
      finishReel(good, total);
      return;
    }
    reelRaf = requestAnimationFrame(tick);
  };
  reelRaf = requestAnimationFrame(tick);
}

elPrimary.addEventListener("pointerdown", (e) => {
  if (state.phase === "fish_cast") {
    e.preventDefault();
    chargeActive = true;
  }
});
elPrimary.addEventListener("click", () => {
  if (state.phase === "fish_reel" && !reelFinishing) {
    finishReel(2400 / FISH_PACE, REEL_DURATION_MS);
  }
});
function finishCast() {
  if (state.phase !== "fish_cast") return;
  chargeActive = false;
  castQuality = Math.max(consumeCastFloor(), state.castPower);
  window.cancelAnimationFrame(rafCast);
  setPhase("fish_wait");
}

elPrimary.addEventListener("pointerup", () => {
  if (state.phase === "fish_cast" && chargeActive) finishCast();
});
elPrimary.addEventListener("pointercancel", () => {
  if (state.phase === "fish_cast" && chargeActive) finishCast();
});
elPrimary.addEventListener("pointerleave", () => {
  if (state.phase === "fish_cast" && chargeActive) finishCast();
});

elStrike.addEventListener("click", () => {
  if (state.phase === "fish_wait" && state.biteWindowOpen) {
    struckBite = true;
    state.biteWindowOpen = false;
    elStrike.hidden = true;
    window.clearTimeout(biteOpenTimer);
    setPhase("fish_reel");
  }
});

function nudgeReel(delta: number) {
  if (state.phase !== "fish_reel") return;
  state.reelTension = Math.max(0.05, Math.min(0.95, state.reelTension + delta));
}

function bindReelButton(btn: HTMLElement, dir: -1 | 1) {
  const down = (e: PointerEvent) => {
    if (state.phase !== "fish_reel") return;
    e.preventDefault();
    reelHoldDir = dir;
    nudgeReel(dir * 0.07 * FISH_PACE);
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
  };
  const up = (e: PointerEvent) => {
    if (reelHoldDir === dir) reelHoldDir = 0;
    try {
      btn.releasePointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
  };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
}

bindReelButton(elSlack, -1);
bindReelButton(elHeave, 1);

window.addEventListener("keydown", (e) => {
  if (state.phase === "demplar_warrior") {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      demplarGame?.jump();
    }
    if (e.code === "ArrowDown") {
      e.preventDefault();
      demplarGame?.boost(true);
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      demplarGame?.steer(-1);
    }
    if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      demplarGame?.steer(1);
    }
    if (e.code === "KeyF") {
      e.preventDefault();
      demplarGame?.hardDrop();
    }
    return;
  }
  if (state.phase === "fish_cast" && e.code === "Space") {
    e.preventDefault();
    chargeActive = true;
  }
  if (state.phase === "fish_wait" && state.biteWindowOpen && (e.code === "Space" || e.code === "Enter")) {
    e.preventDefault();
    struckBite = true;
    state.biteWindowOpen = false;
    elStrike.hidden = true;
    window.clearTimeout(biteOpenTimer);
    setPhase("fish_reel");
  }
  if (state.phase === "fish_reel") {
    if (e.code === "KeyA" || e.code === "ArrowLeft") {
      reelHoldDir = -1;
      nudgeReel(-0.06 * FISH_PACE);
    }
    if (e.code === "KeyD" || e.code === "ArrowRight") {
      reelHoldDir = 1;
      nudgeReel(0.06 * FISH_PACE);
    }
  }
});
window.addEventListener("keyup", (e) => {
  if (state.phase === "demplar_warrior") {
    if (e.code === "Space" || e.code === "ArrowUp") {
      demplarGame?.releaseJump();
    }
    if (e.code === "ArrowDown") {
      demplarGame?.boost(false);
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "ArrowRight" || e.code === "KeyD") {
      demplarGame?.releaseSteer();
    }
    return;
  }
  if (state.phase === "fish_cast" && e.code === "Space") {
    finishCast();
  }
  if (state.phase === "fish_reel") {
    if (e.code === "KeyA" || e.code === "ArrowLeft" || e.code === "KeyD" || e.code === "ArrowRight") {
      reelHoldDir = 0;
    }
  }
});

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const logicalW = rect.width || 520;
  const logicalH = rect.height > 48 ? rect.height : logicalW * (420 / 520);
  canvas.style.height = document.documentElement.classList.contains("play-active")
    ? "100%"
    : `${logicalH}px`;
  syncCanvasBuffer();
  drawWell();
}

window.addEventListener("resize", resizeCanvas);

function fillNotices() {
  elNotices.innerHTML = "";
  hallNoticeItems().forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    elNotices.appendChild(li);
  });
}

async function ensurePixelFonts() {
  try {
    await document.fonts.load('400 10px "Press Start 2P"');
    await document.fonts.load('400 24px "VT323"');
    await document.fonts.load('400 20px "Pixelify Sans"');
    await document.fonts.load('400 14px "Silkscreen"');
  } catch {
    /* network fonts optional */
  }
}

async function bootTrail() {
  const { url } = await resolveTrailServerUrl();
  if (!url) {
    elTrail.textContent = "Solo at the Moonwell — no trail URL (GitHub Pages needs a tunnel).";
    mobileHall.bindSocket(null);
    return;
  }
  elTrail.textContent = "Joining the live hall…";
  try {
    const c = await connectTrail(url, "trailJson", { name: state.nickname });
    socket = c.socket;
    mobileHall.bindSocket(socket);
    const syncLive = () => {
      mobileHall.bindSocket(socket);
      if (state.phase !== "enter" && state.phase !== "herald") {
        setPresence(true);
        broadcastFishing(true);
        broadcastChance();
      }
    };
    socket.on("connect", syncLive);
    syncLive();
    elTrail.textContent = "Live hall — your deeds sync to the bigboard chronicle.";
  } catch {
    socket = null;
    mobileHall.bindSocket(null);
    elTrail.textContent = "Live hall offline — run npm run live, then hard-refresh Play + bigboard.";
  }
}

canvas.addEventListener("pointerdown", (e) => {
  demplarPointer(e);
});

canvas.addEventListener("pointermove", (e) => {
  if (state.phase !== "demplar_warrior" || !demplarGame) return;
  const rect = canvas.getBoundingClientRect();
  demplarGame.pointerMove(
    e.clientX - rect.left,
    e.clientY - rect.top,
    rect.width,
    rect.height,
  );
});

canvas.addEventListener("pointerup", () => {
  demplarGame?.pointerUp();
});

canvas.addEventListener("pointercancel", () => {
  demplarGame?.pointerUp();
});

async function startGameFromGate() {
  const raw = elNick.value.trim() || "Anonymous Angler";
  const display = raw.slice(0, 28);
  const peek = peekAnglerSave(display);
  state = loadAnglerState(display) ?? initialState(display);
  rememberLastName(state.nickname);
  elGate.hidden = true;
  elGame.hidden = false;
  document.documentElement.classList.remove("gate-open");
  document.documentElement.classList.add("play-active");
  closeDemplarModal();
  await xFeedReady;
  fillNotices();
  await ensurePixelFonts();
  loadedTheme = await loadDailyMediaTheme();
  await bootTrail();
  requestAnimationFrame(() => {
    resizeCanvas();
    setPhase("well");
    if (peek) {
      showToast(
        `Charter ${formatCharterDayLabel(charterDayId())} — ★${state.renown} renown · ◎${state.tokens} tokens`,
        5200,
      );
    }
  });
}

$("btn-enter-name").addEventListener("click", () => {
  primeHallMusic();
  void startGameFromGate();
});
elBtnSkipGate.addEventListener("click", () => {
  elNick.value = "";
  updateGateRecall();
  primeHallMusic();
  void startGameFromGate();
});

initNicknameGate();
window.addEventListener("beforeunload", () => {
  if (state.phase !== "enter" && state.phase !== "herald") saveAnglerState(state);
});

requestAnimationFrame(function tick(now: number) {
  waitPulse = now / 1000;
  if (state.phase === "fish_wait") {
    drawWell();
  }
  requestAnimationFrame(tick);
});

if (import.meta.env.DEV) {
  (window as Window & { __tavernQA?: { getDemplar: () => DemplarWarrior | null } }).__tavernQA = {
    getDemplar: () => demplarGame,
  };
}
