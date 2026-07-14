/** Fishing stage one-shots — Web Audio, no asset files. */

let ctx: AudioContext | null = null;

function prefersSilent(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getCtx(): AudioContext | null {
  if (prefersSilent()) return null;
  if (!ctx) {
    const Ctx =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

export function primeFishingSfx(): void {
  void getCtx()?.resume();
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
  void ac.resume();
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur: number, vol: number): void {
  const ac = getCtx();
  if (!ac) return;
  void ac.resume();
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
  nGain.connect(ac.destination);
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
