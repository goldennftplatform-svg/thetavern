/** JSparrow — pre-recorded pirate taunt clips (recorded locally via Qwen3-TTS voice clone, shipped in public/audio). */

import { audioContext, canPlayAudio, connectMedia } from "./soundtrack";

const BASE = `${import.meta.env.BASE_URL}audio/jackSparrow/`;

const INTRO = ["intro_1.ogg", "intro_2.ogg"];
const TAUNTS = [
  "taunt_1.ogg",
  "taunt_2.ogg",
  "taunt_3.ogg",
  "taunt_4.ogg",
  "taunt_5.ogg",
  "taunt_6.ogg",
  "taunt_7.ogg",
  "taunt_8.ogg",
  "taunt_9.ogg",
  "taunt_10.ogg",
];
const OUTRO = ["outro_1.ogg", "outro_2.ogg"];

const JACK_VOLUME = 0.9;

let audio: HTMLAudioElement | null = null;
let playing = false;

function prime(): void {
  if (audio || !audioContext()) return;
  audio = new Audio();
  audio.volume = JACK_VOLUME;
  audio.preload = "auto";
  connectMedia(audio, () => { playing = false; });
  audio.addEventListener("ended", () => {
    playing = false;
  });
  audio.addEventListener("error", () => {
    playing = false;
  });
}

function resetUpOnDone(): void {
  if (audio) {
    audio.onended = () => {
      playing = false;
    };
  }
}

function pick(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

function play(list: string[]): boolean {
  if (playing || !canPlayAudio()) return false;
  prime();
  if (!audio) return false;
  playing = true;
  audio.src = BASE + pick(list);
  audio.volume = JACK_VOLUME;
  audio.currentTime = 0;
  void audio.play().catch(() => {
    playing = false;
  });
  return true;
}

/** Prime the shared element on the first user gesture so playback is allowed later. */
export function primeJackSparrow(): void {
  if (canPlayAudio()) prime();
}

export function playJackIntro(): boolean {
  resetUpOnDone();
  return play(INTRO);
}

export function playJackTaunt(): boolean {
  resetUpOnDone();
  return play(TAUNTS);
}

export function playJackOutro(): boolean {
  resetUpOnDone();
  return play(OUTRO);
}

export function jackSpeaking(): boolean {
  return playing;
}
