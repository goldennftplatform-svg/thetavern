/**
 * Hall of the Angler — live projector wall around the Great Table.
 * Spectator client: hall:deed feed + moonwell:patrons on canvas seats.
 */
import { resolveTrailServerUrl } from "../net/trailResolve";
import { connectTrail } from "../net/trailClient";
import { initMobileShellClass } from "../mobile-detect";
import { heraldLines, tavernTeasers } from "../content/lore";
import { tonightUtc } from "../content/tavernNights";
import { bbIconForKind } from "./bbIcons";
import { drawTavernMap, resizeMapCanvas, type FishingPhase, type ChancePhase, type MapPatron, type MapFx } from "./tavernMap";
import type { SplashFx, TableFish } from "./tableFish";
import "./bigboard.css";

initMobileShellClass();

const feedEl = document.getElementById("feed")!;
const patronsEl = document.getElementById("patrons")!;
const statusEl = document.getElementById("status")!;
const liveDot = document.getElementById("bb-live-dot")!;
const calloutEl = document.getElementById("bb-callout") as HTMLDivElement;
const dockNight = document.getElementById("bb-dock-night")!;
const dockPatrons = document.getElementById("bb-dock-patrons")!;
const dockFact = document.getElementById("bb-dock-fact")!;
const dockTally = document.getElementById("bb-dock-tally")!;
const statsEl = document.getElementById("bb-stats")!;
const playLink = document.getElementById("bb-play-link") as HTMLAnchorElement;
const mapCanvas = document.getElementById("tavern-map") as HTMLCanvasElement;

const FEED_MAX = 24;
const CALLOUT_MS = 5200;
const PATRON_PULSE_MS = 4000;
const FACT_ROTATE_MS = 38_000;

/** Preview anglers when the hall server is offline — keeps the table alive. */
const DEMO_PATRONS: MapPatron[] = [{ name: "Example" }, { name: "Angler" }, { name: "Guest" }];

type Deed = {
  ts?: number;
  kind?: string;
  text?: string;
  renown?: number;
  fish?: string;
  rarity?: string;
  from?: string;
  game?: string;
  outcome?: string;
  cards?: Array<{ label: string; rank: number; suit: string }>;
  target?: number;
};

type HallTally = {
  catches: number;
  gambles: number;
  wins: number;
  feasts: number;
  mythics: number;
  renown: number;
};

let hallTally: HallTally = {
  catches: 0,
  gambles: 0,
  wins: 0,
  feasts: 0,
  mythics: 0,
  renown: 0,
};

let liveAnglers = 0;
let liveFishers = 0;
let liveGamblers = 0;

function isWallMode(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("wall") === "1") return true;
    return window.matchMedia("(min-width: 1100px) and (min-height: 600px)").matches;
  } catch {
    return false;
  }
}

function applyWallClass(): void {
  document.documentElement.classList.toggle("bb-wall", isWallMode());
}

applyWallClass();
window.addEventListener("resize", applyWallClass);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cardArrow(cards?: Deed["cards"]): string {
  if (!cards?.length) return "";
  if (cards.length === 1) return cards[0]!.label;
  return `${cards[0]!.label} → ${cards[1]!.label}`;
}

function lineForDeed(d: Deed): string {
  const who = d.from ? d.from : "A patron";
  if (d.kind === "catch" && d.fish) {
    return `${who} landed ${d.fish}${d.rarity ? ` (${d.rarity})` : ""} — ${d.renown ?? 0} renown`;
  }
  if (d.kind === "gamble") {
    const game = d.game === "over_under" ? "O/U" : "Hi-Lo";
    const cards = cardArrow(d.cards);
    const mark = d.game === "over_under" && d.target != null ? ` mark ${d.target}` : "";
    const verdict =
      d.outcome === "win" ? "WIN" : d.outcome === "push" ? "PUSH" : d.outcome === "lose" ? "LOSE" : "";
    const tail = d.renown ? ` (+${d.renown} renown)` : "";
    if (cards) {
      return `${who} ${game}${mark}: ${cards}${verdict ? ` — ${verdict}` : ""}${tail}`;
    }
    if (d.text) return `${who} at the chance table — ${d.text}${tail}`;
    return `${who} wagered at the chance table${tail}`;
  }
  if (d.kind === "feast" && d.text) {
    return `${who} ${d.text}`;
  }
  if (d.text) return `${who}: ${d.text}`;
  return `${who} did a deed worth telling.`;
}

