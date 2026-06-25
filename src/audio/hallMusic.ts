/** Catch fanfare — Suno track plays once when a fish is landed (see public/audio/manifest.json). */

import { primeWarriorSfx } from "./warriorSfx";

const AUDIO_SRC = `${import.meta.env.BASE_URL}audio/hall-ambience.mp3`;
const CATCH_VOLUME = 0.22;

let audio: HTMLAudioElement | null = null;
let playing = false;
let gestureHooked = false;

function prefersSilent(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function primeHallMusic(): void {
  if (prefersSilent() || audio) return;
  audio = new Audio(AUDIO_SRC);
  audio.loop = false;
  audio.volume = CATCH_VOLUME;
  audio.preload = "auto";
  audio.addEventListener("ended", () => {
    playing = false;
  });
  audio.addEventListener("error", () => {
    playing = false;
    console.warn("[hallMusic] failed to load", AUDIO_SRC);
  });
}

/** One-shot fanfare on catch — not ambient loop. */
export async function playCatchFanfare(): Promise<boolean> {
  if (prefersSilent()) return false;
  if (!audio) primeHallMusic();
  if (!audio) return false;
  audio.loop = false;
  audio.volume = CATCH_VOLUME;
  audio.currentTime = 0;
  try {
    if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          audio?.removeEventListener("canplaythrough", done);
          audio?.removeEventListener("error", fail);
          resolve();
        };
        const fail = () => {
          audio?.removeEventListener("canplaythrough", done);
          audio?.removeEventListener("error", fail);
          reject(new Error("audio load failed"));
        };
        audio!.addEventListener("canplaythrough", done, { once: true });
        audio!.addEventListener("error", fail, { once: true });
        audio!.load();
      });
    }
    await audio.play();
    playing = true;
    return true;
  } catch {
    playing = false;
    return false;
  }
}

/** Prime audio on first gesture so catch playback is allowed later. */
export function bindHallMusicGestures(): void {
  if (gestureHooked) return;
  gestureHooked = true;
  const prime = () => {
    primeHallMusic();
    primeWarriorSfx();
  };
  document.addEventListener("pointerdown", prime, { capture: true, passive: true });
  document.addEventListener("keydown", prime, { capture: true, passive: true });
}

export function stopHallMusic(): void {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  playing = false;
}
