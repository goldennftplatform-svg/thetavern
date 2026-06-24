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
import { drawTavernMap, resizeMapCanvas, type MapPatron } from "./tavernMap";
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
};

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

function lineForDeed(d: Deed): string {
  const who = d.from ? d.from : "A patron";
  if (d.kind === "catch" && d.fish) {
    return `${who} landed ${d.fish}${d.rarity ? ` (${d.rarity})` : ""} — ${d.renown ?? 0} renown`;
  }
  if (d.kind === "gamble" && d.text) {
    return `${who} at the chance table — ${d.text}${d.renown ? ` (+${d.renown} renown)` : ""}`;
  }
  if (d.kind === "feast" && d.text) {
    return `${who} ${d.text}`;
  }
  if (d.text) return `${who}: ${d.text}`;
  return `${who} did a deed worth telling.`;
}

function deedClass(kind?: string): string {
  if (kind === "catch") return "bb-deed bb-deed--catch";
  if (kind === "gamble") return "bb-deed bb-deed--gamble";
  if (kind === "feast") return "bb-deed bb-deed--feast";
  return "bb-deed";
}

function appendDeed(d: Deed) {
  const row = document.createElement("div");
  row.className = deedClass(d.kind);
  row.innerHTML = `${bbIconForKind(d.kind)}<span class="bb-deed-text">${escapeHtml(lineForDeed(d))}</span>`;
  feedEl.prepend(row);
  while (feedEl.children.length > FEED_MAX) feedEl.removeChild(feedEl.lastChild!);
}

let patronList: MapPatron[] = [];
let flashLine = "";
let flashTimer = 0;
let calloutTimer = 0;
let animTick = 0;
let factIndex = 0;

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
  drawTavernMap(mapCanvas, patronList, flashLine, animTick);
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
    return { name: x.name, pulseUntil: existing?.pulseUntil };
  });
  const joined = patronList.filter((x) => !prev.has(x.name));
  if (joined.length === 1) {
    setFlash(`${joined[0]!.name} pulled up a chair`, joined[0]!.name);
  }
  patronsEl.textContent = `${patronList.length} at the Great Table: ${patronList.map((x) => x.name).join(" · ")}`;
  refreshDock();
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
    return;
  }

  const socket = client?.socket;
  if (socket) {
    socket.on("hall:deed", (d: Deed) => {
      appendDeed(d);
      const line = lineForDeed(d);
      setFlash(line, d.from);
      if (d.kind === "catch" && d.rarity === "mythic") {
        showCallout(`MYTHIC — ${line}`);
      }
    });
    socket.on("moonwell:patrons", onPatrons);
    // Until real patrons arrive, keep the preview tokens bobbing at the table
    if (patronList.length === 0) {
      showDemoHall("Live hall connected — waiting for anglers. Preview tokens shown until someone joins.");
    }
  } else {
    showDemoHall("Preview seats at the Great Table.");
  }
}

void main();

export { isWallMode };
