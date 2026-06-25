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
  SUBTITLE_TAGLINES,
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
import { foodItem, tonightUtc, type FoodId } from "./content/tavernNights";
import { initialState } from "./game/state";
import type { CatchResult, GamePhase, GameState } from "./game/types";
import { drawMoonwell, seasonTints } from "./minigames/fishingCanvas";
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
import { rollCatch } from "./minigames/fishing";
import { connectTrail } from "./net/trailClient";
import { resolveTrailServerUrl } from "./net/trailResolve";
import type { Socket } from "socket.io-client";
import { initMobileShellClass } from "./mobile-detect";
import { primeHallMusic, startHallMusic } from "./audio/hallMusic";
import {
  chanceHighLowHtml,
  chanceOverUnderHtml,
  hubBackHtml,
} from "./ui/tavernHub";
import {
  catchResolveHtml,
  chancePickStudioHtml,
  chanceResultStudioHtml,
  feastStudioHtml,
  hubWellHtml,
  ledgerStudioHtml,
  perilStudioHtml,
  renownStudioHtml,
  triviaStudioHtml,
  triviaTeachHtml,
  type RunSnapshot,
} from "./ui/studioScreens";

initMobileShellClass();

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
  reel: "Keep bob in green",
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
elTag.textContent = pickLine(SUBTITLE_TAGLINES);
elCredits.textContent = creditsLine;

let state: GameState = initialState("Traveler");
let socket: Socket | null = null;
let loadedTheme: LoadedMediaTheme | null = null;

/** Scratch for one fishing attempt */
let castQuality = 0;
let struckBite = false;
let reelQuality = 0;
let chargeActive = false;
let waitPulse = 0;
let rafCast = 0;
let reelRaf = 0;
let biteTimer = 0;
let biteOpenTimer = 0;

function setPresence(atWell: boolean) {
  socket?.emit("moonwell:presence", { atWell });
}

function announceCatch(c: CatchResult) {
  socket?.emit("hall:announce_deed", {
    kind: "catch",
    fish: c.name,
    rarity: c.rarity,
    renown: c.renown,
    text: c.omen ? `Omen: ${c.omen}` : undefined,
  });
}

