/**
 * Hall of the Angler — live projector wall around the Great Table.
 * Spectator client: hall:deed feed + moonwell:patrons on canvas seats.
 */
import { resolveTrailServerUrl } from "../net/trailResolve";
import { connectTrail } from "../net/trailClient";
import { initMobileShellClass } from "../mobile-detect";
import { heraldLines, tavernTeasers } from "../content/lore";
import { pickLine } from "../content/arcaneLore";
import {
  bigboardFeedHints,
  bigboardHeadlines,
  bigboardMoodLines,
  bigboardSpotlightKickers,
  demplarEpigraphs,
  knightHallWhispers,
} from "../content/demplarKnights";
import { formatCharterDayLabel } from "../game/charterDay";
import { loadXLoreFeed, getXLoreFeed, onXLoreFeedUpdate, pickXPost, pickXPostText, refreshXLoreFeed } from "../lore/xFeed";
import { bbTickerShell, mountBbTicker } from "./bbTicker";
import { tonightUtc } from "../content/tavernNights";
import { loadDailyMediaTheme } from "../media/loadTheme";
import type { LoadedMediaTheme } from "../media/types";
import { bbIconForKind } from "./bbIcons";
import { renderFeedCardsHtml } from "./bbFeedCards";
import { createChronicleDirector, type HallMood } from "./chronicleDirector";
import type { Deed } from "./chronicleDirector.types";
import {
  initHallCharter,
  persistHallTally,
  formatHallArchiveLine,
  type HallTally,
  type HallNightArchive,
} from "./hallCharter";
import {
  bumpLeaderboardRow,
  initHallLeaderboard,
  persistHallLeaderboard,
  topLeaderboard,
  type LeaderboardRow,
} from "./hallLeaderboard";
import { drawTavernMap, resizeMapCanvas, type FishingPhase, type ChancePhase, type MapPatron, type MapFx, type MapDrawTheme } from "./tavernMap";
import type { SplashFx, TableFish } from "./tableFish";
import {
  formatPatronCaption,
  type HallPatronIdentity,
  type HallStakeSnap,
  type HallTrophy,
} from "../hall/hallAssets";
import "./bigboard.css";

initMobileShellClass();

const feedEl = document.getElementById("feed")!;
const patronsEl = document.getElementById("patrons")!;
const statusEl = document.getElementById("status")!;
const trophyRailEl = document.getElementById("bb-trophy-rail")!;
const stakeRailEl = document.getElementById("bb-stake-rail")!;
const liveDot = document.getElementById("bb-live-dot")!;
const calloutEl = document.getElementById("bb-callout") as HTMLDivElement;
const dockNight = document.getElementById("bb-dock-night")!;
const dockPatrons = document.getElementById("bb-dock-patrons")!;
const dockFact = document.getElementById("bb-dock-fact")!;
const dockTally = document.getElementById("bb-dock-tally")!;
const statsEl = document.getElementById("bb-stats")!;
const playLink = document.getElementById("bb-play-link") as HTMLAnchorElement;
const playHero = document.getElementById("bb-play-hero") as HTMLAnchorElement | null;
const feedHint = document.getElementById("bb-feed-hint")!;
const mapFrame = document.querySelector(".bb-map-frame") as HTMLElement;
const elMapWhisper = document.getElementById("bb-map-whisper")!;
const moodEl = document.getElementById("bb-mood")!;
const spotlightEl = document.getElementById("bb-spotlight") as HTMLDivElement;
const spotlightMain = document.getElementById("bb-spotlight-main")!;
const spotlightSub = document.getElementById("bb-spotlight-sub")!;
const spotlightKicker = document.getElementById("bb-spotlight-kicker")!;
const mapCanvas = document.getElementById("tavern-map") as HTMLCanvasElement;
const elTagline = document.getElementById("bb-tagline")!;
const elCrest = document.getElementById("bb-crest") as HTMLImageElement;
const elCharterNight = document.getElementById("bb-charter-night")!;
const elMapCharterNight = document.getElementById("bb-map-charter-night")!;
const elLeaderboard = document.getElementById("bb-leaderboard")!;
const elLbNight = document.getElementById("bb-lb-night")!;

const LB_DEFAULT = 8;
const LB_WALL = 6;

let loadedTheme: LoadedMediaTheme | null = null;
let mapTheme: MapDrawTheme = {};

const FEED_MAX = 40;
const CALLOUT_MS = 7_500;
const PATRON_PULSE_MS = 6_000;
const FACT_ROTATE_MS = 48_000;
const WHISPER_MS = 14_000;

