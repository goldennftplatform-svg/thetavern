/**
 * Moonwell fishing stage — cast arc, bobber, splash, bite flash, reel struggle.
 * Angler body driven by ARDY-lite / CUDA-baked motion clips (hybrid root + body).
 */

import type { FishingPole } from "../content/fishingPoles";
import { poleById, STARTER_POLE_ID } from "../content/fishingPoles";
import type { HouseAvatarId } from "../content/houseAvatars";
import type { GamePhase } from "../game/types";
import {
  fishingClipId,
  loadArdyClip,
  preloadArdyFishingClips,
} from "../motion/ardyClips";
import {
  promptForFishingPhase,
  sampleClip,
  synthesizeArdyLite,
  type ArdyClip,
} from "../motion/ardyLite";
import { drawArdySkeleton } from "../motion/ardySkeleton";

export { preloadArdyFishingClips };

export type DrawCtx = {
  phase: GamePhase;
  castPower: number;
  biteOpen: boolean;
  waitPulse: number;
  reelTension: number;
  reelProgress: number;
  seasonTint: string;
  banner?: string;
  now?: number;
  poleId?: string;
  greenLo?: number;
  greenHi?: number;
  avatarId?: HouseAvatarId | string;
  avatarCustom?: string;
  loreLine?: string;
};

type Splash = { x: number; y: number; born: number; power: number };
type Ripple = { born: number; maxR: number };

let castArcUntil = 0;
let castArcPower = 0.5;
let castArcBorn = 0;
let splashes: Splash[] = [];
let ripples: Ripple[] = [];
let biteFlashUntil = 0;
let strikeFlashUntil = 0;
let landFlashUntil = 0;

const poleSprites = new Map<string, HTMLImageElement | null>();
const ardyClipCache = new Map<string, ArdyClip | null>();
let ardyBooted = false;

function ensureArdyBoot() {
  if (ardyBooted) return;
  ardyBooted = true;
  preloadArdyFishingClips();
  for (const id of ["idle", "cast", "wait", "strike", "reel", "fight"] as const) {
    void loadArdyClip(id).then((clip) => ardyClipCache.set(id, clip));
  }
}

function resolveAnglerPose(d: DrawCtx, now: number) {
  ensureArdyBoot();
  const fight =
    d.phase === "fish_reel" && (d.reelTension < 0.34 || d.reelTension > 0.66);
  const clipId = fight ? "fight" : fishingClipId(d.phase, d.biteOpen);
  const clip = ardyClipCache.get(clipId) ?? null;
  const t = now / 1000;
  if (clip) return sampleClip(clip, t);
  const prompt = promptForFishingPhase(d.phase, {
    biteOpen: d.biteOpen,
    tension: d.reelTension,
  });
  return synthesizeArdyLite(prompt, t, {
    power: d.castPower,
    tension: d.reelTension,
    biteOpen: d.biteOpen,
  });
}

function poleSpriteUrl(id: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}media/poles/${id}.png`;
}

function ensurePoleSprite(id: string): HTMLImageElement | null {
  if (poleSprites.has(id)) return poleSprites.get(id) ?? null;
  const img = new Image();
  img.decoding = "async";
  img.src = poleSpriteUrl(id);
  poleSprites.set(id, img);
  img.onerror = () => {
    poleSprites.set(id, null);
  };
  return img;
}

/** Warm the Blender-rendered pole sheet once at boot. */
export function preloadPoleSprites(ids: string[]): void {
  for (const id of ids) ensurePoleSprite(id);
}

export function triggerCastFx(power: number): void {
  const now = performance.now();
  castArcBorn = now;
  castArcUntil = now + 520;
  castArcPower = Math.max(0.2, Math.min(1, power));
  const cy = 0; // resolved in draw from canvas size
  splashes.push({ x: 0.5, y: 0.58, born: now + 280, power: castArcPower });
  ripples.push({ born: now + 300, maxR: 28 + castArcPower * 36 });
  if (splashes.length > 6) splashes.shift();
  if (ripples.length > 8) ripples.shift();
  void cy;
}

export function triggerBiteFlash(): void {
  const now = performance.now();
  biteFlashUntil = now + 900;
  ripples.push({ born: now, maxR: 48 });
  splashes.push({ x: 0.5 + (Math.random() - 0.5) * 0.08, y: 0.58, born: now, power: 0.85 });
}

export function triggerStrikeFlash(): void {
  strikeFlashUntil = performance.now() + 420;
  ripples.push({ born: performance.now(), maxR: 60 });
}

export function triggerLandFlash(): void {
  landFlashUntil = performance.now() + 700;
  ripples.push({ born: performance.now(), maxR: 70 });
  splashes.push({ x: 0.5, y: 0.56, born: performance.now(), power: 1 });
}

function floorRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function mixTint(hex: string, alpha: number): string {
  // Approximate season haze over deep water — keeps sky from reading flat black.
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(30, 40, 55, ${alpha})`;
  const r = parseInt(m[1]!, 16);
  const g = parseInt(m[2]!, 16);
  const b = parseInt(m[3]!, 16);
  return `rgba(${Math.floor(r * 0.35)}, ${Math.floor(g * 0.4)}, ${Math.floor(b * 0.45)}, 1)`;
}

