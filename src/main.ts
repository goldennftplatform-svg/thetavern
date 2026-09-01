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
  fishCatalog,
  heraldLines,
  perilBeats,
  triviaWell,
} from "./content/lore";
import {
  pickLine,
  chanceTableIntro,
  feastIntro,
  hubVerse,
  hubLoreLines,
  renownTitleHint,
  resolveFlourish,
  seasonArcane,
  castBarks,
  waitBarks,
  reelBarks,
  castLoreLines,
  waitLoreLines,
  reelLoreLines,
} from "./content/arcaneLore";
import { isPoleId, poleById, type PoleId } from "./content/fishingPoles";
import {
  DEFAULT_AVATAR_ID,
  houseAvatarById,
  isHouseAvatarId,
  type HouseAvatarId,
} from "./content/houseAvatars";
import {
  awardCatchXp,
  awardCastXp,
  equipPole,
  normalizePoleProgress,
  poleRackBlurb,
  type PoleProgress,
} from "./game/poleProgress";
import { composeCatchDeed, composeDemplarDeed, composeFeastDeed, composeGambleDeed, composePerilDeed, composeRenownDeed, composeTriviaDeed, crossedRenownMilestones } from "./content/deedLore";
import type { FoodBuff } from "./game/types";
import { foodItem, tonightUtc, type FoodId } from "./content/tavernNights";
import { initialState } from "./game/state";
import {
  loadAnglerState,
  loadLastName,
  peekAnglerSave,
  pinAnglerTrophy,
  rememberLastName,
  saveAnglerState,
  loadAnglerArchives,
  formatCharterArchives,
  recordMineRun,
} from "./game/anglerSave";
import {
  isTrophyRarity,
  makeTrophyId,
  wornTitle,
} from "./hall/hallAssets";
import type { CatchResult, GamePhase, GameState } from "./game/types";
import { drawMoonwell, preloadArdyFishingClips, preloadPoleSprites, RARITY_COLORS, seasonTints, triggerBiteFlash, triggerCastFx, triggerLandFlash, triggerPerfectCast, triggerStrikeFlash } from "./minigames/fishingCanvas";
import { rollCatch } from "./minigames/fishing";
import {
  CHANCE_GAMES,
  isChanceGameId,
  isGuessForGame,
  isHighLowGuess,
  isRedBlackGuess,
  resolveHighLow,
  resolveRedBlack,
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
import {
  ConflicBouy,
  renownFromBouyScore,
  tokensFromBouyScore,
  type BouyMode,
  type BouyResult,
} from "./minigames/conflicBouy";
import { connectTrail } from "./net/trailClient";
import { ConflicOnlineClient } from "./net/conflicClient";
import {
  CONFLIC_TABLE_IDS,
  type ConflicPrivateRoomView,
  type ConflicRoomSummary,
  type ConflicTableId,
} from "./net/conflicProtocol";
import { resolveTrailServerUrl } from "./net/trailResolve";
import type { Socket } from "socket.io-client";
import { initMobileShellClass, isTavernMobile } from "./mobile-detect";
import { bindHallMusicGestures, playCatchFanfare, primeHallMusic } from "./audio/hallMusic";
import { compressAvatarFile, houseAvatarPickerHtml } from "./ui/avatarFace";
import {
  playCastWhoosh,
  playCelebrationArp,
  playLandThump,
  playNibble,
  playPerfectChime,
  playReelCreak,
  playSplash,
  playStrikeHit,
  primeFishingSfx,
} from "./audio/fishingSfx";
import { bindWarriorTouch } from "./warriorTouch";
import { primeWarriorSfx } from "./audio/warriorSfx";
import { primeJackSparrow } from "./audio/jackSparrow";
import { demplarEpigraphs } from "./content/demplarKnights";
import { charterDayId, formatCharterDayLabel } from "./game/charterDay";
import { createMobileHall } from "./hall/mobileHall";
import {
  ensureXLoreFeed,
  loadXLoreFeed,
  onXLoreFeedUpdate,
  overheardTeasers,
  refreshXLoreFeed,
} from "./lore/xFeed";
import { hallNoticeEntries, renderNoticeCardLi } from "./ui/notices";
import {
  chanceHighLowPlayHtml,
  chanceRedBlackPlayHtml,
  chanceResultStudioHtml,
} from "./ui/chanceScreens";
import { hubBackHtml } from "./ui/tavernHub";
import {
  catchResolveHtml,
  chancePickStudioHtml,
  demplarResultStudioHtml,
  feastStudioHtml,
  hubWellHtml,
  heraldScrollStudioHtml,
  ledgerStudioHtml,
  mobileHallStudioHtml,
  perilStudioHtml,
  poleRackStudioHtml,
  poleUnlockStudioHtml,
  avatarClosetStudioHtml,
  renownStudioHtml,
  triviaStudioHtml,
  triviaTeachHtml,
  conflicResultStudioHtml,
  conflicLobbyStudioHtml,
  conflicThemePickStudioHtml,
  conflicThemePickStudioHtmlForMode,
  conflicStakePickStudioHtml,
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

const SEASON_TAG: Record<string, string> = {
  frost: "❄",
  bloom: "🌸",
  ember: "🔥",
  void: "✦",
};

let autoPhaseTimer = 0;
let toastTimer = 0;
let stageBanner = "";
let fishingLoreLine = "";

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

function showToast(msg: string, hideAfterMs = 0, opts?: { force?: boolean }) {
  if (toastTimer) window.clearTimeout(toastTimer);
  elPlayToast.textContent = msg;
  elPlayToast.hidden = !msg;
  elPlayToast.classList.toggle("play-toast--force", !!(msg && opts?.force));
  if (msg && hideAfterMs > 0) {
    toastTimer = window.setTimeout(() => {
      elPlayToast.hidden = true;
      elPlayToast.classList.remove("play-toast--force");
    }, hideAfterMs);
  } else if (!msg) {
    elPlayToast.classList.remove("play-toast--force");
  }
}

function openMenu(html: string) {
  const herald = html.includes("studio-stage--herald");
  const ledger = html.includes("studio-stage--ledger");
  elPhase.innerHTML = html;
  elPhase.classList.toggle("play-menu-body--herald", herald);
  elPhase.classList.toggle("play-menu-body--ledger", ledger);
  elPlayMenu.classList.toggle("play-menu--herald", herald);
  elPlayMenu.classList.toggle("play-menu--ledger", ledger);
  elPlayMenu.hidden = false;
}

function closeMenu() {
  elPlayMenu.hidden = true;
  elPhase.innerHTML = "";
  elPhase.classList.remove("play-menu-body--herald", "play-menu-body--ledger");
  elPlayMenu.classList.remove("play-menu--herald", "play-menu--ledger");
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

/** Coarse / narrow — warrior puzzle pad + slower gravity */
const touchFriendly = typeof window !== "undefined" && isTavernMobile();

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
const elWarriorLeft = $("btn-warrior-left");
const elWarriorRight = $("btn-warrior-right");
const elWarriorRotate = $("btn-warrior-rotate");
const elWarriorDrop = $("btn-warrior-drop");
const elWarriorHard = $("btn-warrior-hard");
const elWarriorJump = $("btn-warrior-jump");
const elConflicChat = $("conflic-chat");
const elConflicChatToggle = $("conflic-chat-toggle");
const elConflicChatUnread = $("conflic-chat-unread");
const elConflicChatClose = $("conflic-chat-close");
const elConflicChatTable = $("conflic-chat-table");
const elConflicChatMessages = $("conflic-chat-messages") as HTMLOListElement;
const elConflicChatAnnouncement = $("conflic-chat-announcement");
const elConflicChatEmpty = $("conflic-chat-empty");
const elConflicChatForm = $("conflic-chat-form") as HTMLFormElement;
const elConflicChatInput = $("conflic-chat-input") as HTMLInputElement;
const elConflicChatSend = $("conflic-chat-send") as HTMLButtonElement;
const elHudR = $("hud-renown");
const elHudT = $("hud-tokens");
const elHudS = $("hud-season");
const elHudDeck = $("hud-deck");
const elHudBuff = $("hud-buff");
const elHudChain = $("hud-chain");
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
const elGateAvatarBtn = $("gate-avatar-btn");
const elGateAvatarGlyph = $("gate-avatar-glyph");
const elGateAvatarImg = $("gate-avatar-img") as HTMLImageElement;
const elGateAvatarPicker = $("gate-avatar-picker");
const elGateAvatarUpload = $("gate-avatar-upload") as HTMLInputElement;
const elGateAvatarClear = $("gate-avatar-clear");

let gateAvatarId: HouseAvatarId = DEFAULT_AVATAR_ID;
let gateAvatarCustom: string | undefined;

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
let conflicOnline: ConflicOnlineClient | null = null;
let conflicRooms: ConflicRoomSummary[] = [];
let hallViewOpen = false;
let conflicChatTable: ConflicTableId | null = null;
let conflicChatRenderKey = "";
let conflicChatUnread = 0;
let conflicChatKnownIds = new Set<string>();

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
/** Moonfire Chain — consecutive sweet-window casts (session only). */
const CAST_SWEET_LO = 0.72;
const CAST_SWEET_HI = 0.92;
let castStreak = 0;
let castWasPerfect = false;
let lastCatchFlair: { flawless: boolean; chainBonus: number; isNew: boolean } = {
  flawless: false,
  chainBonus: 0,
  isNew: false,
};
let waitPulse = 0;
let rafCast = 0;
let reelRaf = 0;
let reelHoldDir = 0;
let reelFinishing = false;
let reelFailsafeTimer = 0;
let waitFailsafeTimer = 0;
/** Green-zone hold time (ms) accrued by the live reel loop — shared with the early-land path. */
let reelGoodMs = 0;
let biteTimer = 0;
let biteOpenTimer = 0;
let saveTimer = 0;
let demplarGame: DemplarWarrior | null = null;
let demplarRaf = 0;
let warriorFailsafeTimer = 0;
let lastDemplarT = 0;
let demplarLastRewards = { renown: 0, tokens: 0 };
let demplarLastResult: DemplarRunResult | null = null;

let conflicGame: ConflicBouy | null = null;
let conflicRaf = 0;
let conflicLastResult: BouyResult | null = null;
let conflicLastRewards = { renown: 0, tokens: 0 };
let conflicMode: BouyMode = "agent";
let conflicTheme = "charter";
let conflicStake = 0;

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (state.phase !== "enter" && state.phase !== "herald") saveAnglerState(state);
  }, 350);
}