function deedClass(kind?: string, outcome?: string): string {
  let cls = "bb-deed";
  if (kind === "catch") cls += " bb-deed--catch";
  if (kind === "gamble") {
    cls += " bb-deed--gamble";
    if (outcome === "win") cls += " bb-deed--win";
    if (outcome === "lose") cls += " bb-deed--lose";
  }
  if (kind === "feast") cls += " bb-deed--feast";
  return cls;
}

function bumpTally(d: Deed) {
  if (d.kind === "catch") {
    hallTally.catches += 1;
    if (d.rarity === "mythic") hallTally.mythics += 1;
  }
  if (d.kind === "gamble") {
    hallTally.gambles += 1;
    if (d.outcome === "win") hallTally.wins += 1;
  }
  if (d.kind === "feast") hallTally.feasts += 1;
  if (d.renown) hallTally.renown += d.renown;
  refreshStats();
}

function refreshStats() {
  const bits: string[] = [];
  if (liveAnglers > 0) bits.push(`${liveAnglers} seated`);
  if (liveFishers > 0) bits.push(`${liveFishers} angling`);
  if (liveGamblers > 0) bits.push(`${liveGamblers} at chance`);
  if (hallTally.catches > 0) bits.push(`${hallTally.catches} catches`);
  if (hallTally.gambles > 0) bits.push(`${hallTally.gambles} wagers`);
  if (hallTally.wins > 0) bits.push(`${hallTally.wins} wins`);
  if (hallTally.mythics > 0) bits.push(`${hallTally.mythics} mythic`);

  statsEl.innerHTML = bits
    .map((b) => {
      let cls = "bb-stat";
      if (b.includes("catch") || b.includes("mythic")) cls += " bb-stat--catch";
      else if (b.includes("wager") || b.includes("win") || b.includes("chance")) cls += " bb-stat--gamble";
      else if (b.includes("angling")) cls += " bb-stat--hot";
      return `<span class="${cls}">${escapeHtml(b)}</span>`;
    })
    .join("");

  dockTally.textContent =
    hallTally.catches + hallTally.gambles + hallTally.feasts > 0
      ? `${hallTally.catches} fish · ${hallTally.gambles} wagers (${hallTally.wins}W) · ${hallTally.feasts} feasts · ★${hallTally.renown}`
      : "Quiet hall — first cast or wager sets the tone.";
}

function countLiveActivity() {
  liveFishers = patronList.filter((p) => p.fishing && p.fishing.phase !== "idle").length;
  liveGamblers = patronList.filter((p) => p.chance && p.chance.phase !== "idle").length;
  liveAnglers = patronList.length;
  refreshStats();
}

function appendDeed(d: Deed) {
  const row = document.createElement("div");
  row.className = deedClass(d.kind, d.outcome);
  row.innerHTML = `${bbIconForKind(d.kind)}<span class="bb-deed-text">${escapeHtml(lineForDeed(d))}</span>`;
  feedEl.prepend(row);
  while (feedEl.children.length > FEED_MAX) feedEl.removeChild(feedEl.lastChild!);
  bumpTally(d);
}

let patronList: MapPatron[] = [];
let flashLine = "";
let flashTimer = 0;
let calloutTimer = 0;
let animTick = 0;
let factIndex = 0;
let tableFish: TableFish[] = [];
let splashes: SplashFx[] = [];
let catchBurstUntil = 0;
let mapShakeUntil = 0;
let chanceFlashUntil = 0;

const mapFx = (): MapFx => ({
  tableFish,
  splashes,
  catchBurstUntil,
  chanceFlashUntil,
});

