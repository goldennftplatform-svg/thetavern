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
