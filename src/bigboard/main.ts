import { resolveTrailServerUrl } from "../net/trailResolve";
import { connectTrail } from "../net/trailClient";

const feedEl = document.getElementById("feed")!;
const patronsEl = document.getElementById("patrons")!;
const statusEl = document.getElementById("status")!;

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

async function main() {
  statusEl.textContent = "Connecting to the hall…";
  const { url, source } = await resolveTrailServerUrl();
  statusEl.textContent = url ? `Hall link (${source})` : "Offline hall — static feed only";

  let client = null as Awaited<ReturnType<typeof connectTrail>> | null;
  if (url) {
    try {
      client = await connectTrail(url, source, { name: "Hall of the Angler", projector: true });
      statusEl.textContent = "Live — Hall of the Angler";
    } catch {
      statusEl.textContent = "Could not reach trail server";
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
    });
    socket.on("moonwell:patrons", (p: { patrons: { name: string }[] }) => {
      patronsEl.textContent = p.patrons.length
        ? `At the Moonwell: ${p.patrons.map((x) => x.name).join(" · ")}`
        : "The well is quiet — cast soon.";
    });
  } else {
    patronsEl.textContent = "Projector mode — start the trail server for live names.";
  }
}

void main();
