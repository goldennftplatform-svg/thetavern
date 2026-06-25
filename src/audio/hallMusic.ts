/** Soft hall ambience — local copy of Suno track (see public/audio/manifest.json). */

const AUDIO_SRC = `${import.meta.env.BASE_URL}audio/hall-ambience.mp3`;
const VOLUME = 0.16;

let audio: HTMLAudioElement | null = null;
let playing = false;
let gestureHooked = false;

function prefersSilent(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function primeHallMusic(): void {
  if (prefersSilent() || audio) return;
  audio = new Audio(AUDIO_SRC);
  audio.loop = true;
  audio.volume = VOLUME;
  audio.preload = "auto";
  audio.addEventListener("error", () => {
    playing = false;
    console.warn("[hallMusic] failed to load", AUDIO_SRC);
  });
}

export async function startHallMusic(): Promise<boolean> {
  if (prefersSilent()) return false;
  if (!audio) primeHallMusic();
  if (!audio) return false;
  if (playing && !audio.paused) return true;
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

/** Keep trying on user gestures until the browser allows playback. */
export function bindHallMusicGestures(): void {
  if (gestureHooked) return;
  gestureHooked = true;
  const tryPlay = () => {
    if (!playing) void startHallMusic();
  };
  document.addEventListener("pointerdown", tryPlay, { capture: true, passive: true });
  document.addEventListener("keydown", tryPlay, { capture: true, passive: true });
}

export function duckHallMusic(): void {
  if (audio) audio.volume = VOLUME * 0.55;
}

export function restoreHallMusic(): void {
  if (audio) audio.volume = VOLUME;
}

export function stopHallMusic(): void {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  playing = false;
}

export function setHallMusicVolume(v: number): void {
  if (audio) audio.volume = Math.max(0, Math.min(1, v));
}
