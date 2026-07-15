/** Demplar Warrior — synthesized impact hits for brief title chunks (Web Audio). */

let ctx: AudioContext | null = null;

function prefersSilent(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getCtx(): AudioContext | null {
  if (prefersSilent()) return null;
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

export function primeWarriorSfx(): void {
  void getCtx()?.resume();
}

/** Short charter slam — one per 8-char brief chunk. */
export function playWarriorImpact(punch = 1): void {
  const ac = getCtx();
  if (!ac) return;
  void ac.resume();

  const t0 = ac.currentTime;
  const vol = Math.min(0.42, 0.22 + punch * 0.06);

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(220 * punch, t0);
  osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.07);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + 0.12);

  const bufLen = Math.floor(ac.sampleRate * 0.04);
  const noiseBuf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
  }
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuf;
  const nGain = ac.createGain();
  nGain.gain.setValueAtTime(vol * 0.55, t0);
  nGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
  noise.connect(nGain);
  nGain.connect(ac.destination);
  noise.start(t0);
  noise.stop(t0 + 0.06);
}

function blip(freq: number, dur: number, vol: number, type: OscillatorType = "square"): void {
  const ac = getCtx();
  if (!ac) return;
  void ac.resume();
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Tetris hard slam — chunky thud. */
export function playTetrisSlam(): void {
  blip(160, 0.07, 0.28, "triangle");
  blip(90, 0.05, 0.18, "square");
}

/** Line clear — brighter pop scales with rows cleared. */
export function playTetrisClear(rows: number): void {
  const base = 280 + rows * 80;
  blip(base, 0.09, 0.22, "square");
  blip(base * 1.35, 0.07, 0.14, "triangle");
}

/** Sargaano sprint — hop. */
export function playPlatformJump(): void {
  blip(340, 0.07, 0.16, "square");
  blip(520, 0.05, 0.1, "triangle");
}

/** Sargaano sprint — boots hit stone. */
export function playPlatformLand(): void {
  blip(110, 0.05, 0.2, "triangle");
  blip(70, 0.04, 0.12, "square");
}

/** Coin / blade grab. */
export function playPlatformPickup(kind: "coin" | "blade"): void {
  if (kind === "coin") {
    blip(660, 0.06, 0.14, "square");
    blip(880, 0.05, 0.1, "triangle");
  } else {
    blip(420, 0.07, 0.16, "triangle");
    blip(280, 0.08, 0.12, "square");
  }
}