function expirePatronChance() {
  const now = performance.now();
  patronList = patronList.map((p) => {
    if (!p.chance) return p;
    const age = now - p.chance.updatedAt;
    const max =
      p.chance.phase === "chance_result" ? 6000 : p.chance.phase === "chance_pick" ? 25_000 : 45_000;
    if (age > max) {
      const { chance: _, ...rest } = p;
      return rest;
    }
    return p;
  });
}

function expirePatronFishing() {
  const now = performance.now();
  patronList = patronList.map((p) => {
    if (!p.fishing) return p;
    if (now - p.fishing.updatedAt > 9000) {
      const { fishing: _, ...rest } = p;
      return rest;
    }
    return p;
  });
  expirePatronChance();
  splashes = splashes.filter((s) => now - s.startedAt < 1500);
  tableFish = tableFish.filter((f) => now - f.landedAt < 60_000);
  countLiveActivity();
}

function onFishingUpdate(d: {
  from?: string;
  phase?: string;
  castPower?: number;
  biteOpen?: boolean;
  reelProgress?: number;
}) {
  if (!d.from) return;
  const phase = (d.phase ?? "idle") as FishingPhase;
  const updatedAt = performance.now();

  patronList = patronList.map((p) => {
    if (p.name !== d.from) return p;
    if (phase === "idle") {
      const { fishing: _, ...rest } = p;
      return rest;
    }
    return {
      ...p,
      fishing: {
        phase,
        castPower: d.castPower,
        biteOpen: d.biteOpen,
        reelProgress: d.reelProgress,
        updatedAt,
      },
    };
  });

  if (phase === "fish_wait" && d.biteOpen) {
    const seat = patronList.find((p) => p.name === d.from);
    if (seat) {
      splashes.push({
        x: mapCanvas.clientWidth / 2,
        y: mapCanvas.clientHeight / 2 + 4,
        startedAt: performance.now(),
        rarity: "uncommon",
      });
    }
  }
  countLiveActivity();
}

function onChanceUpdate(d: {
  from?: string;
  phase?: string;
  game?: string;
  cards?: Array<{ label: string; rank: number; suit: string }>;
  target?: number;
  outcome?: string;
}) {
  if (!d.from) return;
  const phase = (d.phase ?? "idle") as ChancePhase;
  const updatedAt = performance.now();

  patronList = patronList.map((p) => {
    if (p.name !== d.from) return p;
    if (phase === "idle") {
      const { chance: _, ...rest } = p;
      return rest;
    }
    return {
      ...p,
      chance: {
        phase,
        game: d.game as "high_low" | "over_under" | undefined,
        cards: d.cards,
        target: d.target,
        outcome: d.outcome as "win" | "lose" | "push" | undefined,
        updatedAt,
      },
    };
  });

  if (phase === "chance_result" && d.outcome === "win") {
    chanceFlashUntil = performance.now() + 1400;
  }
  if (phase === "chance_play" && d.game === "high_low" && d.cards?.length) {
    chanceFlashUntil = performance.now() + 400;
  }
  countLiveActivity();
}

function addCatchToTable(d: Deed) {
  if (!d.fish) return;
  const id = `${d.ts ?? Date.now()}-${d.from ?? "?"}`;
  tableFish.push({
    id,
    name: d.fish,
    rarity: d.rarity ?? "common",
    from: d.from ?? "Angler",
    landedAt: performance.now(),
  });
  while (tableFish.length > 10) tableFish.shift();

  const cx = mapCanvas.clientWidth / 2;
  const cy = mapCanvas.clientHeight / 2 + 4;
  splashes.push({
    x: cx,
    y: cy,
    startedAt: performance.now(),
    rarity: d.rarity ?? "common",
  });
  catchBurstUntil = performance.now() + 2200;
  if (d.rarity === "mythic") mapShakeUntil = performance.now() + 900;
}

const dockFacts = [
  ...heraldLines,
  ...tavernTeasers,
  () => `${tonightUtc().title}: ${tonightUtc().herald}`,
  "Fifty-two cards — even pips only, doubled faces at the chance table.",
  "The Great Table seats every angler who binds a name at the rim.",
];

