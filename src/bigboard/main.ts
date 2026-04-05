import { resolveTrailServerUrl } from "../net/trailResolve";
import { connectTrail } from "../net/trailClient";
import { drawTavernMap, resizeMapCanvas, type MapPatron } from "./tavernMap";

const feedEl = document.getElementById("feed")!;
const patronsEl = document.getElementById("patrons")!;
const statusEl = document.getElementById("status")!;
const mapCanvas = document.getElementById("tavern-map") as HTMLCanvasElement;

type Deed = {
  ts?: number;
  kind?: string;
  text?: string;
  renown?: number;
  fish?: string;
  rarity?: string;
  from?: string;
};

function lineForDeed(d: Deed): string {
  const who = d.from ? d.from : "A patron";
  if (d.kind === "catch" && d.fish) {
    return `${who} landed ${d.fish}${d.rarity ? ` (${d.rarity})` : ""} — ${d.renown ?? 0} renown`;
  }
  if (d.text) return `${who}: ${d.text}`;
  return `${who} did a deed worth telling.`;
}

let patronList: MapPatron[] = [];
let flashLine = "";
let flashTimer = 0;

function redrawMap() {
  drawTavernMap(mapCanvas, patronList, flashLine);
}

function setFlash(line: string) {
  flashLine = line;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    flashLine = "";
    redrawMap();
  }, 5000);
  redrawMap();
}

function onPatrons(p: { patrons: { name: string }[] }) {
  patronList = p.patrons.map((x) => ({ name: x.name }));
  patronsEl.textContent = patronList.length
    ? `${patronList.length} at the rim: ${patronList.map((x) => x.name).join(" · ")}`
    : "The rim is quiet — cast soon.";
  redrawMap();
}

async function main() {
  try {
    await document.fonts.load('400 10px "Press Start 2P"');
    await document.fonts.load('400 24px "VT323"');
  } catch {
    /* optional */
  }

  const resize = () => {
    resizeMapCanvas(mapCanvas);
    redrawMap();
  };
  resize();
  window.addEventListener("resize", resize);

  statusEl.textContent = "Connecting to the hall…";
  const { url, source } = await resolveTrailServerUrl();
  statusEl.textContent = url ? `Hall link (${source})` : "Offline hall — map is demo-only";

  let client = null as Awaited<ReturnType<typeof connectTrail>> | null;
  if (url) {
    try {
      client = await connectTrail(url, source, { name: "Hall of the Angler", projector: true });
      statusEl.textContent = "Live — top-down hall";
    } catch {
      statusEl.textContent = "Could not reach trail server — map offline";
    }
  }

  const socket = client?.socket;
  if (socket) {
    socket.on("hall:deed", (d: Deed) => {
      const row = document.createElement("div");
      row.className = "deed";
      row.textContent = lineForDeed(d);
      feedEl.prepend(row);
      while (feedEl.children.length > 24) feedEl.removeChild(feedEl.lastChild!);
      setFlash(lineForDeed(d));
    });
    socket.on("moonwell:patrons", onPatrons);
  } else {
    patronsEl.textContent = "Demo: start trail server + open main game to see live tokens here.";
    patronList = [
      { name: "Example" },
      { name: "Angler" },
      { name: "Guest" },
    ];
    redrawMap();
  }
}

void main();