function drawEllipseFill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawKnightHeraldry(ctx2d: CanvasRenderingContext2D, w: number, h: number, pulse: number) {
  const groundY = Math.floor(h * 0.56);
  const shimmer = 0.4 + Math.sin(pulse * 2) * 0.12;

  // Charter posts with banners
  for (const side of [0.04, 0.92] as const) {
    const px = w * side;
    const tall = side < 0.5 ? 48 : 44;
    ctx2d.fillStyle = "#1a1410";
    floorRect(ctx2d, px, groundY - tall, 12, tall);
    ctx2d.fillStyle = "#2a2018";
    floorRect(ctx2d, px - 2, groundY - tall - 4, 16, 6);
    ctx2d.fillStyle = `rgba(232, 176, 80, ${shimmer})`;
    floorRect(ctx2d, px + 2, groundY - tall + 6, 8, 3);
    // hanging charter cloth
    ctx2d.fillStyle = "#483058";
    floorRect(ctx2d, px + 12, groundY - tall + 10, 18, 26);
    ctx2d.fillStyle = `rgba(232, 176, 80, ${0.45 + shimmer * 0.2})`;
    floorRect(ctx2d, px + 14, groundY - tall + 14, 14, 2);
    ctx2d.font = `${Math.max(9, Math.floor(w * 0.022))}px "VT323", monospace`;
    ctx2d.fillText("⚔", px + 16, groundY - tall + 30);
  }

  // Far tavern silhouette plaque
  ctx2d.fillStyle = "rgba(72, 48, 88, 0.55)";
  floorRect(ctx2d, 8, groundY - 78, 26, 56);
  floorRect(ctx2d, w - 34, groundY - 74, 26, 52);
  ctx2d.fillStyle = `rgba(232, 176, 80, ${0.28 + shimmer * 0.3})`;
  floorRect(ctx2d, 12, groundY - 72, 18, 5);
  floorRect(ctx2d, w - 30, groundY - 68, 18, 5);

  ctx2d.fillStyle = `rgba(232, 200, 140, ${0.22 + shimmer * 0.1})`;
  ctx2d.font = `${Math.max(11, Math.floor(w * 0.028))}px "VT323", monospace`;
  ctx2d.textAlign = "center";
  ctx2d.fillText("MOONWELL · RIM CHARTER", w / 2, groundY - 54);
  ctx2d.fillStyle = `rgba(168, 200, 184, ${0.35 + shimmer * 0.1})`;
  ctx2d.font = `${Math.max(10, Math.floor(w * 0.024))}px "VT323", monospace`;
  ctx2d.fillText("cast well · read mist · keep the tale", w / 2, groundY - 40);
  ctx2d.textAlign = "left";
}

function wellCenter(w: number, h: number) {
  return { cx: w / 2, cy: Math.floor(h * 0.58), rx: w * 0.36, ry: h * 0.1 };
}