const MOOD_LABEL: Record<HallMood, string> = {
  quiet: bigboardMoodLines.quiet!,
  gathering: bigboardMoodLines.gathering!,
  live: bigboardMoodLines.live!,
  chronicle: bigboardMoodLines.chronicle!,
  celebration: bigboardMoodLines.celebration!,
};

/** Preview anglers when the hall server is offline — keeps the table alive. */
const DEMO_PATRONS: MapPatron[] = [
  { name: "Example", title: "Moonwell Sharp", catalogSize: 4, tokens: 3 },
  { name: "Angler", title: "Omen Reader", catalogSize: 7, tokens: 2 },
  { name: "Guest", catalogSize: 2, tokens: 5 },
];

const DEMO_TROPHIES: HallTrophy[] = [
  {
    id: "demo-omen",
    fish: "Veilfin Echo",
    rarity: "omen",
    from: "Angler",
    ts: Date.now() - 60_000,
  },
  {
    id: "demo-mythic",
    fish: "Moonwell Leviathan",
    rarity: "mythic",
    from: "Example",
    ts: Date.now() - 120_000,
  },
];

const DEMO_STAKES: HallStakeSnap[] = [
  { from: "Guest", kind: "chance", label: "Hi-Lo", stake: 1, tokensLeft: 4, ts: Date.now() - 20_000 },
  { from: "Example", kind: "feast", label: "Charred Dock Bread", stake: 1, tokensLeft: 2, ts: Date.now() - 45_000 },
];

let trophyList: HallTrophy[] = [...DEMO_TROPHIES];
let stakeList: HallStakeSnap[] = [...DEMO_STAKES];

const director = createChronicleDirector(deedLines, flashForDeed);

const charterBoot = initHallCharter();
let hallTally: HallTally = charterBoot.tally;
let hallArchive: HallNightArchive[] = charterBoot.archive;
let hallDayId = charterBoot.dayId;

const lbBoot = initHallLeaderboard();
let leaderboardRows: LeaderboardRow[] =
  lbBoot.dayId === hallDayId ? lbBoot.rows : [];
if (lbBoot.dayId !== hallDayId) {
  persistHallLeaderboard(hallDayId, leaderboardRows);
}

function syncHallStore(): void {
  persistHallTally(hallTally, hallDayId, hallArchive);
}

let liveAnglers = 0;
let liveFishers = 0;
let liveGamblers = 0;

function isWallMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("wall") === "1";
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

function deedLines(d: Deed): { main: string; sub?: string } {
  if (d.chronicle) {
    const tail = d.renown ? ` ★${d.renown}` : "";
    return { main: `${d.chronicle}${tail}`, sub: d.text };
  }
  return { main: lineForDeed(d) };
}

function lineForDeed(d: Deed): string {
  const who = d.from ? d.from : "A patron";
  if (d.kind === "catch" && d.fish) {
    return `${who} landed ${d.fish}${d.rarity ? ` (${d.rarity})` : ""} — ${d.renown ?? 0} renown`;
  }
  if (d.kind === "gamble") {
    const game = d.game === "red_black" ? "Red/Black" : "Hi-Lo";
    const cards = cardArrow(d.cards);
    const verdict =
      d.outcome === "win" ? "WIN" : d.outcome === "push" ? "PUSH" : d.outcome === "lose" ? "LOSE" : "";
    const tail = d.renown ? ` (+${d.renown} renown)` : "";
    if (cards) {
      return `${who} ${game}: ${cards}${verdict ? ` — ${verdict}` : ""}${tail}`;
    }
    if (d.text) return `${who} at the chance table — ${d.text}${tail}`;
    return `${who} wagered at the chance table${tail}`;
  }
  if (d.kind === "feast" && d.text) {
    return `${who} ${d.text}`;
  }
  if (d.kind === "demplar") {
    const tail = d.renown ? ` ★${d.renown}` : "";
    if (d.chronicle) return `${d.chronicle}${tail}`;
    return `${who} cleared the charter trials${tail}`;
  }
  if (d.text) return `${who}: ${d.text}`;
  return `${who} did a deed worth telling.`;
}

