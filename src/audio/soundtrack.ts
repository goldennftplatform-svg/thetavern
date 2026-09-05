import type { GamePhase } from "../game/types";

export type Theme = "tavern" | "fishing" | "warrior" | "tetris" | "drmario" | "hilo" | "redblack" | "conflic";
export const AUDIO_KEY = "moonwell.audio.v1";
let muted = false;
let volume = 0.35;
try {
  const saved = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? "null");
  if (typeof saved?.muted === "boolean") muted = saved.muted;
  if (typeof saved?.volume === "number" && Number.isFinite(saved.volume)) volume = Math.max(0, Math.min(1, saved.volume));
} catch { /* Storage may be unavailable or malformed. */ }

let context: AudioContext | null = null;
let master: GainNode;
let music: GainNode;
let timer: number | undefined;
let theme: Theme = "tavern";
let step = 0;
let nextNote = 0;
let bound = false;
let unlocked = false;
const voices = new Set<OscillatorNode>();
const media = new Map<HTMLMediaElement, () => void>();

export function themeForPhase(phase: GamePhase, stage?: string, chance?: string): Theme {
  if (phase.startsWith("conflic_")) return "conflic";
  if (phase === "demplar_warrior") return stage === "drmario" || stage === "done" ? "drmario" : "tetris";
  if (phase.startsWith("fish_") || phase === "resolve" || phase === "pole_rack") return "fishing";
  if (phase.startsWith("chance_")) return chance === "red_black" && phase !== "chance_pick" ? "redblack" : "hilo";
  return "tavern";
}

// Original scale-degree cells sharing a Dorian palette, not transcribed game or film tunes.
const scores: Record<Theme, { beat: number; root: number; cell: number[]; wave: OscillatorType }> = {
  tavern: { beat: 0.38, root: 50, cell: [0, 4, 2, -1, 6, 4, 1, -1], wave: "triangle" },
  fishing: { beat: 0.46, root: 62, cell: [0, -1, 2, 5, -1, 4, 1, -1], wave: "sine" },
  warrior: { beat: 0.19, root: 50, cell: [0, 0, 4, 2, 6, 4, 3, 1], wave: "square" },
  tetris: { beat: 0.16, root: 62, cell: [2, 4, 0, 5, 3, 1, 6, 4], wave: "triangle" },
  drmario: { beat: 0.23, root: 57, cell: [0, 3, -1, 2, 5, -1, 1, 4], wave: "square" },
  hilo: { beat: 0.29, root: 57, cell: [0, 2, 4, -1, 5, 3, 1, -1], wave: "triangle" },
  redblack: { beat: 0.26, root: 50, cell: [0, -1, 4, 1, -1, 5, 2, 3], wave: "square" },
  conflic: { beat: 0.21, root: 50, cell: [0, 4, 2, 0, 5, 3, 1, 4, 6, 3, 2, 1], wave: "sawtooth" },
};
const scale = [0, 2, 3, 5, 7, 9, 10];

export function audioState() {
  return { muted, volume, theme, running: timer !== undefined, contextState: context?.state ?? "uninitialized" };
}

export function audioContext(): AudioContext | null {
  if (!unlocked || document.hidden) return null;
  if (!context) {
    const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      context = new Ctx();
      master = context.createGain();
      music = context.createGain();
      master.gain.value = muted ? 0 : volume;
      music.connect(master);
      master.connect(context.destination);
    } catch { context = null; }
  }
  return context;
}

export function audioOutput(): GainNode { return master; }
export function canPlayAudio(): boolean { return unlocked && !document.hidden && !muted && volume > 0; }

export function connectMedia(element: HTMLMediaElement, onStop: () => void): void {
  const ac = audioContext();
  if (!ac || media.has(element)) return;
  ac.createMediaElementSource(element).connect(master);
  media.set(element, onStop);
}

function stop(): void {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
  for (const voice of voices) { voice.stop(); voice.disconnect(); }
  voices.clear();
  for (const [element, onStop] of media) { element.pause(); onStop(); }
}

