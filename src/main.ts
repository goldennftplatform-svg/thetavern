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
  WORLD_EPIGRAPH,
  castWhispers,
  chanceTableIntro,
  enterPrologues,
  feastIntro,
  hubVerse,
  pickLine,
  renownTitleHint,
  resolveFlourish,
  seasonArcane,
  waitWhispers,
  reelWhispers,
  noticeBoardArcane,
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
import { buildMoonwellDeck, MOONWELL_DECK_LORE, shuffleDeck } from "./minigames/moonwellDeck";
import { loadDailyMediaTheme, platformLabel } from "./media/loadTheme";
import { utcDayKey } from "./media/dailyPick";
import type { LoadedMediaTheme } from "./media/types";
import { rollCatch } from "./minigames/fishing";
import { connectTrail } from "./net/trailClient";
import { resolveTrailServerUrl } from "./net/trailResolve";
import type { Socket } from "socket.io-client";
import { initMobileShellClass } from "./mobile-detect";
import {
  chanceGameButtonHtml,
  feastButtonHtml,
  hubChoiceHtml,
  renderCardRow,
  renderNightBanner,
  wireHubClicks,
} from "./ui/tavernHub";

initMobileShellClass();

const $ = (id: string) => document.getElementById(id)!;

/** Slightly longer strike window on touch (coarse pointer) */
const touchFriendly =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

const elTitle = $("title");
const elTag = $("tagline");
const elTrail = $("trail-status");
const elGate = $("nickname-gate");
const elGame = $("game");
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

function fishBlurb(id: string): string {
  return fishCatalog.find((f) => f.id === id)?.blurb ?? "The well gives what it gives.";
}

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

function buildWellHubHtml(): string {
  const night = tonightUtc();
  const buffLine = state.foodBuff
    ? `<p class="muted">Kitchen buff active: ${state.foodBuff.label}</p>`
    : "";
  return `${renderNightBanner(night.title, night.tagline, night.herald)}
    <p class="world-epigraph">${hubVerse}</p>
    <p class="muted">${seasonArcane[state.season].name} — ${seasonArcane[state.season].verse}</p>
    ${buffLine}
    <div class="hub-grid" id="hub-grid">
      ${hubChoiceHtml("F", "Cast the Moonwell", "The charter rite—skill, luck, and legend.", "fish", "gold")}
      ${hubChoiceHtml("C", "Divination table", "Ascendant / Descendant & Mark of the Mist.", "chance_menu", "jade")}
      ${hubChoiceHtml("K", "Enchanted kitchen", "Tonight's board—pretzels, peanuts, pie, and carnival fare.", "feast_menu", "jade")}
    </div>
    <p class="deck-lore muted">${MOONWELL_DECK_LORE}</p>`;
}

function wirePhaseHub() {
  wireHubClicks(elPhase, handleHubAction);
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
    elPhase.innerHTML = `<p class="muted">You need ${game.stake} token to sit at this table.</p>
      <div class="hub-grid">${hubChoiceHtml("←", "Back to the well", "", "back:well", "ghost")}</div>`;
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
    elPhase.innerHTML = `<p class="muted">The kitchen wants ${f.cost} token${f.cost === 1 ? "" : "s"} for ${f.name}.</p>
      <div class="hub-grid">${hubChoiceHtml("←", "Back to the well", "", "back:well", "ghost")}</div>`;
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
  elHudR.textContent = `Legend: ${state.renown}`;
  elHudT.textContent = `Charter tokens: ${state.tokens}`;
  elHudS.textContent = seasonArcane[state.season].name;
  if (loadedTheme) {
    elHudDeck.textContent = `DECK: ${platformLabel(loadedTheme.platform, utcDayKey())}`;
    elHudDeck.hidden = false;
  } else {
    elHudDeck.textContent = "";
    elHudDeck.hidden = true;
  }
  if (state.foodBuff) {
    elHudBuff.textContent = `BUFF: ${state.foodBuff.label}`;
    elHudBuff.hidden = false;
  } else {
    elHudBuff.textContent = "";
    elHudBuff.hidden = true;
  }
}

function drawWell(phaseOverride?: GamePhase) {
  const phase = phaseOverride ?? state.phase;
  const w = canvas.clientWidth || 520;
  const h = canvas.clientHeight || 420;
  drawMoonwell(
    ctx,
    {
      phase,
      castPower: state.castPower,
      biteOpen: state.biteWindowOpen,
      waitPulse,
      reelTension: state.reelTension,
      reelProgress: state.reelProgress,
      seasonTint: seasonTints[state.season] ?? "#b8e8ff",
    },
    w,
    h,
    loadedTheme,
  );
}

