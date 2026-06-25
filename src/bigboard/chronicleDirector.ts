/**
 * Paces bigboard moments — one chronicle at a time, with breath between beats.
 */

import type { Deed } from "./chronicleDirector.types";

export type { Deed } from "./chronicleDirector.types";

export type HallMood = "quiet" | "gathering" | "live" | "chronicle" | "celebration";

export type DirectorHandlers = {
  onMood: (mood: HallMood) => void;
  onSpotlight: (deed: Deed | null, lines: { main: string; sub?: string }) => void;
  onFlash: (line: string, from?: string) => void;
  onAppendFeed: (deed: Deed) => void;
  onEffects: (deed: Deed) => void;
  onQuietWhisper: (line: string) => void;
};

const HOLD_MS: Record<string, number> = {
  catch: 16_000,
  gamble: 12_000,
  feast: 10_000,
  peril: 11_000,
  trivia: 11_000,
  renown: 14_000,
};
const QUIET_MS = 8_000;
const HERALD_BEAT_MS = 1_800;

function holdFor(deed: Deed): number {
  let ms = HOLD_MS[deed.kind ?? ""] ?? 10_000;
  if (deed.rarity === "mythic") ms += 6_000;
  if (deed.demplar) ms += 3_000;
  if (deed.milestone && deed.milestone >= 40) ms += 4_000;
  return ms;
}

function moodFor(deed: Deed): HallMood {
  if (deed.kind === "catch" && (deed.rarity === "mythic" || deed.demplar)) return "celebration";
  if (deed.kind === "renown") return "celebration";
  return "chronicle";
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function createChronicleDirector(
  linesFor: (d: Deed) => { main: string; sub?: string },
  flashFor: (d: Deed) => string,
) {
  let handlers: DirectorHandlers | null = null;
  const queue: Deed[] = [];
  let playing = false;
  let quietTimer = 0;
  let lastPlayedAt = 0;

  function bind(h: DirectorHandlers) {
    handlers = h;
  }

  function clearQuietTimer() {
    window.clearTimeout(quietTimer);
    quietTimer = 0;
  }

  function scheduleQuiet() {
    if (!handlers || playing || queue.length > 0) return;
    clearQuietTimer();
    quietTimer = window.setTimeout(() => {
      if (playing || queue.length > 0) return;
      handlers?.onMood("quiet");
      handlers?.onQuietWhisper("");
    }, 22_000);
  }

  function enqueue(deed: Deed) {
    queue.push(deed);
    clearQuietTimer();
    if (!playing) void playNext();
  }

  async function playNext() {
    if (!handlers || queue.length === 0) {
      playing = false;
      handlers?.onSpotlight(null, { main: "" });
      handlers?.onMood("live");
      scheduleQuiet();
      return;
    }

    playing = true;
    clearQuietTimer();
    const deed = queue.shift()!;
    const lines = linesFor(deed);
    const mood = moodFor(deed);

    handlers.onMood(mood);
    handlers.onSpotlight(deed, lines);
    await pause(HERALD_BEAT_MS);

    handlers.onEffects(deed);
    handlers.onFlash(flashFor(deed), deed.from);

    await pause(holdFor(deed));

    handlers.onAppendFeed(deed);
    handlers.onSpotlight(null, { main: "" });
    lastPlayedAt = Date.now();

    await pause(QUIET_MS);
    await playNext();
  }

  function setLiveActivity(activeFishers: number, activeGamblers: number, patronCount: number) {
    if (playing) return;
    if (activeFishers > 0 || activeGamblers > 0) {
      clearQuietTimer();
      handlers?.onMood("live");
      return;
    }
    if (patronCount > 0) {
      handlers?.onMood("gathering");
      scheduleQuiet();
      return;
    }
    handlers?.onMood("quiet");
    scheduleQuiet();
  }

  function whisper(line: string) {
    if (playing || queue.length > 0) return;
    handlers?.onMood("quiet");
    handlers?.onQuietWhisper(line);
  }

  return {
    bind,
    enqueue,
    setLiveActivity,
    whisper,
    isPlaying: () => playing,
    queueLength: () => queue.length,
    msSinceLastPlay: () => (lastPlayedAt ? Date.now() - lastPlayedAt : Infinity),
  };
}