function note(midi: number, at: number, length: number, level: number, wave: OscillatorType): void {
  const ac = context!;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = wave;
  osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain);
  gain.connect(music);
  voices.add(osc);
  osc.onended = () => { voices.delete(osc); osc.disconnect(); gain.disconnect(); };
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function start(): void {
  if (!canPlayAudio() || context?.state !== "running" || timer !== undefined) return;
  nextNote = context.currentTime + 0.03;
  const tick = () => {
    const ac = context!;
    const score = scores[theme];
    // Short lookahead avoids timer jitter without queueing a background backlog.
    if (nextNote < ac.currentTime) nextNote = ac.currentTime + 0.03;
    while (nextNote < ac.currentTime + 0.12) {
      const phrase = Math.floor(step / score.cell.length);
      const degree = score.cell[step % score.cell.length]!;
      const harmony = [0, 5, 3, 0][Math.floor(phrase / 2) % 4]!;
      if (degree >= 0) {
        const drift = (theme === "tavern" || theme === "fishing") && phrase % 3 === 2 ? 7 : 0;
        note(score.root + scale[degree]! + harmony + drift, nextNote, score.beat * 1.5, score.wave === "sawtooth" ? 0.035 : 0.055, score.wave);
      }
      if (step % (theme === "conflic" ? 3 : 4) === 0) note(score.root - 12 + harmony, nextNote, score.beat * 2.4, 0.09, "triangle");
      if (theme === "conflic" && step % 3 === 2) note(score.root - 24, nextNote, 0.08, 0.09, "triangle");
      step++;
      nextNote += score.beat * (theme === "conflic" ? (step % 3 === 1 ? 1.25 : step % 3 === 2 ? 0.75 : 1) : 1);
    }
  };
  tick();
  timer = window.setInterval(tick, 50);
}

export function primeAudio(): void {
  if (document.hidden) return;
  unlocked = true;
  const ac = audioContext();
  if (ac) void ac.resume().then(() => {
    if (document.hidden) { void ac.suspend().catch(() => {}); return; }
    start();
  }).catch(() => {});
}

export function setAudioPhase(phase: GamePhase, stage?: string, chance?: string): void {
  const next = themeForPhase(phase, stage, chance);
  if (next === theme) return;
  stop();
  theme = next;
  step = 0;
  start();
}

export function setAudioPreferences(prefs: { muted?: boolean; volume?: number }): void {
  if (typeof prefs.muted === "boolean") muted = prefs.muted;
  if (typeof prefs.volume === "number" && Number.isFinite(prefs.volume)) volume = Math.max(0, Math.min(1, prefs.volume));
  try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ muted, volume })); } catch { /* Session controls still work. */ }
  if (context) master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.015);
  if (!canPlayAudio()) stop(); else start();
  updateControls();
}

function updateControls(): void {
  const button = document.querySelector<HTMLButtonElement>("#audio-mute");
  const slider = document.querySelector<HTMLInputElement>("#audio-volume");
  if (!button || !slider) return;
  button.setAttribute("aria-pressed", String(muted));
  button.setAttribute("aria-label", muted ? "Unmute all audio" : "Mute all audio");
  button.title = muted ? "Unmute all audio" : "Mute all audio";
  button.dataset.muted = String(muted || volume === 0);
  slider.value = String(Math.round(volume * 100));
  slider.setAttribute("aria-valuetext", `${Math.round(volume * 100)} percent${muted ? ", muted" : ""}`);
}

export function bindAudio(): void {
  if (bound) return;
  bound = true;
  document.addEventListener("pointerdown", primeAudio, { capture: true, passive: true });
  document.addEventListener("keydown", primeAudio, { capture: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stop(); void context?.suspend().catch(() => {}); }
    else if (unlocked) primeAudio();
  });
  window.addEventListener("pagehide", () => { stop(); void context?.suspend().catch(() => {}); });
  window.addEventListener("pageshow", () => { if (unlocked) primeAudio(); });
  const controls = document.querySelector<HTMLElement>("#audio-controls")!;
  // Isolate range arrows and button Space from game keyboard shortcuts.
  controls.addEventListener("keydown", event => event.stopPropagation());
  controls.addEventListener("keyup", event => event.stopPropagation());
  document.querySelector("#audio-mute")!.addEventListener("click", () => setAudioPreferences({ muted: !muted }));
  document.querySelector("#audio-volume")!.addEventListener("input", event => setAudioPreferences({ volume: Number((event.target as HTMLInputElement).value) / 100 }));
  updateControls();
}