function drawCastArc(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  now: number,
) {
  if (now > castArcUntil) return;
  const { cx, cy } = wellCenter(w, h);
  const t = Math.min(1, (now - castArcBorn) / 480);
  const startX = w * 0.18;
  const startY = h * 0.42;
  const endX = cx + (castArcPower - 0.5) * w * 0.08;
  const endY = cy - 4;
  const midX = (startX + endX) / 2;
  const midY = Math.min(startY, endY) - h * (0.14 + castArcPower * 0.1);

  const bx =
    (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * endX;
  const by =
    (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * endY;

  ctx.strokeStyle = "rgba(232, 220, 180, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(midX, midY, bx, by);
  ctx.stroke();

  ctx.fillStyle = "#e8b050";
  ctx.beginPath();
  ctx.arc(bx, by, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1a1008";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSplashRipples(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  now: number,
) {
  const { cx, cy, rx, ry } = wellCenter(w, h);
  ripples = ripples.filter((r) => now - r.born < 900);
  for (const r of ripples) {
    const age = (now - r.born) / 900;
    if (age < 0) continue;
    const rad = r.maxR * age;
    ctx.strokeStyle = `rgba(168, 216, 200, ${0.55 * (1 - age)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.min(rx * 0.95, rad), Math.min(ry * 0.95, rad * 0.35), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  splashes = splashes.filter((s) => now - s.born < 700);
  for (const s of splashes) {
    const age = (now - s.born) / 700;
    if (age < 0) continue;
    const sx = s.x * w;
    const sy = s.y * h;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const dist = (10 + s.power * 18) * age;
      const px = sx + Math.cos(a) * dist;
      const py = sy - Math.abs(Math.sin(a)) * dist * 0.7 - age * 12;
      ctx.fillStyle = `rgba(200, 230, 220, ${(1 - age) * 0.8})`;
      floorRect(ctx, px, py, 3, 3);
    }
  }
}

function drawBobber(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  d: DrawCtx,
  now: number,
) {
  const { cx, cy, ry } = wellCenter(w, h);
  const fishing =
    d.phase === "fish_wait" || d.phase === "fish_reel" || d.phase === "fish_cast";
  if (!fishing) return;

  let bobX = cx;
  let bobY = cy - 2;
  const pulse = d.waitPulse;
  const lureFlying = d.phase === "fish_cast" && now < castArcUntil;

  if (d.phase === "fish_cast" && !lureFlying) {
    bobY = cy - 2;
  }

  if (d.phase === "fish_wait") {
    const nibble = Math.sin(pulse * 3.2) * 2.5;
    const preBite = d.biteOpen ? Math.sin(now * 0.04) * 5 : nibble;
    bobY = cy - 2 + preBite;
    if (d.biteOpen) bobX = cx + Math.sin(now * 0.03) * 6;
  }

  if (d.phase === "fish_reel") {
    const tug = (d.reelTension - 0.5) * 28;
    bobX = cx + tug;
    bobY = cy - 2 + Math.sin(now * 0.02) * 3 + (d.reelTension > 0.7 || d.reelTension < 0.3 ? 4 : 0);
  }

  // Charter angler stays on the rim even while the lure arcs — stick figure days are over.
  const pose = resolveAnglerPose(d, now);
  const ox = w * 0.16;
  const oy = h * 0.72;
  const scale = Math.min(w, h) * 0.24;
  const pole = poleById(d.poleId ?? STARTER_POLE_ID);
  const wrist = drawArdySkeleton(ctx, pose, {
    ox,
    oy,
    scale,
    glow: pole.accents.glow ?? "rgba(232, 176, 80, 0.25)",
    line: Math.max(3, Math.floor(scale * 0.038)),
    rodWrist: "R",
    avatarId: d.avatarId,
    avatarCustom: d.avatarCustom,
    accent: pole.accents.tip,
    cloak: "#483058",
  });
  const rodX = wrist.x;
  const rodY = wrist.y - scale * 0.08;
  drawEquippedPole(ctx, rodX, rodY, pole, now);

  if (lureFlying) return;

  const lo = d.greenLo ?? 0.34;
  const hi = d.greenHi ?? 0.66;
  const lineColor =
    d.phase === "fish_reel"
      ? d.reelTension >= lo && d.reelTension <= hi
        ? "rgba(104, 232, 168, 0.85)"
        : "rgba(232, 120, 80, 0.9)"
      : pole.accents.line;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = d.phase === "fish_reel" ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.moveTo(rodX, rodY);
  ctx.quadraticCurveTo((rodX + bobX) / 2, Math.min(rodY, bobY) - 18, bobX, bobY);
  ctx.stroke();

  // Bobber body
  const flash = now < biteFlashUntil || now < strikeFlashUntil;
  ctx.fillStyle = flash ? "#ffd080" : "#e84840";
  ctx.beginPath();
  ctx.arc(bobX, bobY, 7, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#f4f0e8";
  ctx.beginPath();
  ctx.arc(bobX, bobY, 7, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = "#1a1008";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bobX, bobY, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = pole.accents.tip;
  floorRect(ctx, bobX - 1, bobY - 12, 2, 6);

  // Soft reflection
  ctx.fillStyle = "rgba(232, 200, 160, 0.18)";
  drawEllipseFill(ctx, bobX, bobY + ry * 0.35, 10, 4);
}

function drawEquippedPole(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  pole: FishingPole,
  now: number,
) {
  const gripX = tipX - 10 - pole.tier * 0.4;
  const gripY = tipY + 40 + pole.tier * 1.2;
  const sprite = ensurePoleSprite(pole.id);
  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    const h = 72 + pole.tier * 3;
    const w = h * 0.42;
    ctx.save();
    ctx.translate(gripX + 4, gripY);
    ctx.rotate(-0.55);
    if (pole.accents.glow) {
      ctx.shadowColor = pole.accents.glow;
      ctx.shadowBlur = 12 + Math.sin(now * 0.006) * 4;
    }
    ctx.drawImage(sprite, -w * 0.35, -h, w, h);
    ctx.restore();
    return;
  }

  // Procedural fallback — looks distinct per rack tier without sprites.
  if (pole.accents.glow) {
    ctx.strokeStyle = pole.accents.glow;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.quadraticCurveTo(gripX + 4, tipY + 18, tipX, tipY);
    ctx.stroke();
  }
  ctx.strokeStyle = pole.accents.grip;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(gripX, gripY);
  ctx.lineTo(gripX + 3, gripY - 14);
  ctx.stroke();
  ctx.strokeStyle = pole.accents.shaft;
  ctx.lineWidth = 3 + Math.min(2, pole.tier * 0.15);
  ctx.beginPath();
  ctx.moveTo(gripX + 3, gripY - 14);
  ctx.quadraticCurveTo(gripX + 6, tipY + 16, tipX, tipY);
  ctx.stroke();
  ctx.fillStyle = pole.accents.tip;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 3 + (pole.tier >= 7 ? 1 : 0), 0, Math.PI * 2);
  ctx.fill();
  if (pole.tier >= 5) {
    ctx.fillStyle = pole.accents.line;
    for (let i = 0; i < 3; i++) {
      floorRect(ctx, tipX - 10 - i * 5, tipY + 8 + i * 6, 2, 2);
    }
  }
}

function drawFishShadow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  d: DrawCtx,
  now: number,
) {
  if (d.phase !== "fish_reel") return;
  const { cx, cy, ry } = wellCenter(w, h);
  const tug = (d.reelTension - 0.5) * 40;
  const fx = cx + tug * 1.2;
  const fy = cy + 6 + Math.sin(now * 0.025) * 4;
  const thrash = d.reelTension < 0.3 || d.reelTension > 0.7;

  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(Math.sin(now * 0.03) * (thrash ? 0.35 : 0.12));
  // Deeper silhouette + rim glow so the catch feels alive under mist
  ctx.fillStyle = thrash ? "rgba(232, 120, 80, 0.22)" : "rgba(104, 184, 168, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = thrash ? "rgba(232, 120, 80, 0.42)" : "rgba(24, 56, 68, 0.7)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(32, -10);
  ctx.lineTo(32, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(232, 220, 160, 0.55)";
  ctx.beginPath();
  ctx.arc(-8, -2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (thrash) {
    ctx.fillStyle = "rgba(168, 216, 200, 0.4)";
    for (let i = 0; i < 5; i++) {
      floorRect(ctx, fx - 12 + i * 7, fy - ry * 0.6 - ((now / 40 + i * 7) % 12), 2, 2);
    }
  }
}

function drawMeters(ctx: CanvasRenderingContext2D, d: DrawCtx, w: number, h: number) {
  const font = `${Math.max(10, Math.floor(w * 0.028))}px "VT323", monospace`;
  const labelFont = `${Math.max(11, Math.floor(w * 0.032))}px "Press Start 2P", monospace`;

  if (d.phase === "fish_cast") {
    const barW = Math.floor(w * 0.72);
    const bx = Math.floor((w - barW) / 2);
    const by = Math.floor(h * 0.8);
    const bh = 22;
    ctx.fillStyle = "rgba(6, 10, 16, 0.85)";
    floorRect(ctx, bx - 4, by - 22, barW + 8, bh + 30);
    ctx.fillStyle = "#0a0e14";
    floorRect(ctx, bx, by, barW, bh);
    ctx.fillStyle = "#1a222c";
    floorRect(ctx, bx + 2, by + 2, barW - 4, bh - 4);
    const fillW = Math.floor((barW - 4) * d.castPower);
    const hot = d.castPower > 0.72 && d.castPower < 0.92;
    ctx.fillStyle = hot ? "#68e8a8" : "#e8a84a";
    floorRect(ctx, bx + 2, by + 2, fillW, bh - 4);
    // sweet spot marks
    ctx.fillStyle = "rgba(104, 232, 168, 0.55)";
    floorRect(ctx, bx + 2 + Math.floor((barW - 4) * 0.72), by + 1, 2, bh + 2);
    floorRect(ctx, bx + 2 + Math.floor((barW - 4) * 0.92), by + 1, 2, bh + 2);
    ctx.fillStyle = hot ? "#68e8a8" : "#c8d0dc";
    ctx.font = labelFont;
    ctx.fillText(hot ? "SWEET!" : "HOLD → RELEASE", bx, by - 6);
  }

  if (d.phase === "fish_wait") {
    ctx.font = labelFont;
    ctx.textAlign = "center";
    if (d.biteOpen) {
      const pulse = 0.7 + 0.3 * Math.sin((d.now ?? 0) * 0.02);
      ctx.fillStyle = `rgba(232, 120, 80, ${pulse})`;
      ctx.font = `${Math.max(16, Math.floor(w * 0.055))}px "Press Start 2P", monospace`;
      ctx.fillText("STRIKE!", w / 2, h * 0.2);
    } else {
      ctx.fillStyle = "rgba(200, 210, 220, 0.8)";
      ctx.fillText("Waiting on the mist…", w / 2, h * 0.2);
    }
    ctx.textAlign = "left";
  }

  if (d.phase === "fish_reel") {
    const barW = Math.floor(w * 0.84);
    const bx = Math.floor((w - barW) / 2);
    const by = Math.floor(h * 0.74);
    const bh = 32;
    const lo = d.greenLo ?? 0.34;
    const hi = d.greenHi ?? 0.66;
    ctx.fillStyle = "rgba(6, 10, 16, 0.88)";
    floorRect(ctx, bx - 4, by - 24, barW + 8, bh + 44);
    ctx.fillStyle = "#0a0e14";
    floorRect(ctx, bx, by, barW, bh);
    ctx.fillStyle = "#1a222c";
    floorRect(ctx, bx + 2, by + 2, barW - 4, bh - 4);
    const g0 = bx + 2 + Math.floor((barW - 4) * lo);
    const g1 = bx + 2 + Math.floor((barW - 4) * hi);
    ctx.fillStyle = "#3a7868";
    floorRect(ctx, g0, by + 2, g1 - g0, bh - 4);
    const inZone = d.reelTension >= lo && d.reelTension <= hi;
    const tx = bx + 2 + Math.floor((barW - 4) * d.reelTension);
    ctx.fillStyle = inZone ? "#68e8a8" : "#e87850";
    floorRect(ctx, tx - 7, by, 14, bh + 4);
    ctx.strokeStyle = "#f8f0ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(tx - 7, by, 14, bh + 4);
    ctx.fillStyle = inZone ? "#68e8a8" : "#e87850";
    ctx.font = labelFont;
    ctx.fillText(inZone ? "LINE HOLDS" : "FIGHT THE LINE", bx, by - 6);
    const progH = 10;
    const py = by + bh + 10;
    floorRect(ctx, bx, py, barW, progH);
    ctx.fillStyle = "#5eb8a8";
    floorRect(ctx, bx + 1, py + 1, Math.floor((barW - 2) * d.reelProgress), progH - 2);
    ctx.fillStyle = "#c8d0dc";
    ctx.font = font;
    ctx.fillText(`${Math.floor(d.reelProgress * 100)}%`, bx + barW - 36, py + 9);
  }
}

/** Cohesive moonlit well — knightly charter rim + live fishing props. */
export function drawMoonwell(ctx2d: CanvasRenderingContext2D, d: DrawCtx, w: number, h: number) {
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.clearRect(0, 0, w, h);

  const now = d.now ?? performance.now();
  const pulse = d.waitPulse;
  const skyH = h * 0.64;

  const sky = ctx2d.createLinearGradient(0, 0, 0, skyH);
  sky.addColorStop(0, "#050810");
  sky.addColorStop(0.45, "#0c1420");
  sky.addColorStop(0.85, "#162030");
  sky.addColorStop(1, d.seasonTint ? mixTint(d.seasonTint, 0.18) : "#1a2838");
  ctx2d.fillStyle = sky;
  floorRect(ctx2d, 0, 0, w, skyH + 2);

  ctx2d.fillStyle = "rgba(220, 228, 240, 0.55)";
  for (let i = 0; i < 28; i++) {
    const x = Math.floor(((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) * 0.5 * w);
    const y = Math.floor(((Math.cos(i * 78.233) * 23421.424) % 1 + 1) * 0.5 * skyH * 0.85);
    const sz = i % 7 === 0 ? 2 : 1;
    floorRect(ctx2d, x, y, sz, sz);
  }

  const mx = Math.floor(w * 0.74);
  const my = Math.floor(h * 0.11);
  const mr = Math.max(8, Math.min(w, h) * 0.045);
  ctx2d.fillStyle = "rgba(200, 210, 230, 0.07)";
  ctx2d.beginPath();
  ctx2d.arc(mx, my, mr * 2.4, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.fillStyle = "#c8d0dc";
  ctx2d.beginPath();
  ctx2d.arc(mx, my, mr, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.fillStyle = "#9aa8b8";
  floorRect(ctx2d, mx - mr * 0.35, my - mr * 0.1, mr * 0.55, mr * 0.45);

  ctx2d.fillStyle = "#0a0e14";
  ctx2d.beginPath();
  ctx2d.moveTo(0, skyH);
  ctx2d.lineTo(0, h * 0.56);
  ctx2d.lineTo(w * 0.22, h * 0.5);
  ctx2d.lineTo(w * 0.38, h * 0.54);
  ctx2d.lineTo(w * 0.55, h * 0.48);
  ctx2d.lineTo(w * 0.72, h * 0.52);
  ctx2d.lineTo(w, h * 0.47);
  ctx2d.lineTo(w, skyH);
  ctx2d.closePath();
  ctx2d.fill();

  const groundY = Math.floor(h * 0.56);
  ctx2d.fillStyle = "#121820";
  floorRect(ctx2d, 0, groundY, w, h - groundY);

  drawKnightHeraldry(ctx2d, w, h, pulse);

  for (let i = 0; i < 6; i++) {
    const px = Math.floor((w / 6) * i);
    ctx2d.fillStyle = i % 2 === 0 ? "#1a222c" : "#151c26";
    floorRect(ctx2d, px, groundY, Math.ceil(w / 6) + 1, h - groundY);
  }

  ctx2d.fillStyle = "#1e1610";
  floorRect(ctx2d, w * 0.08, groundY - 4, w * 0.84, 8);
  ctx2d.fillStyle = "#2a2018";
  for (let i = 0; i < 8; i++) {
    const px = Math.floor(w * 0.1 + (w * 0.8 / 8) * i);
    floorRect(ctx2d, px, groundY - 3, 3, 6);
  }

  // Torch flicker
  const torch = 0.3 + 0.15 * Math.sin(pulse * 5);
  ctx2d.fillStyle = `rgba(232, 168, 74, ${torch})`;
  floorRect(ctx2d, w * 0.06, groundY - 28, 6, 10);
  floorRect(ctx2d, w * 0.9, groundY - 24, 5, 8);

  const { cx, cy, rx, ry } = wellCenter(w, h);

  ctx2d.fillStyle = "rgba(70, 130, 120, 0.12)";
  drawEllipseFill(ctx2d, cx, cy, rx * 1.08, ry * 1.15);

  const water = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, rx);
  const biteHot = d.biteOpen || now < biteFlashUntil;
  water.addColorStop(0, biteHot ? "#3a6878" : "#1a4858");
  water.addColorStop(0.55, "#123040");
  water.addColorStop(1, "#0a1824");
  ctx2d.fillStyle = water;
  drawEllipseFill(ctx2d, cx, cy, rx, ry);

  // Animated water bands
  ctx2d.save();
  ctx2d.globalAlpha = 0.08 + 0.05 * Math.sin(pulse * 3);
  ctx2d.strokeStyle = "#88c8b8";
  ctx2d.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const yOff = Math.sin(pulse * 2 + i) * 3;
    ctx2d.beginPath();
    ctx2d.ellipse(cx, cy + yOff, rx * (0.55 + i * 0.12), ry * (0.4 + i * 0.1), 0, 0, Math.PI * 2);
    ctx2d.stroke();
  }
  ctx2d.restore();

  if (now < biteFlashUntil || now < strikeFlashUntil || now < landFlashUntil) {
    const flash =
      now < strikeFlashUntil
        ? "rgba(232, 120, 80, 0.28)"
        : now < landFlashUntil
          ? "rgba(104, 232, 168, 0.22)"
          : "rgba(232, 176, 80, 0.2)";
    ctx2d.fillStyle = flash;
    drawEllipseFill(ctx2d, cx, cy, rx * 0.92, ry * 0.92);
  }

  ctx2d.strokeStyle = d.seasonTint;
  ctx2d.lineWidth = 3;
  ctx2d.beginPath();
  ctx2d.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx2d.stroke();
  ctx2d.strokeStyle = "rgba(0,0,0,0.65)";
  ctx2d.lineWidth = 1;
  ctx2d.stroke();

  // Well post
  ctx2d.fillStyle = "#2a2018";
  floorRect(ctx2d, cx - 2, cy - ry - 18, 4, 20);

  drawCastArc(ctx2d, w, h, now);
  drawSplashRipples(ctx2d, w, h, now);
  drawFishShadow(ctx2d, w, h, d, now);
  drawBobber(ctx2d, w, h, d, now);

  // Wait rings under bobber when biting
  if (d.phase === "fish_wait" && d.biteOpen) {
    const ringPulse = 0.5 + 0.5 * Math.sin(pulse * 8);
    ctx2d.strokeStyle = `rgba(232, 120, 80, ${0.35 + ringPulse * 0.45})`;
    ctx2d.lineWidth = 2;
    for (let r = 16; r < Math.min(rx, 90); r += 18) {
      ctx2d.beginPath();
      ctx2d.ellipse(cx, cy, r + ringPulse * 6, (r + ringPulse * 6) * 0.32, 0, 0, Math.PI * 2);
      ctx2d.stroke();
    }
  }

  drawMeters(ctx2d, { ...d, now }, w, h);

  if (d.loreLine) {
    const lore = d.loreLine.length > 64 ? `${d.loreLine.slice(0, 62)}…` : d.loreLine;
    ctx2d.font = `${Math.max(12, Math.floor(w * 0.032))}px "VT323", monospace`;
    const tw = Math.min(w * 0.92, ctx2d.measureText(lore).width + 24);
    const bx = Math.floor((w - tw) / 2);
    const by = Math.floor(h * 0.085);
    ctx2d.fillStyle = "rgba(8, 10, 16, 0.78)";
    floorRect(ctx2d, bx, by, tw, 28);
    ctx2d.strokeStyle = "rgba(152, 144, 200, 0.55)";
    ctx2d.lineWidth = 1;
    ctx2d.strokeRect(bx + 0.5, by + 0.5, tw - 1, 27);
    ctx2d.fillStyle = "#d8d0e8";
    ctx2d.textAlign = "center";
    ctx2d.fillText(lore, w / 2, by + 18);
    ctx2d.textAlign = "left";
  }

  if (d.banner) {
    const label = d.banner.length > 32 ? `${d.banner.slice(0, 30)}…` : d.banner;
    ctx2d.font = `${Math.max(11, w * 0.028)}px "VT323", monospace`;
    const tw = ctx2d.measureText(label).width;
    const bx = Math.floor((w - tw) / 2) - 14;
    const by = Math.floor(h * (d.loreLine ? 0.155 : 0.12));
    ctx2d.fillStyle = "rgba(0, 0, 0, 0.72)";
    floorRect(ctx2d, bx, by, tw + 28, 24);
    ctx2d.strokeStyle = "#e8b050";
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(bx, by, tw + 28, 24);
    ctx2d.fillStyle = "#e8b050";
    ctx2d.textAlign = "center";
    ctx2d.fillText(label, w / 2, by + 16);
    ctx2d.textAlign = "left";
  }
}

export const seasonTints: Record<string, string> = {
  frost: "#8cb8d8",
  bloom: "#c898b8",
  ember: "#d8a868",
  void: "#9890c8",
};
