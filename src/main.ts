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
  seasonFlavor,
  tavernTeasers,
  triviaWell,
} from "./content/lore";
import { initialState } from "./game/state";
import type { CatchResult, GamePhase, GameState } from "./game/types";
import { drawMoonwell, seasonTints } from "./minigames/fishingCanvas";
import { rollCatch } from "./minigames/fishing";
import { connectTrail } from "./net/trailClient";
import { resolveTrailServerUrl } from "./net/trailResolve";
import type { Socket } from "socket.io-client";

const $ = (id: string) => document.getElementById(id)!;

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
const canvas = $("well") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const elNotices = $("notices");
const elCredits = $("credits-text");
const elModal = $("modal-demplar");
const elModalBody = $("modal-body");
const elBtnCharter = $("btn-charter");
const elBtnCloseModal = $("btn-close-modal");

elTitle.textContent = GAME_TITLE;
elTag.textContent = tavernTeasers[Math.floor(Math.random() * tavernTeasers.length)]!;
elCredits.textContent = creditsLine;

let state: GameState = initialState("Traveler");
let socket: Socket | null = null;

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

function hud() {
  elHudR.textContent = `Renown: ${state.renown}`;
  elHudT.textContent = `Tavern tokens: ${state.tokens}`;
  elHudS.textContent = seasonFlavor[state.season];
}

function drawWell(phaseOverride?: GamePhase) {
  const phase = phaseOverride ?? state.phase;
  const w = canvas.clientWidth || 520;
  const h = canvas.clientHeight || 420;
  drawMoonwell(ctx, {
    phase,
    castPower: state.castPower,
    biteOpen: state.biteWindowOpen,
    waitPulse,
    reelTension: state.reelTension,
    reelProgress: state.reelProgress,
    seasonTint: seasonTints[state.season] ?? "#b8e8ff",
  }, w, h);
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
    case "enter":
      elPhase.innerHTML = `<p>${tavernTeasers[Math.floor(Math.random() * tavernTeasers.length)]}</p>
        <p class="muted">${seasonFlavor[state.season]}</p>`;
      elPrimary.textContent = "Step into the tavern hall";
      break;
    case "herald":
      elPhase.innerHTML = `<p><strong>Herald:</strong> ${heraldLines[Math.floor(Math.random() * heraldLines.length)]}</p>`;
      elPrimary.textContent = "Approach the Moonwell";
      break;
    case "well":
      elPhase.innerHTML = `<p>The Moonwell breathes mist. Hooks clink like bells. This is the heart of the night—cast, and the hall remembers.</p>
        <p class="muted">Season: ${state.season}. Tokens: ${state.tokens}. Most paths return here.</p>`;
      elPrimary.textContent = "Cast into the Moonwell";
      break;
    case "fish_cast":
      state.castPower = 0;
      elPhase.innerHTML = `<p>Draw the line true. <strong>Hold</strong> the cast button or press <kbd>Space</kbd> to fill the golden gauge, then <strong>release</strong> to send the hook.</p>`;
      elPrimary.textContent = "Hold to draw — release to cast";
      startCastLoop();
      break;
    case "fish_wait":
      state.biteWindowOpen = false;
      struckBite = false;
      elPhase.innerHTML = `<p>The ripples count your patience. When the well opens its jaw—<strong>strike</strong>!</p>`;
      elPrimary.hidden = true;
      scheduleBiteWindow();
      break;
    case "fish_reel":
      state.reelTension = 0.45;
      state.reelProgress = 0;
      reelQuality = 0;
      elPhase.innerHTML = `<p>The catch runs. Keep the bob in the <strong>jade band</strong>—Slack / Heave, or <kbd>A</kbd> / <kbd>D</kbd>.</p>`;
      elPrimary.hidden = true;
      elReel.hidden = false;
      startReelLoop();
      break;
    case "resolve": {
      const c = state.lastCatch!;
      const extra = c.demplarTease
        ? `<p class="muted">A scrap of rumor: the name <strong>Demplar</strong> rides this catch like a watermark.</p>`
        : "";
      const om = c.omen ? `<p><em>Omen:</em> ${c.omen}</p>` : "";
      elPhase.innerHTML = `<p>You land <strong>${c.name}</strong> <span class="muted">(${c.rarity})</span>.</p>
        <p>${fishBlurb(c.fishId)}</p>${om}${extra}`;
      elPrimary.textContent = "Claim renown";
      break;
    }
    case "renown":
      elPhase.innerHTML = `<p>Renown swells: <strong>${state.renown}</strong>. Titles: ${state.titles.length ? state.titles.join(", ") : "none yet—the well is patient."}</p>`;
      elPrimary.textContent = state.runCount % 2 === 0 ? "Face a perilous choice" : "Answer the well’s riddle";
      break;
    case "peril": {
      const p = perilBeats[state.perilIndex % perilBeats.length]!;
      elPhase.innerHTML = `<p><strong>Peril on the road:</strong> ${p.q}</p>
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
      elPhase.innerHTML = `<p><strong>Well riddle:</strong> ${t.q}</p>
        <div class="trivia-btns" id="trivia-btns"></div>`;
      elPrimary.hidden = true;
      const wrap = elPhase.querySelector("#trivia-btns")!;
      t.choices.forEach((c, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn big ghost";
        b.textContent = c;
        b.addEventListener("click", () => {
          state.renown += i === t.ok ? 4 : 1;
          state.triviaIndex++;
          state.runCount++;
          hud();
          setPhase("well");
        });
        wrap.appendChild(b);
      });
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
    }, 620 + Math.random() * 220);
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
      state.lastCatch = result;
      state.renown += result.renown;
      state.tokens += result.tokens;
      state.catalog.add(result.fishId);
      if (result.rarity === "mythic" && !state.titles.includes("Charter Angler")) state.titles.push("Charter Angler");
      if (result.rarity === "omen" && !state.titles.includes("Omen Reader")) state.titles.push("Omen Reader");
      announceCatch(result);
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
    case "well":
      if (state.tokens < 1) {
        state.tokens += 1;
        hud();
      }
      setPhase("fish_cast");
      break;
    case "resolve":
      setPhase("renown");
      break;
    case "renown":
      setPhase(state.runCount % 2 === 0 ? "peril" : "trivia");
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
  castQuality = state.castPower;
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
    "Big catches are sung here before they are sold.",
    "Duels of wit: loser buys the next round of bait.",
    "The one that got away is always mythic—check the Hall board.",
  ];
  items.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    elNotices.appendChild(li);
  });
}

elBtnCharter.addEventListener("click", () => {
  elModalBody.textContent = demplarModalIntro;
  elModal.hidden = false;
});
elBtnCloseModal.addEventListener("click", () => {
  elModal.hidden = true;
});

async function bootTrail() {
  const { url, source } = await resolveTrailServerUrl();
  if (!url) {
    elTrail.textContent = "Hall link: offline (set VITE_TRAIL_SERVER_URL or /trail.json)";
    return;
  }
  elTrail.textContent = `Hall link: ${url} (${source})`;
  try {
    const c = await connectTrail(url, source, { name: state.nickname });
    socket = c.socket;
  } catch {
    elTrail.textContent = `Hall link unreachable: ${url}`;
  }
}

$("btn-enter-name").addEventListener("click", async () => {
  const name = elNick.value.trim() || "Anonymous Angler";
  state = initialState(name.slice(0, 28));
  elGate.hidden = true;
  elGame.hidden = false;
  fillNotices();
  await bootTrail();
  resizeCanvas();
  setPhase("enter");
});

requestAnimationFrame(() => {
  waitPulse += 0.016;
});