function announceHall(kind: string, text: string, renown?: number) {
  socket?.emit("hall:announce_deed", { kind, text, renown });
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

function noticeLines(): string[] {
  const night = tonightUtc();
  return [
    demplarNotice,
    pickLine(noticeBoardArcane),
    `Tonight: ${night.title} — ${night.tagline}`,
    pickLine(noticeBoardArcane),
  ];
}

function fishBlurb(fishId: string): string {
  return fishCatalog.find((f) => f.id === fishId)?.blurb ?? "";
}

function buildWellHubHtml(): string {
  const night = tonightUtc();
  return hubWellHtml(runSnapshot(), night.title, night.tagline, hubVerse, pickLine(hubLoreLines));
}

function handleTriviaChoice(index: number) {
  const t = triviaWell[state.triviaIndex % triviaWell.length]!;
  const correct = index === t.ok;
  state.renown += correct ? 4 : 1;
  state.triviaIndex++;
  state.runCount++;
  hud();
  if (correct && "teach" in t && t.teach) {
    openMenu(triviaTeachHtml(t.teach));
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
      else if (cont === "well") setPhase("well");
      return;
    }

    const peril = btn.getAttribute("data-peril-choice");
    if (peril !== null) {
      const choiceIndex = Number(peril);
      state.perilIndex++;
      state.renown += 2 + choiceIndex;
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
    setPhase("well");
    return;
  }
  if (action === "ledger") {
    openMenu(ledgerStudioHtml(runSnapshot(), noticeLines()));
    elPrimary.hidden = true;
    return;
  }
  if (action === "charter") {
    openDemplarModal();
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
  announceHall("feast", `Supped on ${f.name} — ${f.buffLabel}`);
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
  state.renown += result.renownDelta;
  if (result.outcome === "win" && !state.titles.includes("Moonwell Sharp")) {
    state.titles.push("Moonwell Sharp");
  }
  state.chanceLastResult = result;
  announceHall("gamble", result.detail, result.renownDelta);
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
  const w = Math.max(1, Math.floor(rect.width) || 520);
  const h = Math.max(48, Math.floor(rect.height) || Math.floor(w * (420 / 520)));
  const bufW = Math.floor(w * dpr);
  const bufH = Math.floor(h * dpr);
  if (canvas.width !== bufW || canvas.height !== bufH) {
    canvas.width = bufW;
    canvas.height = bufH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return { w, h };
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
  window.cancelAnimationFrame(rafCast);
  window.clearTimeout(biteTimer);
  window.clearTimeout(biteOpenTimer);
  window.cancelAnimationFrame(reelRaf);

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
      showToast("");
      elPrimary.textContent = "HOLD TO CAST";
      startCastLoop();
      break;
    case "fish_wait":
      closeMenu();
      state.biteWindowOpen = false;
      struckBite = false;
      showToast(PLAY_HINT.wait);
      elPrimary.hidden = true;
      scheduleBiteWindow();
      break;
    case "fish_reel":
      closeMenu();
      state.reelTension = 0.45;
      state.reelProgress = 0;
      reelQuality = 0;
      showToast(PLAY_HINT.reel);
      elPrimary.hidden = true;
      elReel.hidden = false;
      startReelLoop();
      break;
    case "resolve": {
      const c = state.lastCatch!;
      state.runCount++;
      juicePlay("catch");
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
    default:
      closeMenu();
      showToast("");
      break;
  }
  hud();
  drawWell();
}

function startCastLoop() {
  const tick = () => {
    if (state.phase !== "fish_cast") return;
    if (chargeActive) {
      state.castPower = Math.min(1, state.castPower + 0.022);
    } else {
      state.castPower = Math.max(0, state.castPower - 0.004);
    }
    drawWell();
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
    biteOpenTimer = window.setTimeout(() => {
      state.biteWindowOpen = false;
      elStrike.hidden = true;
      setPhase("fish_reel");
    }, touchFriendly ? 820 + biteWindowBonusMs() + Math.random() * 320 : 620 + biteWindowBonusMs() + Math.random() * 220);
  }, delay);
}

function startReelLoop() {
  const t0 = performance.now();
  const total = 4800;
  let good = 0;
  let last = t0;

  const tick = (now: number) => {
    if (state.phase !== "fish_reel") return;
    const dt = Math.min(48, Math.max(0, now - last));
    last = now;

    state.reelTension += Math.sin(now / 420) * 0.0012;
    state.reelTension = Math.max(0.05, Math.min(0.95, state.reelTension));

    const inZone = state.reelTension >= 0.38 && state.reelTension <= 0.62;
    if (inZone) good += dt;

    state.reelProgress = Math.min(1, good / (total * 0.55));

    waitPulse = now / 1000;
    drawWell();

    if (now - t0 < total) {
      reelRaf = requestAnimationFrame(tick);
    } else {
      reelQuality = Math.min(1, good / total);
      const result = rollCatch({
        castQuality,
        struckBite,
        reelQuality,
        season: state.season,
      });
      state.lastCatch = applyFoodOnCatch(result);
      state.renown += state.lastCatch.renown;
      state.tokens += state.lastCatch.tokens;
      state.catalog.add(result.fishId);
      if (result.rarity === "mythic" && !state.titles.includes("Charter Angler")) state.titles.push("Charter Angler");
      if (result.rarity === "omen" && !state.titles.includes("Omen Reader")) state.titles.push("Omen Reader");
      announceCatch(state.lastCatch);
      hud();
      setPhase("resolve");
    }
  };
  reelRaf = requestAnimationFrame(tick);
}

elPrimary.addEventListener("pointerdown", (e) => {
  if (state.phase === "fish_cast") {
    e.preventDefault();
    chargeActive = true;
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
  }
});

function nudgeReel(delta: number) {
  if (state.phase !== "fish_reel") return;
  state.reelTension = Math.max(0.05, Math.min(0.95, state.reelTension + delta));
}

elSlack.addEventListener("click", () => nudgeReel(-0.055));
elHeave.addEventListener("click", () => nudgeReel(0.055));

window.addEventListener("keydown", (e) => {
  if (state.phase === "fish_cast" && e.code === "Space") {
    e.preventDefault();
    chargeActive = true;
  }
  if (state.phase === "fish_wait" && state.biteWindowOpen && (e.code === "Space" || e.code === "Enter")) {
    struckBite = true;
  }
  if (state.phase === "fish_reel") {
    if (e.code === "KeyA" || e.code === "ArrowLeft") nudgeReel(-0.06);
    if (e.code === "KeyD" || e.code === "ArrowRight") nudgeReel(0.06);
  }
});
window.addEventListener("keyup", (e) => {
  if (state.phase === "fish_cast" && e.code === "Space") {
    finishCast();
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
  const items = [
    demplarNotice,
    pickLine(noticeBoardArcane),
    `Tonight: ${tonightUtc().title} — ${tonightUtc().tagline}`,
    pickLine(noticeBoardArcane),
  ];
  items.forEach((t) => {
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
    elTrail.textContent = "Solo at the Moonwell — cast freely. Live hall is optional.";
    return;
  }
  elTrail.textContent = "Joining the live hall…";
  try {
    const c = await connectTrail(url, "trailJson", { name: state.nickname });
    socket = c.socket;
    elTrail.textContent = "Live hall — other anglers may share the table.";
  } catch {
    elTrail.textContent = "Live hall is resting — solo play works fine.";
  }
}

async function startGameFromGate() {
  const name = elNick.value.trim() || "Anonymous Angler";
  state = initialState(name.slice(0, 28));
  elGate.hidden = true;
  elGame.hidden = false;
  document.documentElement.classList.remove("gate-open");
  document.documentElement.classList.add("play-active");
  closeDemplarModal();
  fillNotices();
  await ensurePixelFonts();
  loadedTheme = await loadDailyMediaTheme();
  await bootTrail();
  requestAnimationFrame(() => {
    resizeCanvas();
    setPhase("well");
  });
}

$("btn-enter-name").addEventListener("click", () => {
  primeHallMusic();
  void startHallMusic();
  void startGameFromGate();
});
elBtnSkipGate.addEventListener("click", () => {
  elNick.value = "";
  primeHallMusic();
  void startHallMusic();
  void startGameFromGate();
});

requestAnimationFrame(function tick(now: number) {
  waitPulse = now / 1000;
  if (state.phase === "fish_wait") {
    drawWell();
  }
  requestAnimationFrame(tick);
});
