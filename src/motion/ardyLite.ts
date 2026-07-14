/**
 * ARDY-lite — hybrid root + body streaming motion for Moonwell (browser).
 * Inspired by NVIDIA ARDY (SIGGRAPH 2026): explicit root trajectory + body pose stream,
 * driven by phase "prompts" without requiring CUDA at runtime.
 *
 * Optional offline CUDA bake: `npm run ardy:bake` → `public/media/ardy/clips/*.json`
 */

export type ArdyJointId =
  | "root"
  | "hip"
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "shoulderL"
  | "elbowL"
  | "wristL"
  | "shoulderR"
  | "elbowR"
  | "wristR"
  | "kneeL"
  | "ankleL"
  | "kneeR"
  | "ankleR";

export type ArdyVec2 = { x: number; y: number };

export type ArdyPose = Record<ArdyJointId, ArdyVec2>;

export type ArdyClip = {
  id: string;
  /** ARDY-style text prompt this clip answers. */
  prompt: string;
  fps: number;
  /** Normalized joint positions in a local box ~[-1..1] x [-1.2..0.2], origin at feet. */
  frames: ArdyPose[];
  loop?: boolean;
  engine: "ardy-lite" | "ardy-cuda";
};

export type ArdyClipManifest = {
  version: 1;
  skeleton: "moonwell-core16";
  notes: string;
  clips: Array<{ id: string; file: string; prompt: string }>;
};

export const ARDY_BONES: Array<[ArdyJointId, ArdyJointId]> = [
  ["root", "hip"],
  ["hip", "spine"],
  ["spine", "chest"],
  ["chest", "neck"],
  ["neck", "head"],
  ["chest", "shoulderL"],
  ["shoulderL", "elbowL"],
  ["elbowL", "wristL"],
  ["chest", "shoulderR"],
  ["shoulderR", "elbowR"],
  ["elbowR", "wristR"],
  ["hip", "kneeL"],
  ["kneeL", "ankleL"],
  ["hip", "kneeR"],
  ["kneeR", "ankleR"],
];

const JOINTS: ArdyJointId[] = [
  "root",
  "hip",
  "spine",
  "chest",
  "neck",
  "head",
  "shoulderL",
  "elbowL",
  "wristL",
  "shoulderR",
  "elbowR",
  "wristR",
  "kneeL",
  "ankleL",
  "kneeR",
  "ankleR",
];

export function emptyPose(): ArdyPose {
  const p = {} as ArdyPose;
  for (const j of JOINTS) p[j] = { x: 0, y: 0 };
  return p;
}