function pickDockFact(): string {
  const item = dockFacts[factIndex % dockFacts.length]!;
  factIndex += 1;
  return typeof item === "function" ? item() : item;
}

function refreshDock() {
  const night = tonightUtc();
  dockNight.textContent = `${night.title} — ${night.tagline}`;
  dockPatrons.textContent = patronList.length
    ? `${patronList.length} seated: ${patronList.map((x) => x.name).join(" · ")}`
    : "Empty chairs — cast soon.";
  dockFact.textContent = pickDockFact();
  dockFact.classList.remove("bb-dock-fact");
  void dockFact.offsetWidth;
  dockFact.classList.add("bb-dock-fact");
}

function showDemoHall(caption: string) {
  patronList = DEMO_PATRONS.map((p) => ({ name: p.name }));
  setLive(false, `Preview · ${tonightUtc().title}`);
  patronsEl.textContent = caption;
  refreshDock();
  countLiveActivity();
  redrawMap();
}

function setLive(on: boolean, label: string) {
  statusEl.textContent = label;
  liveDot.classList.toggle("bb-live-dot--off", !on);
}

function showCallout(line: string) {
  calloutEl.textContent = line;
  calloutEl.hidden = false;
  window.clearTimeout(calloutTimer);
  calloutTimer = window.setTimeout(() => {
    calloutEl.hidden = true;
  }, CALLOUT_MS);
}

function pulsePatron(name?: string) {
  const until = performance.now() + PATRON_PULSE_MS;
  if (name) {
    patronList = patronList.map((p) =>
      p.name === name ? { ...p, pulseUntil: until } : p,
    );
  } else {
    patronList = patronList.map((p) => ({ ...p, pulseUntil: until }));
  }
}

function redrawMap() {
  const frame = mapCanvas.closest(".bb-map-frame") as HTMLElement | null;
  if (frame && performance.now() < mapShakeUntil) {
    const s = Math.sin(animTick * 0.9) * 3;
    frame.style.transform = `translate(${s}px, ${s * 0.5}px)`;
  } else if (frame) {
    frame.style.transform = "";
  }
  expirePatronFishing();
  drawTavernMap(mapCanvas, patronList, flashLine, animTick, mapFx());
}

function startDemoChanceLoop() {
  const demoCards = [
    { label: "8♡", rank: 8, suit: "cups" },
    { label: "Q†", rank: 12, suit: "swords" },
    { label: "K◎", rank: 13, suit: "coins" },
    { label: "6⚚", rank: 6, suit: "wands" },
  ];
  const phases: ChancePhase[] = ["chance_pick", "chance_play", "chance_result", "idle"];
  let phaseIdx = 0;
  window.setInterval(() => {
    if (patronList.length === 0) return;
    const p = patronList[(phaseIdx + 1) % patronList.length]!;
    const phase = phases[phaseIdx % phases.length]!;
    phaseIdx += 1;
    const card = demoCards[phaseIdx % demoCards.length]!;
    if (phase === "idle") {
      onChanceUpdate({ from: p.name, phase: "idle" });
      return;
    }
    if (phase === "chance_pick") {
      onChanceUpdate({ from: p.name, phase, game: "high_low" });
      return;
    }
    if (phase === "chance_play") {
      onChanceUpdate({ from: p.name, phase, game: "high_low", cards: [card] });
      return;
    }
    const second = demoCards[(phaseIdx + 1) % demoCards.length]!;
    onChanceUpdate({
      from: p.name,
      phase,
      game: "high_low",
      cards: [card, second],
      outcome: second.rank > card.rank ? "win" : "lose",
    });
  }, 3600);
}

function startDemoFishingLoop() {
  const phases: FishingPhase[] = ["fish_cast", "fish_wait", "fish_reel", "idle"];
  let phaseIdx = 0;
  window.setInterval(() => {
    if (patronList.length === 0) return;
    const p = patronList[phaseIdx % patronList.length]!;
    const phase = phases[phaseIdx % phases.length]!;
    phaseIdx += 1;
    onFishingUpdate({
      from: p.name,
      phase,
      castPower: phase === "fish_cast" ? 0.4 + Math.random() * 0.5 : undefined,
      biteOpen: phase === "fish_wait" && Math.random() > 0.5,
      reelProgress: phase === "fish_reel" ? Math.random() : undefined,
    });
  }, 2800);
}