function setPhase(next: GamePhase) {
  state.phase = next;
  elStrike.hidden = true;
  elReel.hidden = true;
  elPrimary.hidden = false;
  chargeActive = false;
  window.cancelAnimationFrame(rafCast);
  window.clearTimeout(biteTimer);
  window.clearTimeout(biteOpenTimer);
  window.cancelAnimationFrame(reelRaf);

  if (next === "enter" || next === "herald") setPresence(false);
  else setPresence(true);

  switch (next) {
    case "enter": {
      const night = tonightUtc();
      const arc = seasonArcane[state.season];
      elPhase.innerHTML = `${renderNightBanner(night.title, night.tagline, night.herald)}
        <p class="world-epigraph">${WORLD_EPIGRAPH}</p>
        <p>${pickLine(enterPrologues)}</p>
        <p class="muted">${arc.name} — ${arc.verse}</p>`;
      elPrimary.textContent = "Cross the threshold into the hall";
      break;
    }
    case "herald": {
      const night = tonightUtc();
      elPhase.innerHTML = `<div class="herald-block"><strong>The Herald proclaims</strong> ${heraldLines[Math.floor(Math.random() * heraldLines.length)]}</div>
        <p class="muted arcane-prose">${night.herald}</p>`;
      elPrimary.textContent = "Approach the Moonwell";
      break;
    }
    case "well":
      elPhase.innerHTML = buildWellHubHtml();
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    case "fish_cast":
      state.castPower = 0;
      elPhase.innerHTML = `<p>${pickLine(castWhispers)}</p>`;
      elPrimary.textContent = "Hold to channel — release to cast";
      startCastLoop();
      break;
    case "fish_wait":
      state.biteWindowOpen = false;
      struckBite = false;
      elPhase.innerHTML = `<p>${pickLine(waitWhispers)}</p>`;
      elPrimary.hidden = true;
      scheduleBiteWindow();
      break;
    case "fish_reel":
      state.reelTension = 0.45;
      state.reelProgress = 0;
      reelQuality = 0;
      elPhase.innerHTML = `<p>${pickLine(reelWhispers)}</p>`;
      elPrimary.hidden = true;
      elReel.hidden = false;
      startReelLoop();
      break;
    case "resolve": {
      const c = state.lastCatch!;
      const extra = c.demplarTease
        ? `<p class="muted arcane-prose">A scrap of charter rumor: the name <strong>Demplar</strong> rides this catch like a watermark in glass.</p>`
        : "";
      const om = c.omen ? `<p class="arcane-prose"><em>Omen:</em> ${c.omen}</p>` : "";
      const flourish = pickLine(resolveFlourish[c.rarity]);
      const mythicCls = c.rarity === "mythic" ? " rarity-flourish--mythic" : "";
      elPhase.innerHTML = `<p class="catch-reveal">From the veil you land <strong>${c.name}</strong> <span class="muted">(${c.rarity})</span>.</p>
        <p class="arcane-prose">${fishBlurb(c.fishId)}</p>
        <p class="rarity-flourish${mythicCls}">${flourish}</p>${om}${extra}`;
      elPrimary.textContent = "Inscribe renown in the ledger";
      break;
    }
    case "renown":
      elPhase.innerHTML = `<p class="arcane-prose">Legend swells: <strong>${state.renown}</strong>. Titles: ${state.titles.length ? state.titles.join(", ") : "none yet—the well is patient."}</p>
        <p class="muted">${renownTitleHint(state.renown)}</p>`;
      elPrimary.textContent = state.runCount % 2 === 0 ? "Face a perilous choice" : "Answer the well's riddle";
      break;
    case "peril": {
      const p = perilBeats[state.perilIndex % perilBeats.length]!;
      elPhase.innerHTML = `<p class="arcane-prose"><strong>Crossroads at the rim:</strong> ${p.q}</p>
        <div class="peril-pair" id="peril-pair"></div>`;
      elPrimary.hidden = true;
      const pair = elPhase.querySelector("#peril-pair")!;
      p.a.forEach((label, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `btn big ${i === 0 ? "primary" : "ghost"}`;
        b.textContent = label;
        b.addEventListener("click", () => {
          state.perilIndex++;
          state.renown += 2 + i;
          state.runCount++;
          hud();
          setPhase("well");
        });
        pair.appendChild(b);
      });
      break;
    }
    case "trivia": {
      const t = triviaWell[state.triviaIndex % triviaWell.length]!;
      elPhase.innerHTML = `<p class="arcane-prose"><strong>Well riddle:</strong> ${t.q}</p>
        <div class="trivia-btns" id="trivia-btns"></div>`;
      elPrimary.hidden = true;
      const wrap = elPhase.querySelector("#trivia-btns")!;
      t.choices.forEach((c, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn big ghost";
        b.textContent = c;
        b.addEventListener("click", () => {
          const correct = i === t.ok;
          state.renown += correct ? 4 : 1;
          state.triviaIndex++;
          state.runCount++;
          hud();
          if ("teach" in t && t.teach && correct) {
            elPhase.innerHTML = `<p class="arcane-prose muted">${t.teach}</p>`;
            window.setTimeout(() => setPhase("well"), 2200);
          } else {
            setPhase("well");
          }
        });
        wrap.appendChild(b);
      });
      break;
    }
    case "chance_pick":
      elPhase.innerHTML = `<p class="arcane-prose"><strong>${chanceTableIntro}</strong></p>
        <div class="hub-grid" id="hub-grid">
          ${CHANCE_GAMES.map((g) => chanceGameButtonHtml(g.id, g.name, g.blurb, g.stake)).join("")}
          ${hubChoiceHtml("←", "Back to the well", "Return to the hub.", "back:well", "ghost")}
        </div>`;
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    case "chance_play": {
      const game = CHANCE_GAMES.find((g) => g.id === state.chanceGame)!;
      if (state.chanceGame === "high_low") {
        if (state.chanceCards.length === 0) {
          state.chanceCards = drawFromDeck(1);
        }
        const first = state.chanceCards[0]!;
        elPhase.innerHTML = `<p><strong>${game.name}</strong> — stake ${game.stake} token. Call the next card.</p>
          ${renderCardRow([first])}
          <div class="chance-actions" id="chance-actions">
            <button type="button" class="btn big primary" data-guess="high">Higher</button>
            <button type="button" class="btn big ghost" data-guess="low">Lower</button>
          </div>`;
      } else {
        const mark = state.overUnderTarget ?? 8;
        elPhase.innerHTML = `<p><strong>${game.name}</strong> — stake ${game.stake} token.</p>
          <p class="chance-mark">House mark: ${mark}</p>
          <p class="muted">One draw from the Moonwell deck — over or under the mark?</p>
          <div class="chance-actions" id="chance-actions">
            <button type="button" class="btn big primary" data-guess="over">Over ${mark}</button>
            <button type="button" class="btn big ghost" data-guess="under">Under ${mark}</button>
          </div>`;
      }
      elPrimary.hidden = true;
      elPhase.querySelectorAll<HTMLButtonElement>("[data-guess]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const g = btn.getAttribute("data-guess") as "high" | "low" | "over" | "under";
          finishChance(g);
        });
      });
      break;
    }
    case "chance_result": {
      const r = state.chanceLastResult!;
      const cards = renderCardRow(r.cards);
      const outcomeCls =
        r.outcome === "win"
          ? "chance-outcome-win"
          : r.outcome === "push"
            ? "muted"
            : "chance-outcome-lose";
      elPhase.innerHTML = `<p><strong>${r.title}</strong> — <span class="${outcomeCls}">${r.outcome.toUpperCase()}</span></p>
        ${cards}
        <p>${r.detail}</p>
        <p class="muted">Tokens ${r.tokenDelta >= 0 ? "+" : ""}${r.tokenDelta} · Renown +${r.renownDelta}</p>`;
      elPrimary.hidden = false;
      elPrimary.textContent = "Back to the well";
      break;
    }
    case "feast": {
      const night = tonightUtc();
      elPhase.innerHTML = `<p class="arcane-prose"><strong>${feastIntro}</strong> — ${night.title}</p>
        <p class="muted">One serving per delicacy per night. The next cast remembers what you ate.</p>
        <div class="hub-grid" id="hub-grid">
          ${night.specials
            .map((id) => feastButtonHtml(id, state.feastsEaten.includes(id)))
            .join("")}
          ${hubChoiceHtml("←", "Back to the well", "Return without ordering.", "back:well", "ghost")}
        </div>`;
      elPrimary.hidden = true;
      wirePhaseHub();
      break;
    }
    default:
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

elPrimary.addEventListener("click", () => {
  switch (state.phase) {
    case "enter":
      setPhase("herald");
      break;
    case "herald":
      setPhase("well");
      break;
    case "resolve":
      setPhase("renown");
      break;
    case "renown":
      setPhase(state.runCount % 2 === 0 ? "peril" : "trivia");
      break;
    case "chance_result":
      setPhase("well");
      break;
    default:
      break;
  }
});

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
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const logicalW = rect.width || 520;
  const logicalH = logicalW * (420 / 520);
  canvas.style.height = `${logicalH}px`;
  canvas.width = Math.floor(logicalW * dpr);
  canvas.height = Math.floor(logicalH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  closeDemplarModal();
  fillNotices();
  await ensurePixelFonts();
  loadedTheme = await loadDailyMediaTheme();
  await bootTrail();
  resizeCanvas();
  setPhase("enter");
}

$("btn-enter-name").addEventListener("click", () => {
  void startGameFromGate();
});
elBtnSkipGate.addEventListener("click", () => {
  elNick.value = "";
  void startGameFromGate();
});

requestAnimationFrame(() => {
  waitPulse += 0.016;
});