/** Rest T-pose-ish angler facing right-of-screen (toward the well). */
export function restPose(): ArdyPose {
  return {
    root: { x: 0, y: 0 },
    hip: { x: 0, y: -0.12 },
    spine: { x: 0.02, y: -0.32 },
    chest: { x: 0.03, y: -0.52 },
    neck: { x: 0.04, y: -0.66 },
    head: { x: 0.05, y: -0.8 },
    shoulderL: { x: -0.14, y: -0.5 },
    elbowL: { x: -0.22, y: -0.32 },
    wristL: { x: -0.18, y: -0.14 },
    shoulderR: { x: 0.18, y: -0.5 },
    elbowR: { x: 0.32, y: -0.36 },
    wristR: { x: 0.42, y: -0.22 },
    kneeL: { x: -0.08, y: 0.22 },
    ankleL: { x: -0.1, y: 0.55 },
    kneeR: { x: 0.08, y: 0.22 },
    ankleR: { x: 0.1, y: 0.55 },
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpPose(a: ArdyPose, b: ArdyPose, t: number): ArdyPose {
  const out = emptyPose();
  for (const j of JOINTS) {
    out[j] = {
      x: lerp(a[j]!.x, b[j]!.x, t),
      y: lerp(a[j]!.y, b[j]!.y, t),
    };
  }
  return out;
}

export function sampleClip(clip: ArdyClip, timeSec: number): ArdyPose {
  if (!clip.frames.length) return restPose();
  const fps = clip.fps || 20;
  const span = clip.frames.length / fps;
  let t = timeSec;
  if (clip.loop !== false) t = ((t % span) + span) % span;
  else t = Math.min(span - 1 / fps, Math.max(0, t));
  const f = t * fps;
  const i0 = Math.floor(f) % clip.frames.length;
  const i1 = (i0 + 1) % clip.frames.length;
  const frac = f - Math.floor(f);
  return lerpPose(clip.frames[i0]!, clip.frames[i1]!, frac);
}

/** Phase → ARDY-style prompt used to pick / synthesize motion. */
export function promptForFishingPhase(phase: string, extras?: { biteOpen?: boolean; tension?: number }): string {
  if (phase === "fish_cast") return "angler draws back and casts fishing rod toward moonlit water";
  if (phase === "fish_wait") {
    return extras?.biteOpen
      ? "angler strikes hard when the bobber dips"
      : "angler waits patiently with rod tip over the well";
  }
  if (phase === "fish_reel") {
    const tug = extras?.tension ?? 0.5;
    if (tug > 0.66 || tug < 0.34) return "angler fights a thrashing fish on the line";
    return "angler reels smoothly keeping tension in the green zone";
  }
  return "angler stands ready at the moonwell rim";
}

/**
 * Streaming synthesizer (CUDA-free). Mimics ARDY hybrid: explicit root sway + body pose stream.
 */
export function synthesizeArdyLite(
  prompt: string,
  timeSec: number,
  opts?: { power?: number; tension?: number; biteOpen?: boolean },
): ArdyPose {
  const p = restPose();
  const power = opts?.power ?? 0.5;
  const tension = opts?.tension ?? 0.5;
  const bite = !!opts?.biteOpen;
  const t = timeSec;

  // Explicit root (ARDY hybrid stage 1)
  const rootX = Math.sin(t * 1.4) * 0.03;
  p.root = { x: rootX, y: 0 };
  p.hip = { x: rootX, y: -0.12 + Math.sin(t * 2.1) * 0.01 };

  const cast = /cast/i.test(prompt);
  const wait = /wait|patient/i.test(prompt);
  const strike = /strike/i.test(prompt);
  const fight = /fight|thrash/i.test(prompt);
  const reel = /reel|smooth/i.test(prompt);

  if (cast) {
    const wind = 0.5 + 0.5 * Math.sin(t * 6 + power * 4);
    p.shoulderR = { x: 0.12 + wind * 0.08, y: -0.55 };
    p.elbowR = { x: 0.05 + wind * 0.35, y: -0.55 - wind * 0.2 };
    p.wristR = { x: -0.05 + wind * 0.7, y: -0.45 - wind * 0.35 };
    p.chest = { x: 0.02 - wind * 0.04, y: -0.52 };
    p.spine = { x: 0.01 - wind * 0.03, y: -0.32 };
    p.head = { x: 0.08, y: -0.78 };
  } else if (strike || bite) {
    const snap = 0.7 + 0.3 * Math.sin(t * 28);
    p.shoulderR = { x: 0.22, y: -0.48 };
    p.elbowR = { x: 0.38, y: -0.28 };
    p.wristR = { x: 0.55 * snap, y: -0.08 };
    p.spine = { x: -0.04, y: -0.3 };
    p.chest = { x: -0.02, y: -0.48 };
  } else if (fight) {
    const thrash = Math.sin(t * 14) * (0.12 + Math.abs(tension - 0.5));
    p.shoulderR = { x: 0.2, y: -0.5 + thrash * 0.15 };
    p.elbowR = { x: 0.36 + thrash * 0.2, y: -0.34 };
    p.wristR = { x: 0.5 + thrash * 0.25, y: -0.18 + thrash * 0.1 };
    p.hip = { x: rootX + thrash * 0.08, y: -0.12 };
    p.kneeL = { x: -0.1 + thrash * 0.05, y: 0.22 };
    p.kneeR = { x: 0.1 - thrash * 0.05, y: 0.22 };
  } else if (reel) {
    const crank = (t * 5) % (Math.PI * 2);
    p.shoulderR = { x: 0.2, y: -0.5 };
    p.elbowR = { x: 0.34 + Math.cos(crank) * 0.06, y: -0.34 + Math.sin(crank) * 0.05 };
    p.wristR = { x: 0.46 + Math.cos(crank) * 0.08, y: -0.2 + Math.sin(crank) * 0.06 };
    p.shoulderL = { x: -0.12, y: -0.5 };
    p.elbowL = { x: -0.1, y: -0.3 };
    p.wristL = { x: 0.05 + Math.sin(crank) * 0.04, y: -0.22 };
  } else if (wait) {
    const breath = Math.sin(t * 1.7) * 0.02;
    p.wristR = { x: 0.44, y: -0.24 + breath };
    p.elbowR = { x: 0.32, y: -0.36 + breath * 0.5 };
    p.head = { x: 0.06 + Math.sin(t * 0.6) * 0.02, y: -0.8 };
  }

  // Keep stance planted
  p.ankleL = { x: -0.1 + rootX * 0.2, y: 0.55 };
  p.ankleR = { x: 0.1 + rootX * 0.2, y: 0.55 };
  return p;
}