function startAnimLoop() {
  const tick = () => {
    animTick += 1;
    redrawMap();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setFlash(line: string, from?: string) {
  flashLine = line;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    flashLine = "";
    redrawMap();
  }, CALLOUT_MS);
  showCallout(line);
  if (from) pulsePatron(from);
  redrawMap();
}

function onPatrons(p: { patrons: { name: string }[] }) {
  if (p.patrons.length === 0) {
    showDemoHall("Live hall — preview tokens until an angler stands at the Moonwell.");
    return;
  }
  const prev = new Set(patronList.map((x) => x.name));
  patronList = p.patrons.map((x) => {
    const existing = patronList.find((e) => e.name === x.name);
    return {
      name: x.name,
      pulseUntil: existing?.pulseUntil,
      fishing: existing?.fishing,
      chance: existing?.chance,
    };
  });
  const joined = patronList.filter((x) => !prev.has(x.name));
  if (joined.length === 1) {
    setFlash(`${joined[0]!.name} pulled up a chair`, joined[0]!.name);
  }
  patronsEl.textContent = `${patronList.length} at the Great Table: ${patronList.map((x) => x.name).join(" · ")}`;
  refreshDock();
  countLiveActivity();
  redrawMap();
}

async function main() {
  try {
    await document.fonts.load('400 10px "Press Start 2P"');
    await document.fonts.load('400 24px "VT323"');
    await document.fonts.load('400 20px "Pixelify Sans"');
    await document.fonts.load('400 14px "Silkscreen"');
  } catch {
    /* optional */
  }

  playLink.href = import.meta.env.BASE_URL || "/";

  const night = tonightUtc();
  refreshDock();
  refreshStats();
  setInterval(refreshDock, FACT_ROTATE_MS);

  const resize = () => {
    applyWallClass();
    resizeMapCanvas(mapCanvas);
    redrawMap();
  };
  resize();
  window.addEventListener("resize", resize);
  startAnimLoop();

  setLive(false, "Moonwell hall");
  const { url } = await resolveTrailServerUrl();

  if (!url) {
    showDemoHall(
      "Preview: Example, Angler & Guest at the table — open the game (same Wi‑Fi / localhost) for live seats.",
    );
    startDemoFishingLoop();
    startDemoChanceLoop();
    return;
  }

  setLive(false, "Joining live hall…");

  let client = null as Awaited<ReturnType<typeof connectTrail>> | null;
  try {
    client = await connectTrail(url, "trailJson", { name: "Hall of the Angler", projector: true });
    setLive(true, `Live · ${night.title}`);
  } catch {
    showDemoHall(
      "Preview seats — run npm run live (or npm run server + game) then refresh for live patrons.",
    );
    startDemoFishingLoop();
    startDemoChanceLoop();
    return;
  }

  const socket = client?.socket;
  if (socket) {
    socket.on("hall:deed", (d: Deed) => {
      appendDeed(d);
      if (d.kind === "catch") addCatchToTable(d);
      const line = lineForDeed(d);
      setFlash(line, d.from);
      if (d.kind === "gamble" && d.outcome === "win") {
        chanceFlashUntil = performance.now() + 1200;
      }
      if (d.kind === "catch" && d.rarity === "mythic") {
        showCallout(`MYTHIC — ${line}`);
      }
    });
    socket.on("moonwell:patrons", onPatrons);
    socket.on("moonwell:fishing", onFishingUpdate);
    socket.on("moonwell:chance", onChanceUpdate);
    // Until real patrons arrive, keep the preview tokens bobbing at the table
    if (patronList.length === 0) {
      showDemoHall("Live hall connected — waiting for anglers. Preview tokens shown until someone joins.");
    }
  } else {
    showDemoHall("Preview seats at the Great Table.");
    startDemoFishingLoop();
    startDemoChanceLoop();
  }
}

void main();

export { isWallMode };
