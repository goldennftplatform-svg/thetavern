/** Soft hall ambience — local copy of Suno track (see public/audio/manifest.json). */

const AUDIO_SRC = `${import.meta.env.BASE_URL}audio/hall-ambience.mp3`;
const VOLUME = 0.16;

let audio: HTMLAudioElement | null = null;
let playing = false;

function prefersSilent(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function primeHallMusic(): void {
  if (prefersSilent() || audio) return;
  audio = new Audio(AUDIO_SRC);
  audio.loop = true;
  audio.volume = VOLUME;
  audio.preload = "auto";
}

export async function startHallMusic(): Promise<void> {
  if (prefersSilent()) return;
  if (!audio) primeHallMusic();
  if (!audio || playing) return;
  try {
    await audio.play();
    playing = true;
  } catch {
    /* Browser blocked autoplay — will retry on next gesture */
  }
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