function deedClass(d: Deed): string {
  let cls = "bb-deed";
  const kind = d.kind;
  if (kind === "catch") {
    cls += " bb-deed--catch";
    if (d.demplar) cls += " bb-deed--demplar";
    if (d.combo) cls += " bb-deed--combo";
  }
  if (kind === "gamble") {
    cls += " bb-deed--gamble";
    if (d.outcome === "win") cls += " bb-deed--win";
    if (d.outcome === "lose") cls += " bb-deed--lose";
  }
  if (kind === "feast") cls += " bb-deed--feast";
  if (kind === "peril") cls += d.bold ? " bb-deed--peril bb-deed--bold" : " bb-deed--peril";
  if (kind === "trivia") {
    cls += " bb-deed--trivia";
    if (d.correct) cls += " bb-deed--win";
  }
  if (kind === "renown") cls += " bb-deed--renown";
  if (kind === "demplar") cls += " bb-deed--demplar";
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
  if (d.kind === "peril" || d.kind === "trivia") hallTally.wisdom += 1;
  if (d.kind === "renown") hallTally.milestones += 1;
  if (d.kind === "demplar") hallTally.milestones += 1;
  if (d.renown) hallTally.renown += d.renown;
  refreshStats();
  syncHallStore();
}

function refreshLeaderboard() {
  const cap = isWallMode() ? LB_WALL : LB_DEFAULT;
  const rows = topLeaderboard(leaderboardRows, cap);
  elLbNight.textContent = `Tavern ${formatCharterDayLabel(hallDayId)} · resets 4am PT`;

  if (rows.length === 0) {
    elLeaderboard.innerHTML =
      `<p class="bb-lb__empty">★ scores appear as patrons fish, wager, and trial the Warrior track.</p>`;
    return;
  }

  elLeaderboard.innerHTML = `<ol class="bb-lb__list" aria-label="Top patrons tonight">
    ${rows
      .map(
        (r, i) => `<li class="bb-lb__item${i === 0 ? " bb-lb__item--top" : ""}">
          <span class="bb-lb__rank" aria-hidden="true">${i + 1}</span>
          <span class="bb-lb__name">${escapeHtml(r.name)}</span>
          <span class="bb-lb__score">★${r.renown}</span>
        </li>`,
      )
      .join("")}
  </ol>`;
}

function bumpLeaderboard(d: Deed) {
  leaderboardRows = bumpLeaderboardRow(leaderboardRows, d);
  persistHallLeaderboard(hallDayId, leaderboardRows);
  refreshLeaderboard();
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
  if (hallTally.wisdom > 0) bits.push(`${hallTally.wisdom} beats`);
  if (hallTally.milestones > 0) bits.push(`${hallTally.milestones} milestones`);

  statsEl.innerHTML = bits
    .map((b) => {
      let cls = "bb-stat";
      if (b.includes("catch") || b.includes("mythic") || b.includes("milestone")) cls += " bb-stat--catch";
      else if (b.includes("wager") || b.includes("win") || b.includes("chance")) cls += " bb-stat--gamble";
      else if (b.includes("beat") || b.includes("angling")) cls += " bb-stat--hot";
      return `<span class="${cls}">${escapeHtml(b)}</span>`;
    })
    .join("");

  dockTally.textContent =
    hallTally.catches + hallTally.gambles + hallTally.feasts + hallTally.wisdom > 0
      ? `Tavern ${formatCharterDayLabel(hallDayId)} · ${hallTally.catches} fish · ${hallTally.gambles} wagers (${hallTally.wins}W) · ★${hallTally.renown}${hallArchive.length > 0 ? ` · ${hallArchive.length} archived` : ""}`
      : `Tavern ${formatCharterDayLabel(hallDayId)} — quiet hall. Scores reset 4am PT.`;
}

function countLiveActivity() {
  liveFishers = patronList.filter((p) => p.fishing && p.fishing.phase !== "idle").length;
  liveGamblers = patronList.filter((p) => p.chance && p.chance.phase !== "idle").length;
  liveAnglers = patronList.length;
  director.setLiveActivity(liveFishers, liveGamblers, liveAnglers);
  refreshStats();
}

function appendDeed(d: Deed, fresh = true) {
  const { main, sub } = deedLines(d);
  const row = document.createElement("div");
  row.className = `${deedClass(d)}${fresh ? " bb-deed--fresh" : ""}`;
  const subHtml = sub
    ? `<span class="bb-deed-sub">${escapeHtml(sub)}</span>`
    : "";
  const cardsHtml =
    d.cards && d.cards.length > 0 ? renderFeedCardsHtml(d.cards, d.outcome) : "";
  row.innerHTML = `${bbIconForKind(d.kind)}<div class="bb-deed-body"><span class="bb-deed-text">${escapeHtml(main)}</span>${subHtml}${cardsHtml}</div>`;
  feedEl.prepend(row);
  feedEl.classList.remove("bb-feed--waiting");
  if (fresh) window.setTimeout(() => row.classList.remove("bb-deed--fresh"), 4000);
  while (feedEl.children.length > FEED_MAX) feedEl.removeChild(feedEl.lastChild!);
}

function applyDeedStats(d: Deed) {
  bumpTally(d);
  bumpLeaderboard(d);
}