function paintGateAvatar() {
  const face = houseAvatarById(gateAvatarId);
  elGateAvatarBtn.style.setProperty("--avatar-ink", face.ink);
  elGateAvatarBtn.style.setProperty("--avatar-glow", face.glow);
  if (gateAvatarCustom) {
    elGateAvatarBtn.classList.add("avatar-face--custom");
    elGateAvatarBtn.classList.remove("avatar-face--house");
    elGateAvatarImg.src = gateAvatarCustom;
    elGateAvatarImg.hidden = false;
    elGateAvatarGlyph.hidden = true;
    elGateAvatarClear.hidden = false;
  } else {
    elGateAvatarBtn.classList.remove("avatar-face--custom");
    elGateAvatarBtn.classList.add("avatar-face--house");
    elGateAvatarImg.hidden = true;
    elGateAvatarImg.removeAttribute("src");
    elGateAvatarGlyph.hidden = false;
    elGateAvatarGlyph.textContent = face.glyph;
    elGateAvatarClear.hidden = true;
  }
}

function renderGateAvatarPicker() {
  elGateAvatarPicker.innerHTML = houseAvatarPickerHtml(gateAvatarId, gateAvatarCustom);
  elGateAvatarPicker.hidden = false;
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
  gateAvatarId = peek.avatarId;
  gateAvatarCustom = peek.avatarCustom;
  paintGateAvatar();
  const title =
    peek.titles.length > 0 ? peek.titles[peek.titles.length - 1]! : "returning angler";
  const archiveBit =
    peek.archiveCount > 0 ? ` · ${peek.archiveCount} tavern nights archived` : "";
  elGateRecall.textContent = `Welcome back, ${peek.nickname} — tavern night ${peek.charterNight}: ★${peek.renown} · ◎${peek.tokens} · ${peek.catalogSize} codex · ${title}${archiveBit}`;
  elGateRecall.hidden = false;
}

function initNicknameGate() {
  const last = loadLastName();
  if (last) {
    elNick.value = last;
    updateGateRecall();
  } else {
    paintGateAvatar();
  }
  elNick.addEventListener("input", updateGateRecall);
  elGateAvatarBtn.addEventListener("click", () => {
    if (elGateAvatarPicker.hidden) renderGateAvatarPicker();
    else elGateAvatarPicker.hidden = true;
  });
  elGateAvatarPicker.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-avatar-id]");
    if (!btn) return;
    const id = btn.getAttribute("data-avatar-id");
    if (!isHouseAvatarId(id)) return;
    gateAvatarId = id;
    gateAvatarCustom = undefined;
    paintGateAvatar();
    renderGateAvatarPicker();
  });
  elGateAvatarUpload.addEventListener("change", () => {
    const file = elGateAvatarUpload.files?.[0];
    elGateAvatarUpload.value = "";
    if (!file) return;
    void compressAvatarFile(file)
      .then((data) => {
        gateAvatarCustom = data;
        paintGateAvatar();
        if (!elGateAvatarPicker.hidden) renderGateAvatarPicker();
      })
      .catch((err) => {
        elGateRecall.textContent = err instanceof Error ? err.message : "Upload failed.";
        elGateRecall.hidden = false;
      });
  });
  elGateAvatarClear.addEventListener("click", () => {
    gateAvatarCustom = undefined;
    paintGateAvatar();
    if (!elGateAvatarPicker.hidden) renderGateAvatarPicker();
  });
}

function setPresence(atWell: boolean) {
  socket?.emit("moonwell:presence", { atWell });
}

