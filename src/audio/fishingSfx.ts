/** Fishing stage one-shots — Web Audio, no asset files. */

import { audioContext, audioOutput, canPlayAudio, primeAudio } from "./soundtrack";

function getCtx(): AudioContext | null {
  return canPlayAudio() ? audioContext() : null;
}

export function primeFishingSfx(): void {
  primeAudio();
}

function tone(
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
  slide = 0.7,
): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(audioOutput());
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur: number, vol: number): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime;
  const bufLen = Math.floor(ac.sampleRate * dur);
  const noiseBuf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuf;
  const nGain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;
  nGain.gain.setValueAtTime(vol, t0);
  nGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  noise.connect(filter);
  filter.connect(nGain);
  nGain.connect(audioOutput());
  noise.onended = () => { noise.disconnect(); filter.disconnect(); nGain.disconnect(); };
  noise.start(t0);
  noise.stop(t0 + dur + 0.01);
}

export function playCastWhoosh(): void {
  tone(420, 0.14, 0.12, "triangle", 0.35);
  noiseBurst(0.08, 0.1);
}

export function playSplash(): void {
  noiseBurst(0.12, 0.16);
  tone(180, 0.1, 0.08, "sine", 0.5);
}

export function playNibble(): void {
  tone(520, 0.05, 0.07, "square", 0.85);
  tone(380, 0.06, 0.05, "square", 0.7);
}

export function playStrikeHit(): void {
  tone(160, 0.09, 0.18, "square", 0.4);
  noiseBurst(0.06, 0.14);
}

export function playReelCreak(strain = false): void {
  tone(strain ? 90 : 140, 0.05, strain ? 0.08 : 0.04, "sawtooth", 0.8);
}

export function playLandThump(): void {
  tone(70, 0.16, 0.16, "sine", 0.45);
  noiseBurst(0.1, 0.12);
}

/** Bright two-note ping when the cast lands in the sweet window. */
export function playPerfectChime(): void {
  tone(660, 0.09, 0.1, "triangle", 1.0);
  window.setTimeout(() => tone(990, 0.12, 0.09, "triangle", 1.0), 70);
}

/** Rarity-keyed arpeggio when a catch is inscribed. */
export function playCelebrationArp(tier: number): void {
  const base = [523, 659, 784, 1046];
  const notes = tier >= 3 ? [523, 659, 784, 1046, 1318] : base.slice(0, 3 + Math.min(1, tier));
  notes.forEach((f, i) => {
    window.setTimeout(() => tone(f, 0.14, 0.085, "square", 1.0), i * 85);
  });
}