function appendDeedLive(d: Deed) {
  appendDeed(d, true);
  applyDeedStats(d);
  feedHint.textContent = "Inscribed in the chronicle.";
}

function hydrateHallFromSync(list: Deed[]) {
  if (!Array.isArray(list) || list.length === 0) return;

  director.reset();
  hallTally = {
    catches: 0,
    gambles: 0,
    wins: 0,
    feasts: 0,
    mythics: 0,
    renown: 0,
    wisdom: 0,
    milestones: 0,
  };
  leaderboardRows = [];
  feedEl.innerHTML = "";

  for (const d of [...list].reverse()) applyDeedStats(d);
  for (const d of list) appendDeed(d, false);

  feedEl.classList.remove("bb-feed--waiting");
  feedHint.textContent = "Inscribed in the chronicle.";
  refreshStats();
  refreshLeaderboard();
}

function handleDeedEffects(d: Deed) {
  if (d.kind === "catch") addCatchToTable(d);
  if (d.kind === "gamble" && d.outcome === "win") {
    chanceFlashUntil = performance.now() + 1_800;
  }
  if (d.kind === "catch" && d.rarity === "mythic") {
    showCallout(`MYTHIC — ${flashForDeed(d)}`);
  }
  if (d.kind === "catch" && d.demplar) {
    showCallout(`CHARTER — ${flashForDeed(d)}`);
  }
  if (d.kind === "demplar") {
    showCallout(`WARRIOR — ${flashForDeed(d)}`);
    catchBurstUntil = performance.now() + 1800;
  }
  if (d.kind === "renown" && d.milestone) {
    showCallout(`★${d.milestone} — ${flashForDeed(d)}`);
    chanceFlashUntil = performance.now() + 2_000;
  }
}

function setMood(mood: HallMood) {
  moodEl.textContent = MOOD_LABEL[mood];
  moodEl.className = `bb-mood bb-mood--${mood}`;
  if (mapFrame) {
    mapFrame.classList.remove(
      "bb-mood--quiet",
      "bb-mood--gathering",
      "bb-mood--live",
      "bb-mood--chronicle",
      "bb-mood--celebration",
    );
    mapFrame.classList.add(`bb-mood--${mood}`);
  }
  feedHint.textContent =
    bigboardFeedHints[mood] ?? bigboardFeedHints.gathering ?? "Pull up a chair — tales arrive one at a time.";
  feedEl.classList.toggle("bb-feed--waiting", mood === "chronicle" || mood === "celebration");
}

function showSpotlight(deed: Deed | null, lines: { main: string; sub?: string }) {
  if (!deed) {
    spotlightEl.hidden = true;
    return;
  }
  spotlightKicker.textContent = pickLine(bigboardSpotlightKickers);
  spotlightMain.textContent = lines.main;
  spotlightSub.textContent = lines.sub ?? "";
  spotlightSub.hidden = !lines.sub;
  spotlightEl.hidden = false;
}

let whisperLine = "";
let whisperTimer = 0;
const lastBiteSplash = new Map<string, number>();
let demoRunning = false;
let trailLive = false;

function stopDemoEvening() {
  demoRunning = false;
}

function setWhisper(line: string) {
  window.clearTimeout(whisperTimer);
  whisperLine = line;
  const t = line.length > 88 ? `${line.slice(0, 86)}…` : line;
  elMapWhisper.textContent = t;
  if (!line) return;
  whisperTimer = window.setTimeout(() => {
    whisperLine = "";
    elMapWhisper.textContent = "";
  }, WHISPER_MS);
}