function syncHallIdentity() {
  if (!socket) return;
  socket.emit("moonwell:identity", {
    title: wornTitle(state.titles),
    catalogSize: state.catalog.size,
    tokens: state.tokens,
    avatarId: state.avatarId,
  });
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
    socket.emit("moonwell:chance", { phase: "idle", tokens: state.tokens });
    return;
  }

  const game = state.chanceGame
    ? CHANCE_GAMES.find((g) => g.id === state.chanceGame)
    : undefined;
  const payload: Record<string, unknown> = {
    phase: state.phase,
    tokens: state.tokens,
  };
  if (state.chanceGame) payload.game = state.chanceGame;
  if (game) payload.stake = game.stake;
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
    charterNight: formatCharterDayLabel(charterDayId()),
  });

  if (isTrophyRarity(c.rarity)) {
    const ts = Date.now();
    pinAnglerTrophy(state.nickname, {
      id: makeTrophyId(state.nickname, c.name, ts),
      fish: c.name,
      rarity: c.rarity,
      from: state.nickname,
      ts,
      charterNight: formatCharterDayLabel(charterDayId()),
    });
  }
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
  const food = state.foodBuff?.castFloor ?? 0;
  const pole = currentPole().mods.castFloor ?? 0;
  return Math.max(food, pole);
}

function biteWindowBonusMs(): number {
  return (state.foodBuff?.biteBonusMs ?? 0) + (currentPole().mods.biteBonusMs ?? 0);
}

function poleProgressFromState(): PoleProgress {
  return normalizePoleProgress({
    poleXp: state.poleXp,
    equippedPoleId: state.equippedPoleId,
    unlockedPoleIds: state.unlockedPoleIds,
  });
}

function writePoleProgress(p: PoleProgress) {
  state.poleXp = p.poleXp;
  state.equippedPoleId = p.equippedPoleId;
  state.unlockedPoleIds = [...p.unlockedPoleIds];
}

function currentPole() {
  return poleById(state.equippedPoleId);
}

function reelGreenZone(): { lo: number; hi: number } {
  const pad = currentPole().mods.greenZonePad ?? 0;
  return { lo: Math.max(0.18, 0.34 - pad), hi: Math.min(0.82, 0.66 + pad) };
}

function mergePoleUnlocks(unlocked: typeof state.pendingPoleUnlocks) {
  if (!unlocked?.length) return;
  const bag = [...(state.pendingPoleUnlocks ?? [])];
  for (const p of unlocked) {
    if (!bag.some((x) => x.id === p.id)) bag.push(p);
    const title = `${p.name} Bearer`;
    if (!state.titles.includes(title)) state.titles.push(title);
  }
  state.pendingPoleUnlocks = bag;
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
    avatarId: state.avatarId,
    avatarCustom: state.avatarCustom,
  };
}

const xFeedReady = loadXLoreFeed();

function fishBlurb(fishId: string): string {
  return fishCatalog.find((f) => f.id === fishId)?.blurb ?? "";
}

function fishGlyph(fishId: string): string {
  return fishCatalog.find((f) => f.id === fishId)?.glyph ?? "🐟";
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
  const crestSrc = loadedTheme?.images.crest?.src;
  return hubWellHtml(
    runSnapshot(),
    night.title,
    night.tagline,
    hubVerse,
    pickLine(hubLoreLines),
    formatCharterDayLabel(charterDayId()),
    crestSrc,
    poleRackBlurb(poleProgressFromState()),
    overheardTeasers(ensureXLoreFeed(), 3),
  );
}

function applyDailyMediaChrome(theme: LoadedMediaTheme | null) {
  const crest = theme?.images.crest;
  const banner = theme?.images.banner;
  const elGateCrest = document.getElementById("gate-crest") as HTMLImageElement | null;
  if (elGateCrest) {
    if (crest?.src) {
      elGateCrest.src = crest.src;
      elGateCrest.hidden = false;
      elGateCrest.alt = theme?.platform.name ? `${theme.platform.name} crest` : "";
    } else {
      elGateCrest.hidden = true;
    }
  }
  const gate = document.getElementById("nickname-gate");
  if (gate) {
    if (banner?.src) gate.style.setProperty("--gate-banner", `url("${banner.src}")`);
    else gate.style.removeProperty("--gate-banner");
  }
  if (theme?.platform.name) {
    document.documentElement.style.setProperty("--daily-deck-name", `"${theme.platform.name}"`);
  }
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
      const gameAttr = btn.getAttribute("data-chance-game");
      if (gameAttr && state.chanceGame && gameAttr !== state.chanceGame) return;
      finishChance(guess);
      return;
    }

    const cont = btn.getAttribute("data-continue");
    if (cont) {
      if (cont === "renown") {
        if (state.pendingPoleUnlocks?.length) {
          const unlocked = state.pendingPoleUnlocks;
          state.pendingPoleUnlocks = undefined;
          openMenu(poleUnlockStudioHtml(unlocked));
          elPrimary.hidden = true;
          return;
        }
        setPhase("renown");
      } else if (cont === "interlude") setPhase(state.runCount % 2 === 0 ? "peril" : "trivia");
      else if (cont === "well") {
        closeHallView();
        if (conflicOnline?.tableId) void leaveOnlineTable("well");
        else setPhase("well");
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

function wireAvatarCloset() {
  elPhase.querySelectorAll<HTMLElement>("[data-avatar-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-avatar-id");
      if (!isHouseAvatarId(id)) return;
      state.avatarId = id;
      state.avatarCustom = undefined;
      scheduleSave();
      syncHallIdentity();
      setPhase("avatar_closet");
    });
  });
  const input = elPhase.querySelector<HTMLInputElement>("#avatar-upload-input");
  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    void compressAvatarFile(file)
      .then((data) => {
        state.avatarCustom = data;
        scheduleSave();
        syncHallIdentity();
        showToast("Portrait stamped.");
        setPhase("avatar_closet");
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : "Upload failed.", 4000);
      });
  });
}