let patronList: MapPatron[] = DEMO_PATRONS.map((p) => ({ name: p.name }));
let hallHasLivePatrons = false;
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

  const fishing =
    phase === "idle"
      ? undefined
      : {
          phase,
          castPower: d.castPower,
          biteOpen: d.biteOpen,
          reelProgress: d.reelProgress,
          updatedAt,
        };

  const idx = patronList.findIndex((p) => p.name === d.from);
  if (idx < 0) {
    if (phase === "idle") return;
    patronList = [...patronList, { name: d.from, fishing }];
  } else {
    patronList = patronList.map((p) => {
      if (p.name !== d.from) return p;
      if (phase === "idle") {
        const { fishing: _, ...rest } = p;
        return rest;
      }
      return { ...p, fishing: fishing! };
    });
  }

  if (phase === "fish_wait" && d.biteOpen) {
    const now = performance.now();
    const last = lastBiteSplash.get(d.from) ?? 0;
    if (now - last > 5_500) {
      lastBiteSplash.set(d.from, now);
      splashes.push({
        x: mapCanvas.clientWidth / 2,
        y: mapCanvas.clientHeight / 2 + 4,
        startedAt: now,
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
  stake?: number;
  tokens?: number;
  title?: string;
}) {
  if (!d.from) return;
  const phase = (d.phase ?? "idle") as ChancePhase;
  const updatedAt = performance.now();

  patronList = patronList.map((p) => {
    if (p.name !== d.from) return p;
    if (phase === "idle") {
      const { chance: _, ...rest } = p;
      return {
        ...rest,
        tokens: typeof d.tokens === "number" ? d.tokens : rest.tokens,
        title: typeof d.title === "string" ? d.title : rest.title,
      };
    }
    return {
      ...p,
      tokens: typeof d.tokens === "number" ? d.tokens : p.tokens,
      title: typeof d.title === "string" ? d.title : p.title,
      chance: {
        phase,
        game: d.game as "high_low" | "red_black" | undefined,
        cards: d.cards,
        target: d.target,
        outcome: d.outcome as "win" | "lose" | "push" | undefined,
        stake: d.stake,
        tokens: d.tokens,
        updatedAt,
      },
    };
  });

  if (phase === "chance_play" && typeof d.stake === "number" && d.stake > 0) {
    upsertStake({
      from: d.from,
      kind: "chance",
      label: d.game === "red_black" ? "Red/Black" : d.game === "high_low" ? "Hi-Lo" : "Chance",
      stake: d.stake,
      tokensLeft: d.tokens,
      ts: Date.now(),
    });
  }

  if (phase === "chance_result" && d.outcome === "win") {
    chanceFlashUntil = performance.now() + 1_400;
  }
  countLiveActivity();
  refreshDockPatrons();
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
  ...knightHallWhispers,
  () => `${tonightUtc().title}: ${tonightUtc().herald}`,
  () =>
    hallArchive.length > 0
      ? `Prior charter: ${formatHallArchiveLine(hallArchive[0]!)}`
      : "Scores seal at 4am Pacific — the archive keeps every charter night.",
  "Fifty-two cards — even pips only, doubled faces at the chance table.",
  "The Great Table seats every angler who binds a name at the rim.",
];

function pickDockFact(): string {
  const xPost = pickXPost(getXLoreFeed());
  if (xPost && Math.random() < 0.38) {
    const t = xPost.text.length > 120 ? `${xPost.text.slice(0, 118)}…` : xPost.text;
    factIndex += 1;
    return `@${xPost.handle} · ${t}`;
  }
  const item = dockFacts[factIndex % dockFacts.length]!;
  factIndex += 1;
  return typeof item === "function" ? item() : item;
}

function refreshDockPatrons() {
  const night = tonightUtc();
  dockNight.textContent = `${night.title} — ${night.tagline}`;
  dockPatrons.textContent = patronList.length
    ? `${patronList.length} seated: ${formatPatronCaption(
        patronList.map((p) => ({
          name: p.name,
          title: p.title,
          catalogSize: p.catalogSize,
          tokens: p.tokens,
        })),
      )}`
    : "Empty chairs — the well waits.";
}

function renderTrophyRail() {
  if (!trophyList.length) {
    trophyRailEl.innerHTML =
      '<p class="bb-asset-rail__empty">Mythic &amp; omen catches pin here for the hall.</p>';
    return;
  }
  trophyRailEl.innerHTML = trophyList
    .slice(0, 8)
    .map(
      (t) =>
        `<span class="bb-trophy-chip bb-trophy-chip--${t.rarity}" title="${escapeHtml(t.from)} landed ${escapeHtml(t.fish)}">
          <strong>${t.rarity === "mythic" ? "Mythic" : "Omen"}</strong>
          ${escapeHtml(t.fish)}
          <em>${escapeHtml(t.from)}</em>
        </span>`,
    )
    .join("");
}

function renderStakeRail() {
  if (!stakeList.length) {
    stakeRailEl.innerHTML =
      '<p class="bb-asset-rail__empty">◎ stakes chalk when patrons wager or feast.</p>';
    return;
  }
  stakeRailEl.innerHTML = stakeList
    .slice(0, 8)
    .map(
      (s) =>
        `<span class="bb-stake-chip bb-stake-chip--${s.kind}">
          <strong>◎${s.stake}</strong>
          ${escapeHtml(s.from)} · ${escapeHtml(s.label)}
          ${typeof s.tokensLeft === "number" ? `<em>left ◎${s.tokensLeft}</em>` : ""}
        </span>`,
    )
    .join("");
}

function upsertTrophy(t: HallTrophy) {
  if (trophyList.some((x) => x.id === t.id)) return;
  trophyList = [t, ...trophyList].slice(0, 24);
  renderTrophyRail();
}

function upsertStake(s: HallStakeSnap) {
  stakeList = [s, ...stakeList.filter((x) => !(x.from === s.from && x.kind === s.kind && x.label === s.label && Math.abs(x.ts - s.ts) < 1500))].slice(0, 16);
  renderStakeRail();
}

function rotateDockFact() {
  dockFact.textContent = pickDockFact();
  dockFact.classList.remove("bb-dock-fact");
  void dockFact.offsetWidth;
  dockFact.classList.add("bb-dock-fact");
}

function refreshDock() {
  refreshDockPatrons();
  rotateDockFact();
}

function showDemoHall(caption: string) {
  const now = performance.now();
  patronList = DEMO_PATRONS.map((p, i) => ({
    ...p,
    pulseUntil: now + 2000 + i * 400,
    fishing:
      i === 0
        ? { phase: "fish_cast" as const, castPower: 0.52, updatedAt: now }
        : i === 1
          ? { phase: "fish_wait" as const, biteOpen: true, updatedAt: now }
          : undefined,
  }));
  trophyList = [...DEMO_TROPHIES];
  stakeList = [...DEMO_STAKES];
  hallHasLivePatrons = false;
  setLive(false, `Preview · ${tonightUtc().title}`);
  patronsEl.textContent = caption;
  renderTrophyRail();
  renderStakeRail();
  refreshDock();
  countLiveActivity();
  redrawMap();
}

function ensurePreviewPatrons() {
  if (trailLive) return;
  if (!hallHasLivePatrons && patronList.length === 0) {
    showDemoHall("Preview knights at the Great Table — fishing, chance, and chronicles.");
  }
}

function bootPreviewHall(caption?: string) {
  showDemoHall(
    caption ??
      "Preview knights at the Great Table — fishing, chance, and chronicles. Click Play to join.",
  );
  void startDemoEvening();
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
  drawTavernMap(mapCanvas, patronList, "", animTick, mapFx(), "", mapTheme);
}

async function demoBeat(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function startDemoEvening() {
  if (demoRunning) return;
  demoRunning = true;

  const scripted: Deed[] = [
    {
      kind: "catch",
      from: "Angler",
      chronicle: "Angler lands Glimmer Minnow — chalk on the rim, stew in the kitchen.",
      text: "A honest bite—good for stew, small boasts, and passing the night without prophecy.",
      fish: "Glimmer Minnow",
      rarity: "common",
      renown: 2,
    },
    {
      kind: "gamble",
      from: "Guest",
      chronicle: "Guest calls high — 8♡ → Q†. The hall cheers; the mist pays.",
      text: "Ascendant / Descendant — the hall inscribes a win.",
      game: "high_low",
      outcome: "win",
      cards: [
        { label: "8 of Cups", rank: 8, suit: "cups" },
        { label: "Q of Swords", rank: 12, suit: "swords" },
      ],
      renown: 1,
    },
    {
      kind: "trivia",
      from: "Example",
      chronicle: "Example answers true at the well — the Codex grudgingly agrees.",
      text: "What does renown purchase at the Moonwell?",
      correct: true,
      renown: 4,
    },
    {
      kind: "demplar",
      from: "Guest",
      chronicle: "⚔ Guest runs Sargaano, races Corsus, shatters the veil — 2840 total.",
      text: "Run 920 · Circuit 1100 · Shards 820",
      renown: 6,
      score: 2840,
    },
  ];
  let deedIdx = 0;

  while (demoRunning && patronList.length > 0) {
    director.whisper(pickLine(tavernTeasers));
    await demoBeat(22_000);

    const p = patronList[deedIdx % patronList.length]!;
    const fishingScript: Array<{ phase: FishingPhase; ms: number; bite?: boolean }> = [
      { phase: "fish_cast", ms: 8_000 },
      { phase: "fish_wait", ms: 11_000, bite: true },
      { phase: "fish_reel", ms: 10_000 },
      { phase: "idle", ms: 5_000 },
    ];
    for (const step of fishingScript) {
      if (!demoRunning) return;
      onFishingUpdate({
        from: p.name,
        phase: step.phase,
        castPower: step.phase === "fish_cast" ? 0.5 : undefined,
        biteOpen: step.bite,
        reelProgress: step.phase === "fish_reel" ? 0.55 : undefined,
      });
      await demoBeat(step.ms);
    }

    director.enqueue(scripted[deedIdx % scripted.length]!);
    deedIdx += 1;
    while (director.isPlaying() || director.queueLength() > 0) await demoBeat(1_500);
    await demoBeat(18_000);
  }
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
  if (from) pulsePatron(from);
  redrawMap();
}

function flashForDeed(d: Deed): string {
  const { main } = deedLines(d);
  const who = d.from ? `${d.from}: ` : "";
  return `${who}${main}`;
}

function onPatrons(p: { patrons: HallPatronIdentity[] }) {
  if (p.patrons.length === 0) {
    hallHasLivePatrons = false;
    if (trailLive) {
      patronList = [];
      patronsEl.textContent = "Live hall — open Play, enter a name, and cast to appear here.";
      countLiveActivity();
      redrawMap();
      return;
    }
    showDemoHall("Live hall — preview tokens until an angler stands at the Moonwell.");
    if (!demoRunning) void startDemoEvening();
    return;
  }
  stopDemoEvening();
  hallHasLivePatrons = true;
  const prev = new Set(patronList.map((x) => x.name));
  patronList = p.patrons.map((x) => {
    const existing = patronList.find((e) => e.name === x.name);
    return {
      name: x.name,
      title: x.title ?? existing?.title,
      catalogSize: x.catalogSize ?? existing?.catalogSize,
      tokens: x.tokens ?? existing?.tokens,
      avatarId: x.avatarId ?? existing?.avatarId,
      pulseUntil: existing?.pulseUntil,
      fishing: existing?.fishing,
      chance: existing?.chance,
    };
  });
  const joined = patronList.filter((x) => !prev.has(x.name));
  if (joined.length === 1) {
    const who = joined[0]!;
    const wear = who.title ? `${who.name} (${who.title})` : who.name;
    setWhisper(`${wear} pulls up a chair at the Great Table.`);
    pulsePatron(who.name);
  }
  patronsEl.textContent = `${patronList.length} at the Great Table: ${formatPatronCaption(
    patronList.map((x) => ({
      name: x.name,
      title: x.title,
      catalogSize: x.catalogSize,
      tokens: x.tokens,
    })),
  )}`;
  refreshDockPatrons();
  countLiveActivity();
  redrawMap();
}

function refreshCharterChrome() {
  const nightLabel = formatCharterDayLabel(hallDayId);
  const charterText = `Tavern ${nightLabel} · resets 4am PT`;
  elCharterNight.textContent = charterText;
  elMapCharterNight.textContent = charterText;
  mapTheme = { ...mapTheme, charterNight: nightLabel, crest: loadedTheme?.images.crest ?? null };
  refreshLeaderboard();
}

async function initHeraldTickers(feed: Awaited<ReturnType<typeof loadXLoreFeed>>) {
  const top = document.getElementById("bb-ticker-top");
  const bottom = document.getElementById("bb-ticker-bottom");
  const roots: HTMLElement[] = [];
  if (top) {
    top.innerHTML = bbTickerShell("DEMPLAR LIVE");
    top.removeAttribute("aria-hidden");
    mountBbTicker(top, feed);
    roots.push(top);
  }
  if (bottom) {
    bottom.innerHTML = bbTickerShell("HERALD");
    bottom.removeAttribute("aria-hidden");
    mountBbTicker(bottom, feed);
    roots.push(bottom);
  }
  onXLoreFeedUpdate((fresh) => {
    for (const root of roots) mountBbTicker(root, fresh);
  });
}

async function initCharterChrome() {
  elTagline.textContent = pickLine(demplarEpigraphs);
  loadedTheme = await loadDailyMediaTheme();
  const crest = loadedTheme?.images.crest;
  if (crest && elCrest) {
    elCrest.src = crest.src;
    elCrest.hidden = false;
  }
  const feedHeading = document.querySelector(".bb-feed-heading");
  if (feedHeading) feedHeading.textContent = pickLine(bigboardHeadlines);
  refreshCharterChrome();
}

function goLiveHall(label: string) {
  trailLive = true;
  stopDemoEvening();
  director.reset();
  hallHasLivePatrons = false;
  trophyList = [];
  stakeList = [];
  renderTrophyRail();
  renderStakeRail();
  if (feedEl.childElementCount === 0) feedEl.classList.add("bb-feed--waiting");
  feedHint.textContent = "Live hall — deeds chalk here as patrons play.";
  setLive(true, label);
  patronsEl.textContent = "Live hall connected — waiting for anglers at the Moonwell.";
  refreshDock();
  countLiveActivity();
  redrawMap();
}

function bindTrailSocket(socket: import("socket.io-client").Socket) {
  socket.on("moonwell:patrons", onPatrons);
  socket.on("moonwell:fishing", onFishingUpdate);
  socket.on("moonwell:chance", onChanceUpdate);
  socket.on("hall:deed:sync", (list: Deed[]) => {
    stopDemoEvening();
    hydrateHallFromSync(list);
  });
  socket.on("hall:deed", (d: Deed) => {
    if (!trailLive) goLiveHall(`Live hall · ${tonightUtc().title}`);
    stopDemoEvening();
    director.enqueue(d);
    if (d.kind === "catch" && (d.rarity === "mythic" || d.rarity === "omen") && d.fish && d.from) {
      upsertTrophy({
        id: `${d.from}|${d.fish}|${d.ts ?? Date.now()}`,
        fish: d.fish,
        rarity: d.rarity,
        from: d.from,
        ts: d.ts ?? Date.now(),
        charterNight: d.charterNight,
      });
    }
    if (
      (d.kind === "gamble" || d.kind === "feast") &&
      typeof d.stake === "number" &&
      d.stake > 0 &&
      d.from
    ) {
      upsertStake({
        from: d.from,
        kind: d.kind === "feast" ? "feast" : "chance",
        label:
          d.kind === "feast"
            ? d.food ?? "Kitchen"
            : d.game === "red_black"
              ? "Red/Black"
              : d.game === "high_low"
                ? "Hi-Lo"
                : "Chance",
        stake: d.stake,
        tokensLeft: d.tokensLeft,
        ts: d.ts ?? Date.now(),
      });
    }
  });
  socket.on("hall:trophy:sync", (list: HallTrophy[]) => {
    if (!Array.isArray(list)) return;
    trophyList = list.slice(0, 24);
    renderTrophyRail();
  });
  socket.on("hall:trophy", (t: HallTrophy) => upsertTrophy(t));
  socket.on("hall:stake:sync", (list: HallStakeSnap[]) => {
    if (!Array.isArray(list)) return;
    stakeList = list.slice(0, 16);
    renderStakeRail();
  });
  socket.on("hall:stake", (s: HallStakeSnap) => upsertStake(s));
  socket.on("connect", () => {
    socket.emit("hall:deed:request");
  });
}

async function main() {
  playLink.href = import.meta.env.BASE_URL || "/";
  if (playHero) playHero.href = playLink.href;

  const resize = () => {
    applyWallClass();
    refreshLeaderboard();
    resizeMapCanvas(mapCanvas);
    redrawMap();
  };
  resize();
  window.addEventListener("resize", resize);
  startAnimLoop();
  requestAnimationFrame(() => resize());
  const mapStack = mapCanvas.parentElement;
  if (mapStack && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => resize());
    ro.observe(mapStack);
  }
  window.setInterval(ensurePreviewPatrons, 10_000);

  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 10px "Press Start 2P"'),
        document.fonts.load('400 24px "VT323"'),
        document.fonts.load('400 20px "Pixelify Sans"'),
        document.fonts.load('400 14px "Silkscreen"'),
      ]),
      new Promise((resolve) => window.setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* optional */
  }

  setLive(false, "Moonwell tavern");
  const { url } = await resolveTrailServerUrl();

  if (!url) {
    await initCharterChrome();
    bootPreviewHall("Offline build — run npm run live locally for a live hall feed.");
    return;
  }

  setLive(false, "Joining live hall…");
  patronsEl.textContent = "Connecting to Moonwell trail…";

  let client = null as Awaited<ReturnType<typeof connectTrail>> | null;
  try {
    client = await connectTrail(url, "trailJson", { name: "Hall of the Angler", projector: true }, {
      onSocket: bindTrailSocket,
    });
  } catch {
    await initCharterChrome();
    bootPreviewHall(
      "Preview seats — run npm run live (trail :3847 + Vite :5174) then refresh both tabs.",
    );
    return;
  }

  await initCharterChrome();
  void loadXLoreFeed().then((feed) => initHeraldTickers(feed));
  void refreshXLoreFeed(true);

  director.bind({
    onMood: setMood,
    onSpotlight: showSpotlight,
    onFlash: (_line, from) => {
      if (from) pulsePatron(from);
    },
    onAppendFeed: appendDeedLive,
    onEffects: handleDeedEffects,
    onQuietWhisper: (line) => {
      const x = pickXPostText();
      setWhisper(line || x || pickLine(heraldLines));
    },
  });

  const night = tonightUtc();
  setMood("gathering");
  setWhisper(pickXPostText() || pickLine(knightHallWhispers));
  rotateDockFact();
  setInterval(rotateDockFact, FACT_ROTATE_MS);

  goLiveHall(`Live hall · ${night.title}`);
  patronList = [];
  client!.socket.emit("hall:deed:request");
  setWhisper("Live hall online — cast in Play to light up the map.");
}

void main();

export { isWallMode };