function openNeighborLore() {
  const snap = runSnapshot();
  const show = (feed: ReturnType<typeof ensureXLoreFeed>) => {
    openMenu(heraldScrollStudioHtml(snap, feed));
    elPrimary.hidden = true;
  };
  try {
    show(ensureXLoreFeed());
  } catch {
    showToast("Neighbor lore relay hiccup — hard-refresh and try again.", 3200, { force: true });
    return;
  }
  void refreshXLoreFeed(true)
    .then(show)
    .catch(() => {
      try {
        show(ensureXLoreFeed());
      } catch {
        showToast("Neighbor lore relay hiccup — hard-refresh and try again.", 3200, { force: true });
      }
    });
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
  if (action === "pole_rack") {
    setPhase("pole_rack");
    return;
  }
  if (action === "avatar_closet") {
    setPhase("avatar_closet");
    return;
  }
  if (action === "avatar_clear_custom") {
    state.avatarCustom = undefined;
    scheduleSave();
    syncHallIdentity();
    setPhase("avatar_closet");
    return;
  }
  if (action.startsWith("equip_pole:")) {
    const id = action.slice("equip_pole:".length);
    if (!isPoleId(id)) return;
    const poleId = id as PoleId;
    const unlocking = !!elPhase.querySelector(".studio-stage--pole-unlock");
    const prog = poleProgressFromState();
    // Unlock reveal is authority that this rod woke — don't strand the Equip button
    // if unlockedIds somehow lagged the interstitial.
    if (unlocking && !prog.unlockedPoleIds.includes(poleId)) {
      prog.unlockedPoleIds = [...prog.unlockedPoleIds, poleId];
    }
    if (equipPole(prog, poleId)) {
      writePoleProgress(prog);
      scheduleSave();
      const equipped = poleById(poleId);
      if (unlocking) {
        setPhase("renown");
        showToast(`⚡ Equipped ${equipped.name}`, 3200, { force: true });
        return;
      }
      if (state.phase === "pole_rack") setPhase("pole_rack");
      showToast(`Equipped ${equipped.name}`, 2800, { force: true });
    } else {
      showToast("That rod is still sleeping.", 2800, { force: true });
    }
    return;
  }
  if (action === "back:well") {
    closeHallView();
    if (conflicOnline?.tableId) void leaveOnlineTable("well");
    else setPhase("well");
    return;
  }
  if (action === "hall_view") {
    openHallView();
    return;
  }
  if (action === "ledger") {
    const archiveLines = formatCharterArchives(loadAnglerArchives(state.nickname));
    openMenu(ledgerStudioHtml(runSnapshot(), hallNoticeEntries(), archiveLines));
    elPrimary.hidden = true;
    return;
  }
  if (action === "herald_scroll") {
    openNeighborLore();
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
  if (action === "conflic_bouy") {
    // Play again with same mode/theme
    startConflicBouy();
    return;
  }
  if (action === "conflic_online_return") {
    void leaveOnlineTable("conflic_lobby");
    return;
  }
  if (action === "conflic_bouy_entry") {
    setPhase("conflic_theme");
    return;
  }
  if (action === "conflic_bouy_change") {
    // Go back to mode picker
    if (conflicMode === "online") {
      void leaveOnlineTable("conflic_theme");
      return;
    }
    setPhase("conflic_theme");
    return;
  }
  if (action === "conflic_local") {
    if (conflicOnline?.tableId) void leaveOnlineTable("conflic_theme");
    else setPhase("conflic_theme");
    return;
  }
  if (action === "conflic_lobby_refresh") {
    conflicOnline?.requestLobby();
    return;
  }
  if (action.startsWith("conflic_online_join:")) {
    const tableId = action.slice("conflic_online_join:".length);
    if (CONFLIC_TABLE_IDS.includes(tableId as ConflicTableId)) void joinOnlineTable(tableId as ConflicTableId);
    return;
  }
  if (action.startsWith("conflic_mode:")) {
    const mode = action.slice(13) as BouyMode;
    if (mode === "online") {
      conflicMode = mode;
      setPhase("conflic_lobby");
    } else if (mode === "agent" || mode === "hotseat") {
      conflicMode = mode;
      setPhase("conflic_theme_mode");
    }
    return;
  }
  if (action.startsWith("conflic_theme:")) {
    const theme = action.slice(14);
    if (theme) {
      conflicTheme = theme;
      if (conflicMode === "hotseat") {
        conflicStake = 0;
        startConflicBouy();
      } else {
        setPhase("conflic_stake");
      }
    }
    return;
  }
  if (action.startsWith("conflic_stake:")) {
    const stake = parseInt(action.slice(14), 10);
    if (!isNaN(stake) && stake >= 0) {
      conflicStake = stake;
      startConflicBouy();
    }
    return;
  }
  if (action.startsWith("chance:")) {
    const id = action.slice(7);
    if (!isChanceGameId(id)) {
      setPhase("chance_pick");
      return;
    }
    startChanceGame(id);
    return;
  }
  if (action.startsWith("feast:")) {
    const id = action.slice(6) as FoodId;
    buyFeast(id);
  }
}

function startChanceGame(id: ChanceGameId) {
  if (!isChanceGameId(id)) {
    setPhase("chance_pick");
    return;
  }
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
  announceDeed("feast", chronicle, subtext, undefined, {
    food: f.name,
    stake: f.cost,
    tokensLeft: state.tokens,
  });
  syncHallIdentity();
  hud();
  setPhase("well");
}

function finishChance(guess: string) {
  const gameId = state.chanceGame;
  if (!gameId || !isChanceGameId(gameId)) {
    setPhase("chance_pick");
    return;
  }
  if (!isGuessForGame(gameId, guess)) return;

  const game = CHANCE_GAMES.find((g) => g.id === gameId)!;
  if (state.tokens < game.stake) {
    setPhase("well");
    return;
  }

  let result;
  if (gameId === "high_low") {
    if (!isHighLowGuess(guess)) return;
    const first = state.chanceCards[0]!;
    const second = drawFromDeck(1)[0]!;
    state.chanceCards = [first, second];
    result = resolveHighLow(game.stake, first, second, guess);
  } else {
    if (!isRedBlackGuess(guess)) return;
    const drawn = drawFromDeck(1)[0]!;
    state.chanceCards = [drawn];
    result = resolveRedBlack(game.stake, drawn, guess);
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
  );
  announceDeed("gamble", chronicle, subtext, result.renownDelta, {
    game: result.game,
    outcome: result.outcome,
    cards: result.cards.map((c) => ({ label: c.label, rank: c.rank, suit: c.suit })),
    stake: game.stake,
    tokensLeft: state.tokens,
  });
  syncHallIdentity();
  hud();
  setPhase("chance_result");
}

function hud() {
  elHudR.textContent = `★ ${state.renown}`;
  elHudT.textContent = `◎ ${state.tokens}`;
  elHudS.textContent = `${SEASON_TAG[state.season] ?? "·"} ${seasonArcane[state.season].name.split(" ")[0]}`;
  elHudDeck.hidden = true;
  if (castStreak >= 2) {
    elHudChain.textContent = `⚡ MOONFIRE x${castStreak}`;
    elHudChain.hidden = false;
  } else {
    elHudChain.hidden = true;
  }
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
  if (warriorFailsafeTimer) {
    window.clearInterval(warriorFailsafeTimer);
    warriorFailsafeTimer = 0;
  }
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
  if (result.total >= 2500 && !state.titles.includes("Arcade Ace")) {
    state.titles.push("Arcade Ace");
  }
  syncHallIdentity();
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

let lastWarriorStage: string | undefined;

function syncWarriorShell() {
  if (state.phase === "demplar_warrior" && demplarGame) {
    const stage = demplarGame.stage;
    elPlayShell.dataset.warriorStage = stage;
    if (stage === "drmario" && lastWarriorStage !== "drmario") {
      showToast("TRIAL III — Veil Cure · match 4 to clear viruses", 2800);
    }
    lastWarriorStage = stage;
  } else {
    delete elPlayShell.dataset.warriorStage;
    lastWarriorStage = undefined;
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

  if (warriorFailsafeTimer) window.clearInterval(warriorFailsafeTimer);
  warriorFailsafeTimer = window.setInterval(() => {
    if (state.phase !== "demplar_warrior" || !demplarGame) {
      stopDemplarLoop();
      return;
    }
    const now = performance.now();
    demplarGame.update(0, now);
    syncWarriorShell();
    drawDemplar();
    if (demplarGame.done) finishDemplarRun();
  }, 1000);
}

function startDemplarWarrior() {
  primeWarriorSfx();
  demplarGame = new DemplarWarrior({ mobileEase: touchFriendly });
  setPhase("demplar_warrior");
  syncWarriorShell();
}

function startConflicBouy(theme?: string) {
  primeWarriorSfx();
  primeJackSparrow();
  conflicGame = new ConflicBouy({ 
    mode: conflicMode, 
    theme: (theme ?? conflicTheme) as "charter" | "odyssey" | "abyssal" | "corsair" | "voidwalker",
    stake: conflicStake
  });
  // Deduct stake from player tokens
  if (conflicMode === "agent" && conflicStake > 0) {
    state.tokens -= conflicStake;
  }
  setPhase("conflic_bouy");
}

function startOnlineConflic(view: ConflicPrivateRoomView) {
  conflicMode = "online";
  conflicTheme = view.tableId;
  conflicStake = 0;
  conflicLastResult = null;
  conflicLastRewards = { renown: 0, tokens: 0 };
  primeWarriorSfx();
  primeJackSparrow();
  conflicGame = new ConflicBouy({
    mode: "online",
    theme: view.tableId,
    stake: 0,
    onlineCallbacks: {
      deploy: (ships) => conflicOnline?.submitFleet(ships),
      fire: (x, y) => conflicOnline?.fire(x, y),
    },
  });
  conflicGame.applyOnlineView(view);
  setPhase("conflic_bouy");
  syncConflicOnlineState(view);
}

function syncConflicOnlineState(view: ConflicPrivateRoomView) {
  canvas.dataset.conflicTable = view.tableId;
  canvas.dataset.conflicPhase = view.phase;
  canvas.dataset.conflicTurn = view.turn == null ? "" : String(view.turn);
  canvas.dataset.conflicRevision = String(view.revision);
  canvas.dataset.conflicLastShot = view.lastShot?.actionId ?? "";
  canvas.setAttribute("aria-label", `Conflic Bouy ${view.tableId} table, ${view.phase}, ${view.turn === view.yourSeat ? "your turn" : "rival's turn"}`);
  syncConflicChat(view);
}

function setConflicChatOpen(open: boolean) {
  elConflicChat.classList.toggle("is-open", open);
  elConflicChatToggle.setAttribute("aria-expanded", String(open));
  if (open) {
    conflicChatUnread = 0;
    updateConflicChatUnread();
    requestAnimationFrame(() => {
      elConflicChatMessages.scrollTop = elConflicChatMessages.scrollHeight;
      elConflicChatInput.focus();
    });
  }
}

function updateConflicChatUnread() {
  elConflicChatUnread.hidden = conflicChatUnread === 0;
  elConflicChatUnread.textContent = conflicChatUnread > 9 ? "9+" : String(conflicChatUnread);
}

function hideConflicChat() {
  elConflicChat.hidden = true;
  setConflicChatOpen(false);
  conflicChatTable = null;
  conflicChatRenderKey = "";
  conflicChatUnread = 0;
  conflicChatKnownIds = new Set();
  updateConflicChatUnread();
}

function syncConflicChat(view: ConflicPrivateRoomView) {
  let announcement = "";
  if (conflicChatTable !== view.tableId) {
    conflicChatTable = view.tableId;
    conflicChatRenderKey = "";
    conflicChatUnread = 0;
    conflicChatKnownIds = new Set(view.chat.map((message) => message.id));
  } else {
    for (const message of view.chat) {
      if (!conflicChatKnownIds.has(message.id) && message.seat !== view.yourSeat && !elConflicChat.classList.contains("is-open")) {
        conflicChatUnread += 1;
      }
      if (!conflicChatKnownIds.has(message.id) && message.seat !== view.yourSeat) {
        announcement = `${message.name}: ${message.text}`;
      }
      conflicChatKnownIds.add(message.id);
    }
    conflicChatKnownIds = new Set(view.chat.map((message) => message.id));
  }

  elConflicChat.hidden = false;
  elConflicChatTable.textContent = view.tableId.toUpperCase();
  const rivalPresent = view.players[view.yourSeat === 0 ? 1 : 0] !== null;
  elConflicChatInput.disabled = !rivalPresent;
  elConflicChatSend.disabled = !rivalPresent;
  elConflicChatInput.placeholder = rivalPresent ? "Message rival..." : "Waiting for rival...";
  updateConflicChatUnread();
  if (announcement) elConflicChatAnnouncement.textContent = announcement;

  const renderKey = view.chat.map((message) => message.id).join("|");
  if (renderKey === conflicChatRenderKey) return;
  conflicChatRenderKey = renderKey;
  elConflicChatMessages.replaceChildren();
  for (const message of view.chat) {
    const item = document.createElement("li");
    item.className = message.seat === view.yourSeat ? "is-you" : "is-rival";
    const meta = document.createElement("span");
    const time = new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    meta.textContent = `${message.seat === view.yourSeat ? "YOU" : message.name.toUpperCase()} / ${time}`;
    const text = document.createElement("p");
    text.textContent = message.text;
    item.append(meta, text);
    elConflicChatMessages.append(item);
  }
  elConflicChatEmpty.hidden = view.chat.length > 0;
  if (elConflicChat.classList.contains("is-open")) {
    requestAnimationFrame(() => { elConflicChatMessages.scrollTop = elConflicChatMessages.scrollHeight; });
  }
}

elConflicChatToggle.addEventListener("click", () => setConflicChatOpen(true));
elConflicChatClose.addEventListener("click", () => {
  setConflicChatOpen(false);
  elConflicChatToggle.focus();
});
elConflicChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = elConflicChatInput.value.trim();
  if (!message || elConflicChatInput.disabled) return;
  elConflicChatInput.disabled = true;
  elConflicChatSend.disabled = true;
  try {
    const result = await conflicOnline?.sendChat(message);
    if (result?.ok) elConflicChatInput.value = "";
  } finally {
    const view = conflicOnline?.view;
    const rivalPresent = !!view?.players[view.yourSeat === 0 ? 1 : 0];
    elConflicChatInput.disabled = !rivalPresent;
    elConflicChatSend.disabled = !rivalPresent;
    if (rivalPresent && !elConflicChat.hidden) elConflicChatInput.focus();
  }
});

async function joinOnlineTable(tableId: ConflicTableId) {
  if (!conflicOnline?.connected) {
    showToast("Online tables cannot reach the Vercel game API.", 3600, { force: true });
    return;
  }
  showToast("Claiming a private seat…", 2200, { force: true });
  const result = await conflicOnline.join(tableId);
  if (!result.ok) {
    showToast(result.message, 4000, { force: true });
    conflicOnline.requestLobby();
    return;
  }
  startOnlineConflic(result.state);
}

async function leaveOnlineTable(next: GamePhase) {
  stopConflicLoop();
  await conflicOnline?.leave();
  conflicGame = null;
  delete canvas.dataset.conflicTable;
  delete canvas.dataset.conflicPhase;
  delete canvas.dataset.conflicTurn;
  delete canvas.dataset.conflicRevision;
  delete canvas.dataset.conflicLastShot;
  canvas.setAttribute("aria-label", "Game canvas");
  setPhase(next);
  if (next === "conflic_lobby") conflicOnline?.requestLobby();
}

function renderConflicLobby() {
  if (state.phase !== "conflic_lobby") return;
  openMenu(conflicLobbyStudioHtml(conflicRooms, !!conflicOnline?.connected, conflicOnline?.tableId));
  elPrimary.hidden = true;
  wirePhaseHub();
}

function drawConflic() {
  const { w, h } = syncCanvasBuffer();
  conflicGame?.draw(ctx, w, h);
}

function stopConflicLoop() {
  window.cancelAnimationFrame(conflicRaf);
  conflicRaf = 0;
}

function finishConflicRun() {
  if (!conflicGame) return;
  stopConflicLoop();
  const result = conflicGame.result;
  conflicLastResult = result;
  const minePayout = result.mine?.payout ?? 0;
  conflicLastRewards = conflicMode === "online"
    ? { renown: 0, tokens: 0 }
    : conflicMode === "hotseat"
    ? { renown: 0, tokens: minePayout }
    : {
        renown: renownFromBouyScore(result),
        tokens: tokensFromBouyScore(result, conflicStake) + minePayout,
      };
  addRenown(conflicLastRewards.renown);
  state.tokens += conflicLastRewards.tokens;
  if (result.mine) {
    const m = result.mine.stats;
    recordMineRun(state.nickname, {
      scans: m.scansUsed,
      ore: m.oreFound,
      payNodes: m.payNodesHit,
      blocks: m.blocksMined,
      payout: result.mine.payout,
      poolFed: m.poolContributed,
    });
  }
  syncHallIdentity();
  const isVictory = result.winner === "player" || result.winner === "player1";
  const hotseatWinner = result.winner === "player1" ? "Player 1" : "Player 2";
  const mineBit = result.mine ? ` · mined ${result.mine.stats.oreFound} ore, ${result.mine.stats.blocksMined} blocks${result.mine.stats.payNodesHit ? `, ${result.mine.stats.payNodesHit} paydays` : ""} (~${minePayout} ◎)` : "";
  const chronicle = conflicMode === "hotseat"
    ? `${hotseatWinner} wins a local Conflic Bouy duel at ${state.nickname}'s table.`
    : `${state.nickname} ${isVictory ? "commands the fleet to victory" : "watches their fleet slip beneath the waves"} in Conflic Bouy (${conflicMode}).`;
  const subtext = `${result.playerHits} hits, ${result.playerMisses} misses · ${result.turns} turns · ${conflicMode === "hotseat" ? `${hotseatWinner} wins` : isVictory ? "victory" : "defeat"}${mineBit}`;
  announceDeed("conflic_bouy", chronicle, subtext, conflicLastRewards.renown, { winner: result.winner, turns: result.turns });
  hud();
  setPhase("conflic_bouy_result");
}

function startConflicLoop() {
  lastConflicT = performance.now();
  const tick = (now: number) => {
    if (state.phase !== "conflic_bouy" || !conflicGame) return;
    const dt = Math.min(48, now - lastConflicT);
    lastConflicT = now;
    conflicGame.update(dt);
    drawConflic();
    if (conflicGame.phase === "over") {
      finishConflicRun();
      return;
    }
    conflicRaf = requestAnimationFrame(tick);
  };
  conflicRaf = requestAnimationFrame(tick);
}

let lastConflicT = 0;

bindWarriorTouch({
  touchFriendly,
  canvas,
  getPhase: () => state.phase,
  getGame: () => demplarGame,
  buttons: {
    left: elWarriorLeft,
    right: elWarriorRight,
    rotate: elWarriorRotate,
    drop: elWarriorDrop,
    hard: elWarriorHard,
    jump: elWarriorJump,
  },
});

function bindConflicTouch() {
  const onDown = (e: PointerEvent) => {
    if (state.phase !== "conflic_bouy" || !conflicGame) return;
    const rect = canvas.getBoundingClientRect();
    conflicGame.pointerDown(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
  };
  const onMove = (e: PointerEvent) => {
    if (state.phase !== "conflic_bouy" || !conflicGame) return;
    const rect = canvas.getBoundingClientRect();
    conflicGame.pointerMove(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
  };
  const onUp = () => {
    if (state.phase !== "conflic_bouy" || !conflicGame) return;
    // no special pointerup logic needed for now
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
}

bindConflicTouch();

function drawWell(phaseOverride?: GamePhase) {
  const { w, h } = syncCanvasBuffer();
  const phase = phaseOverride ?? state.phase;
  const green = reelGreenZone();
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
      loreLine: fishingLoreLine,
      now: performance.now(),
      poleId: state.equippedPoleId,
      greenLo: green.lo,
      greenHi: green.hi,
      avatarId: state.avatarId,
      avatarCustom: state.avatarCustom,
    },
    w,
    h,
  );
}

/** Rarity-keyed DOM confetti + arpeggio while the catch card is up. */
function startResolveCelebration(rarity: string) {
  const tier = ["common", "uncommon", "rare", "omen", "mythic"].indexOf(rarity);
  playCelebrationArp(Math.max(0, tier));
  if (navigator.vibrate) {
    navigator.vibrate(tier >= 3 ? [18, 40, 18, 40, 30] : [18, 40, 18]);
  }
  const palette = RARITY_COLORS[rarity] ?? RARITY_COLORS.common!;
  const host =
    elPlayMenu.querySelector<HTMLElement>(".play-menu-body") ?? elPhase;
  if (host) {
    const w = host.clientWidth || 320;
    const h = host.clientHeight || 420;
    const originX = w / 2;
    const originY = Math.max(90, h * 0.2);
    const bits = rarity === "mythic" || rarity === "omen" ? 30 : 20;
    for (let i = 0; i < bits; i++) {
      const bit = document.createElement("span");
      bit.className = "confetti-bit";
      bit.style.left = `${originX}px`;
      bit.style.top = `${originY}px`;
      bit.style.background = palette[i % palette.length]!;
      host.appendChild(bit);
      const dx = (Math.random() - 0.5) * w * 0.92;
      const dy = h * (0.3 + Math.random() * 0.45);
      const rot = (Math.random() - 0.5) * 640;
      const anim = bit.animate(
        [
          { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(calc(${dx}px - 50%), ${dy}px) rotate(${rot}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: 950 + Math.random() * 750,
          delay: Math.random() * 140,
          easing: "cubic-bezier(0.15, 0.6, 0.4, 1)",
          fill: "forwards",
        },
      );
      anim.addEventListener("finish", () => bit.remove());
    }
  }
}

function setPhase(next: GamePhase) {
  state.phase = next;
  elPlayShell.dataset.phase = next;
  if (next !== "conflic_bouy" || conflicMode !== "online") hideConflicChat();
  clearAutoPhase();
  stageBanner = "";
  fishingLoreLine = "";
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
      primeFishingSfx();
      state.castPower = 0;
      elPrimary.textContent = "HOLD TO CAST";
      fishingLoreLine = pickLine(castLoreLines);
      fishingBanner(pickLine(castBarks));
      requestAnimationFrame(() => {
        resizeCanvas();
        startCastLoop();
      });
      break;
    case "fish_wait":
      closeMenu();
      state.biteWindowOpen = false;
      struckBite = false;
      fishingLoreLine = pickLine(waitLoreLines);
      fishingBanner(pickLine(waitBarks));
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
      fishingLoreLine = pickLine(reelLoreLines);
      fishingBanner(pickLine(reelBarks));
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
      const poleNote =
        state.lastPoleXpGain != null
          ? `Pole XP +${state.lastPoleXpGain} · total ${state.poleXp} · ${currentPole().icon} ${currentPole().name}`
          : undefined;
      openMenu(
        catchResolveHtml(
          c,
          pickLine(resolveFlourish[c.rarity]),
          fishBlurb(c.fishId),
          poleNote,
          fishGlyph(c.fishId),
          lastCatchFlair,
        ),
      );
      elPrimary.hidden = true;
      wirePhaseHub();
      startResolveCelebration(c.rarity);
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
      const gameId = state.chanceGame;
      if (!gameId || !isChanceGameId(gameId)) {
        setPhase("chance_pick");
        break;
      }
      if (gameId === "high_low") {
        if (state.chanceCards.length === 0) state.chanceCards = drawFromDeck(1);
        const first = state.chanceCards[0]!;
        openMenu(chanceHighLowPlayHtml(first));
      } else {
        state.chanceCards = [];
        openMenu(chanceRedBlackPlayHtml());
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
    case "pole_rack": {
      openMenu(
        poleRackStudioHtml({
          xp: state.poleXp,
          equippedId: state.equippedPoleId,
          unlockedIds: state.unlockedPoleIds,
        }),
      );
      showToast("");
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    case "avatar_closet": {
      openMenu(
        avatarClosetStudioHtml({
          avatarId: state.avatarId,
          avatarCustom: state.avatarCustom,
        }),
      );
      showToast("");
      elPrimary.hidden = true;
      wirePhaseHub();
      wireAvatarCloset();
      break;
    }
    case "conflic_theme": {
      openMenu(conflicThemePickStudioHtml());
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    case "conflic_theme_mode": {
      openMenu(conflicThemePickStudioHtmlForMode(conflicMode === "hotseat" ? "hotseat" : "agent"));
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    case "conflic_lobby": {
      renderConflicLobby();
      conflicOnline?.requestLobby();
      break;
    }
    case "conflic_stake": {
      openMenu(conflicStakePickStudioHtml(conflicMode === "hotseat" ? "hotseat" : "agent", conflicTheme));
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
    case "conflic_bouy":
      closeMenu();
      showToast("");
      elPrimary.hidden = true;
      requestAnimationFrame(() => {
        resizeCanvas();
        drawConflic();
        startConflicLoop();
      });
      break;
    case "conflic_bouy_result": {
      const r = conflicLastResult ?? conflicGame?.result ?? { winner: null, playerHits: 0, playerMisses: 0, agentHits: 0, agentMisses: 0, turns: 0 };
      openMenu(
        conflicResultStudioHtml(
          r,
          conflicLastRewards.renown,
          conflicLastRewards.tokens,
          conflicMode,
        ),
      );
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
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
  if (state.phase !== "demplar_warrior" && state.phase !== "conflic_bouy") drawWell();
  syncWarriorShell();
  broadcastFishing(true);
  broadcastChance();
  scheduleSave();
}

function startCastLoop() {
  const tick = (now: number) => {
    if (state.phase !== "fish_cast") return;
    waitPulse = now / 1000;
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
    triggerBiteFlash();
    playNibble();
    if (navigator.vibrate) navigator.vibrate([12, 30, 18]);
    drawWell();
    broadcastFishing(true);
    biteOpenTimer = window.setTimeout(() => {
      state.biteWindowOpen = false;
      elStrike.hidden = true;
      if (state.phase === "fish_wait") setPhase("fish_reel");
    }, touchFriendly ? 980 + biteWindowBonusMs() + Math.random() * 380 : 620 + biteWindowBonusMs() + Math.random() * 220);
  }, delay);
}

function finishReel(good: number, total: number) {
  if (reelFinishing || state.phase !== "fish_reel") return;
  reelFinishing = true;
  clearFishingTimers();
  reelHoldDir = 0;
  reelQuality = Math.min(1, good / (total * 0.45));
  triggerLandFlash();
  playLandThump();
  try {
    const pole = currentPole();
    const result = rollCatch({
      castQuality,
      struckBite,
      reelQuality,
      season: state.season,
      rarityBias: pole.mods.rarityBias,
      omenLuck: pole.mods.omenLuck,
      renownMult: pole.mods.renownMult,
    });
    const feastBuff = state.foodBuff;
    const withFood = applyFoodOnCatch(result);
    // Moonfire Chain — perfect cast + clean strike + steady reel pays extra.
    const flawless =
      castWasPerfect && struckBite && reelQuality >= 0.55;
    let chainBonus = 0;
    if (flawless) {
      chainBonus = Math.ceil(
        withFood.renown * 0.25 * Math.min(3, Math.max(1, castStreak)),
      );
      withFood.renown += chainBonus;
    }
    const isNewSpecies = !state.catalog.has(withFood.fishId);
    lastCatchFlair = { flawless, chainBonus, isNew: isNewSpecies };
    state.lastCatch = withFood;
    addRenown(state.lastCatch.renown);
    state.tokens += state.lastCatch.tokens;
    state.catalog.add(result.fishId);
    if (result.rarity === "mythic" && !state.titles.includes("Moonwell Legend")) {
      state.titles.push("Moonwell Legend");
    }
    if (result.rarity === "omen" && !state.titles.includes("Omen Reader")) {
      state.titles.push("Omen Reader");
    }
    const prog = poleProgressFromState();
    const xpAward = awardCatchXp(prog, result.rarity, reelQuality);
    writePoleProgress(prog);
    state.lastPoleXpGain = xpAward.gained;
    mergePoleUnlocks(xpAward.newlyUnlocked);
    announceCatch(state.lastCatch, feastBuff);
    syncHallIdentity();
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
  let last = t0;
  const green = reelGreenZone();
  reelGoodMs = 0;

  reelFailsafeTimer = window.setTimeout(() => {
    if (state.phase === "fish_reel" && !reelFinishing) {
      finishReel(reelGoodMs, total);
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

    const inZone = state.reelTension >= green.lo && state.reelTension <= green.hi;
    reelGoodMs += inZone ? dt : dt * 0.12 * FISH_PACE;

    if (reelHoldDir && Math.floor(now / 180) !== Math.floor((now - dt) / 180)) {
      playReelCreak(!inZone);
    }

    state.reelProgress = Math.min(1, reelGoodMs / (total * 0.42));

    waitPulse = now / 1000;
    drawWell();
    broadcastFishing();

    if (state.reelProgress >= 1 || now - t0 >= total) {
      finishReel(reelGoodMs, total);
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
    finishReel(reelGoodMs, REEL_DURATION_MS);
  }
});
function finishCast() {
  if (state.phase !== "fish_cast") return;
  chargeActive = false;
  const perfect = state.castPower > CAST_SWEET_LO && state.castPower < CAST_SWEET_HI;
  castWasPerfect = perfect;
  castQuality = Math.max(consumeCastFloor(), state.castPower);
  window.cancelAnimationFrame(rafCast);
  const prog = poleProgressFromState();
  const xpAward = awardCastXp(prog);
  writePoleProgress(prog);
  mergePoleUnlocks(xpAward.newlyUnlocked);
  triggerCastFx(castQuality);
  playCastWhoosh();
  window.setTimeout(() => playSplash(), 280);
  if (perfect) {
    castStreak += 1;
    triggerPerfectCast();
    playPerfectChime();
    showToast(
      castStreak >= 2 ? `PERFECT CAST! ⚡ MOONFIRE x${castStreak}` : "PERFECT CAST!",
      1500,
      { force: true },
    );
    if (navigator.vibrate) navigator.vibrate([14, 30, 22]);
  } else {
    if (state.castPower < 0.5) {
      castStreak = 0;
      hud();
    }
  }
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
    triggerStrikeFlash();
    playStrikeHit();
    if (navigator.vibrate) navigator.vibrate(28);
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
  const target = e.target;
  if (e.code === "Escape" && target instanceof Node && elConflicChat.contains(target) && elConflicChat.classList.contains("is-open")) {
    e.preventDefault();
    setConflicChatOpen(false);
    elConflicChatToggle.focus();
    return;
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) {
    return;
  }
  if (state.phase === "demplar_warrior") {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      demplarGame?.jump();
    }
    if (e.code === "ArrowDown") {
      e.preventDefault();
      if (demplarGame?.stage === "drmario" && e.repeat) return;
      demplarGame?.boost(true);
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      demplarGame?.steer(-1, false);
    }
    if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      demplarGame?.steer(1, false);
    }
    if (e.code === "KeyF") {
      e.preventDefault();
      demplarGame?.hardDrop();
    }
    return;
  }
  if (state.phase === "conflic_bouy") {
    if (e.code === "KeyR") {
      e.preventDefault();
      conflicGame?.keyDown("R");
    }
    if (e.code === "KeyA") {
      e.preventDefault();
      conflicGame?.keyDown("A");
    }
    if (e.code === "KeyE") {
      e.preventDefault();
      conflicGame?.keyDown("E");
    }
    if (e.code === "KeyD") {
      e.preventDefault();
      conflicGame?.keyDown("D");
    }
    // Number keys for abilities (1-5)
    if (e.code.startsWith("Digit") || e.code.startsWith("Numpad")) {
      const num = e.code.replace("Digit", "").replace("Numpad", "");
      if (num >= "1" && num <= "5") {
        e.preventDefault();
        conflicGame?.keyDown(num);
      }
    }
    if (e.code === "Escape") {
      e.preventDefault();
      if (conflicMode === "online") void leaveOnlineTable("conflic_lobby");
      else setPhase("well");
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
    triggerStrikeFlash();
    playStrikeHit();
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
  const target = e.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
  if (state.phase === "demplar_warrior") {
    if (e.code === "Space" || e.code === "ArrowUp") {
      demplarGame?.releaseJump();
    }
    if (e.code === "ArrowDown") {
      if (demplarGame?.stage !== "drmario") demplarGame?.boost(false);
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
  if (state.phase === "demplar_warrior" && demplarGame) drawDemplar();
  else if (state.phase === "conflic_bouy" && conflicGame) drawConflic();
  else drawWell();
}

window.addEventListener("resize", resizeCanvas);

function fillNotices() {
  elNotices.innerHTML = hallNoticeEntries().map(renderNoticeCardLi).join("");
  if (state.phase === "well" && !elPlayMenu.hidden) {
    openMenu(buildWellHubHtml());
    elPrimary.hidden = true;
  }
}

onXLoreFeedUpdate(() => fillNotices());

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
    const c = await connectTrail(url, "trailJson", {
      name: state.nickname,
      title: wornTitle(state.titles),
      catalogSize: state.catalog.size,
      tokens: state.tokens,
      avatarId: state.avatarId,
    });
    socket = c.socket;
    if (!socket) throw new Error("trail socket unavailable");
    mobileHall.bindSocket(socket);
    const liveSocket = socket;
    const syncLive = () => {
      mobileHall.bindSocket(liveSocket);
      if (state.phase !== "enter" && state.phase !== "herald") {
        setPresence(true);
        syncHallIdentity();
        broadcastFishing(true);
        broadcastChance();
      }
    };
    liveSocket.on("connect", syncLive);
    syncLive();
    elTrail.textContent = "Live hall — your deeds sync to the bigboard chronicle.";
  } catch {
    socket = null;
    mobileHall.bindSocket(null);
    elTrail.textContent = "Live hall offline — run npm run live, then hard-refresh Play + bigboard.";
  }
}

function bootConflicOnline() {
  conflicOnline = new ConflicOnlineClient({
    name: state.nickname,
    avatarId: state.avatarId,
    onLobby: (rooms) => {
      conflicRooms = rooms;
      renderConflicLobby();
    },
    onState: (view) => {
      if (conflicMode !== "online" || state.phase !== "conflic_bouy" || !conflicGame) return;
      conflicGame.applyOnlineView(view);
      syncConflicOnlineState(view);
      drawConflic();
    },
    onError: (message) => {
      if (state.phase === "conflic_lobby" || conflicMode === "online") showToast(message, 3600, { force: true });
    },
    onConnection: () => renderConflicLobby(),
    onSessionLost: () => {
      if (conflicMode !== "online") return;
      stopConflicLoop();
      conflicGame = null;
      setPhase("conflic_lobby");
      showToast("Your table seat expired. Choose an open seat to return.", 4200, { force: true });
    },
  });
}

async function startGameFromGate() {
  const raw = elNick.value.trim() || "Anonymous Angler";
  const display = raw.slice(0, 28);
  const peek = peekAnglerSave(display);
  state = loadAnglerState(display) ?? initialState(display);
  state.avatarId = gateAvatarId;
  state.avatarCustom = gateAvatarCustom;
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
  applyDailyMediaChrome(loadedTheme);
  await bootTrail();
  bootConflicOnline();
  requestAnimationFrame(() => {
    resizeCanvas();
    setPhase("well");
    if (peek) {
      showToast(
        `Tavern ${formatCharterDayLabel(charterDayId())} — ★${state.renown} renown · ◎${state.tokens} tokens`,
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
preloadPoleSprites([
  "whistler_stick",
  "dockhand_reed",
  "coppercoil_switch",
  "mourningglass",
  "boneflute",
  "astral_wormwood",
  "demon_spinner",
  "chronicle_lance",
  "moonshatter",
]);
preloadArdyFishingClips();
void loadDailyMediaTheme().then((theme) => {
  loadedTheme = theme;
  applyDailyMediaChrome(theme);
});
window.addEventListener("beforeunload", () => {
  if (state.phase !== "enter" && state.phase !== "herald") saveAnglerState(state);
});

requestAnimationFrame(function tick(now: number) {
  waitPulse = now / 1000;
  if (
    state.phase === "fish_wait" ||
    state.phase === "fish_cast" ||
    state.phase === "fish_reel"
  ) {
    if (state.phase === "fish_wait") drawWell();
  }
  requestAnimationFrame(tick);
});

if (import.meta.env.DEV) {
  (window as Window & { __tavernQA?: { getDemplar: () => DemplarWarrior | null; getCastStreak: () => number } }).__tavernQA = {
    getDemplar: () => demplarGame,
    getCastStreak: () => castStreak,
  };
}
