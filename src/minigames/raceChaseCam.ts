/**
 * Corsus Circuit — pseudo-3D chase cam + desert road rendering.
 * Road mesh uses parametric track integration (no world-space wrap glitches).
 */

import type { Track } from "./raceTrack";
import { trackAt } from "./raceTrack";
import { drawKnightRacer } from "../sprites/knightSprite";

export type ChaseRacer = {
  name: string;
  color: string;
  isPlayer: boolean;
  lapProgress: number;
  lateral: number;
  boost: number;
  steerHeld?: number;
  drifting?: boolean;
};

export type ChaseItem = {
  t: number;
  lateral: number;
  kind: "turbo" | "boot" | "oil";
  taken?: boolean;
};

export type ChaseCamFx = {
  speedNorm: number;
  shake: number;
  countdown?: string;
  boosting: boolean;
};

const SEGMENTS = 72;
const LOOK_AHEAD = 0.38;

export function trackCurvature(track: Track, t: number): number {
  const eps = 0.006;
  const a = trackAt(((t - eps) % 1 + 1) % 1, track).angle;
  const b = trackAt(((t + eps) % 1 + 1) % 1, track).angle;
  let da = b - a;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return Math.abs(da) / (eps * 2);
}

function angleDelta(track: Track, t0: number, t1: number): number {
  const a0 = trackAt(t0, track).angle;
  const a1 = trackAt(t1, track).angle;
  let da = a1 - a0;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return da;
}

/** Forward distance along track parameter (0–1 wrap). */
export function trackAheadDelta(from: number, to: number): number {
  let d = to - from;
  if (d < 0) d += 1;
  return d;
}

type RoadSeg = {
  sx: number;
  sy: number;
  hw: number;
  t: number;
  ahead: number;
};

function perspFor(ahead: number): number {
  return 1 / (1 + Math.max(0, ahead) * 9.5);
}

function buildRoadSegments(
  track: Track,
  playerFrac: number,
  playerLat: number,
  w: number,
  playTop: number,
  playH: number,
): RoadSeg[] {
  const baseY = playTop + playH * 0.9;
  const depth = playH * 0.76;
  let centerX = w / 2 + playerLat * w * 0.4;
  let prevT = playerFrac;
  const out: RoadSeg[] = [];

  for (let i = 0; i <= SEGMENTS; i++) {
    const ahead = (i / SEGMENTS) * LOOK_AHEAD;
    const t = playerFrac + ahead;
    if (i > 0) {
      const da = angleDelta(track, prevT, t);
      centerX += da * w * 2.35 * perspFor(ahead);
    }
    prevT = t;
    const p = perspFor(ahead);
    const latFade = playerLat * (1 - ahead / LOOK_AHEAD) * w * 0.12 * p;
    const sx = centerX + latFade;
    const sy = baseY - ahead * depth * 5.6;
    const hw = Math.max(10, w * 0.24 * p);
    out.push({ sx, sy, hw, t: ((t % 1) + 1) % 1, ahead });
  }
  return out;
}

function projectOnRoad(
  track: Track,
  playerFrac: number,
  playerLat: number,
  targetT: number,
  targetLat: number,
  w: number,
  playTop: number,
  playH: number,
): { x: number; y: number; angle: number } | null {
  const ahead = trackAheadDelta(playerFrac, targetT);
  if (ahead > 0.48) return null;

  const baseY = playTop + playH * 0.9;
  const depth = playH * 0.76;
  let centerX = w / 2 + playerLat * w * 0.4;
  let prevT = playerFrac;
  const steps = Math.max(1, Math.round((ahead / LOOK_AHEAD) * SEGMENTS));

  for (let i = 1; i <= steps; i++) {
    const a = ahead * (i / steps);
    const t = playerFrac + a;
    const da = angleDelta(track, prevT, t);
    centerX += da * w * 2.35 * perspFor(a);
    prevT = t;
  }

  const p = perspFor(ahead);
  const latFade = playerLat * (1 - ahead / LOOK_AHEAD) * w * 0.12 * p;
  const latOff = (targetLat - playerLat) * w * 0.32 * p;
  const pos = trackAt(playerFrac + ahead, track);
  const playerAng = trackAt(playerFrac, track).angle;

  return {
    x: centerX + latFade + latOff,
    y: baseY - ahead * depth * 5.6,
    angle: pos.angle - playerAng,
  };
}

function drawDesertSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  playTop: number,
  playH: number,
  tick: number,
  speedNorm: number,
) {
  const grad = ctx.createLinearGradient(0, playTop, 0, playTop + playH);
  grad.addColorStop(0, "#120818");
  grad.addColorStop(0.28, "#3a1838");
  grad.addColorStop(0.62, "#8a4838");
  grad.addColorStop(1, "#d8a060");
  ctx.fillStyle = grad;
  ctx.fillRect(0, playTop, w, playH);

  const sunX = w * 0.68;
  const sunY = playTop + playH * 0.2;
  ctx.fillStyle = "rgba(232, 176, 80, 0.2)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0d878";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const mx = ((i * 151 + tick * (14 + speedNorm * 24)) % (w + 100)) - 50;
    const my = playTop + playH * (0.5 + (i % 3) * 0.1);
    ctx.fillStyle = "rgba(70, 45, 35, 0.3)";
    ctx.fillRect(mx, my, 24 + (i % 2) * 12, 8);
  }
}

function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  w: number,
  playTop: number,
  playH: number,
  speedNorm: number,
  tick: number,
) {
  if (speedNorm < 0.4) return;
  const n = Math.floor(4 + speedNorm * 10);
  ctx.save();
  ctx.globalAlpha = 0.06 + speedNorm * 0.14;
  ctx.strokeStyle = "#f8f0ff";
  ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const x = (i * 97 + tick * (60 + speedNorm * 80)) % (w + 40) - 20;
    const y0 = playTop + playH * (0.25 + (i % 4) * 0.1);
    const len = 12 + speedNorm * 32;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x - 6, y0 + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSideScenery(ctx: CanvasRenderingContext2D, segs: RoadSeg[]) {
  for (let i = 10; i < segs.length - 4; i += 8) {
    const s = segs[i]!;
    if (s.hw < 14) continue;
    const h = 10 + (i % 3) * 8;
    for (const side of [-1, 1]) {
      const bx = s.sx + side * (s.hw + 16);
      ctx.fillStyle = "rgba(45, 30, 24, 0.7)";
      ctx.beginPath();
      ctx.moveTo(bx, s.sy);
      ctx.lineTo(bx + side * 7, s.sy - h);
      ctx.lineTo(bx + side * 14, s.sy);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawRoadStrip(ctx: CanvasRenderingContext2D, segs: RoadSeg[], speedNorm: number) {
  for (let i = segs.length - 2; i >= 0; i--) {
    const a = segs[i]!;
    const b = segs[i + 1]!;
    if (a.sy < b.sy - 2) continue;

    ctx.fillStyle = "#2a1810";
    ctx.beginPath();
    ctx.moveTo(a.sx - a.hw - 5, a.sy);
    ctx.lineTo(b.sx - b.hw - 5, b.sy);
    ctx.lineTo(b.sx + b.hw + 5, b.sy);
    ctx.lineTo(a.sx + a.hw + 5, a.sy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = i % 2 === 0 ? "#5a4838" : "#4a3828";
    ctx.beginPath();
    ctx.moveTo(a.sx - a.hw, a.sy);
    ctx.lineTo(b.sx - b.hw, b.sy);
    ctx.lineTo(b.sx + b.hw, b.sy);
    ctx.lineTo(a.sx + a.hw, a.sy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#e8b050";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.sx - a.hw, a.sy);
    ctx.lineTo(b.sx - b.hw, b.sy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.sx + a.hw, a.sy);
    ctx.lineTo(b.sx + b.hw, b.sy);
    ctx.stroke();

    if (i % 4 === 0 && a.hw > 10) {
      ctx.fillStyle = "rgba(248, 240, 255, 0.8)";
      const dashH = Math.max(4, (a.sy - b.sy) * (0.4 + speedNorm * 0.15));
      ctx.fillRect(a.sx - 2, a.sy - dashH, 4, dashH);
    }
  }
}

function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  track: Track,
  racers: ChaseRacer[],
  w: number,
  playTop: number,
) {
  const mx = w - 78;
  const my = playTop + 8;
  const mw = 68;
  const mh = 52;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = "rgba(232, 176, 80, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mw, mh);

  ctx.strokeStyle = "rgba(232, 176, 80, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const p = trackAt(t, track);
    const px = mx + 6 + p.x * (mw - 12);
    const py = my + 6 + p.y * (mh - 12);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  for (const r of racers) {
    const frac = ((r.lapProgress % 1) + 1) % 1;
    const p = trackAt(frac, track);
    ctx.fillStyle = r.isPlayer ? "#68e8a8" : r.color;
    ctx.beginPath();
    ctx.arc(mx + 6 + p.x * (mw - 12), my + 6 + p.y * (mh - 12), r.isPlayer ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(248, 240, 255, 0.6)";
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.fillText("MAP", mx + 4, my + mh - 2);
}

function drawSpeedHud(
  ctx: CanvasRenderingContext2D,
  playTop: number,
  playH: number,
  speedMph: number,
  speedNorm: number,
  boosting: boolean,
) {
  const x = 10;
  const y = playTop + playH - 42;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(x, y, 88, 34);
  ctx.strokeStyle = boosting ? "#e87850" : "#e8b050";
  ctx.lineWidth = boosting ? 2 : 1;
  ctx.strokeRect(x, y, 88, 34);

  ctx.fillStyle = boosting ? "#e87850" : "#f8f0ff";
  ctx.font = '18px "VT323", monospace';
  ctx.fillText(`${Math.round(speedMph)}`, x + 8, y + 22);
  ctx.fillStyle = "rgba(248, 240, 255, 0.55)";
  ctx.font = '10px "VT323", monospace';
  ctx.fillText("CHARTER", x + 8, y + 32);

  ctx.fillStyle = "#1a1420";
  ctx.fillRect(x + 48, y + 8, 32, 6);
  ctx.fillStyle = boosting ? "#e87850" : "#68e8a8";
  ctx.fillRect(x + 48, y + 8, 32 * Math.min(1, speedNorm), 6);
}

export function drawCorsusChaseRace(
  ctx: CanvasRenderingContext2D,
  w: number,
  playTop: number,
  playH: number,
  track: Track,
  racers: ChaseRacer[],
  items: ChaseItem[],
  tick: number,
  speedMph: number,
  fx: ChaseCamFx,
  displayLat: number,
) {
  const player = racers.find((r) => r.isPlayer)!;
  const playerFrac = ((player.lapProgress % 1) + 1) % 1;

  drawDesertSky(ctx, w, playTop, playH, tick, fx.speedNorm);
  drawSpeedLines(ctx, w, playTop, playH, fx.speedNorm, tick);

  ctx.save();
  ctx.translate(fx.shake, 0);

  const segs = buildRoadSegments(track, playerFrac, displayLat, w, playTop, playH);
  drawSideScenery(ctx, segs);
  drawRoadStrip(ctx, segs, fx.speedNorm);

  for (const item of items) {
    if (item.taken) continue;
    const p = projectOnRoad(track, playerFrac, displayLat, item.t, item.lateral, w, playTop, playH);
    if (!p || p.y > playTop + playH - 40) continue;
    ctx.fillStyle = item.kind === "turbo" ? "#e87850" : item.kind === "boot" ? "#98b8e8" : "#2a1810";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  const sorted = [...racers].sort((a, b) => {
    const da = trackAheadDelta(
      ((a.lapProgress % 1) + 1) % 1,
      ((b.lapProgress % 1) + 1) % 1,
    );
    const db = trackAheadDelta(
      ((b.lapProgress % 1) + 1) % 1,
      ((a.lapProgress % 1) + 1) % 1,
    );
    return da - db;
  });

  for (const r of sorted) {
    const frac = ((r.lapProgress % 1) + 1) % 1;
    const p = projectOnRoad(track, playerFrac, displayLat, frac, r.lateral, w, playTop, playH);
    if (!p) continue;
    const scale = r.isPlayer ? 1.18 : 0.92;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2 + (r.isPlayer ? (r.steerHeld ?? 0) * 0.35 : 0));
    ctx.scale(scale, scale);
    if (r.isPlayer) {
      drawKnightRacer(ctx, 0, 0, 0, true);
      if (r.boost > 1.05 || fx.boosting) {
        ctx.fillStyle = "rgba(232, 120, 80, 0.5)";
        ctx.fillRect(-18, 10, 36, 7);
      }
    } else {
      ctx.fillStyle = r.color;
      ctx.fillRect(-13, -8, 26, 16);
      ctx.fillStyle = "#1a1810";
      ctx.fillRect(5, -6, 9, 12);
    }
    ctx.restore();
  }

  ctx.restore();

  drawMiniMap(ctx, track, racers, w, playTop);
  drawSpeedHud(ctx, playTop, playH, speedMph, fx.speedNorm, fx.boosting);

  if (fx.countdown) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, playTop, w, playH);
    ctx.fillStyle = fx.countdown === "GO!" ? "#68e8a8" : "#f8f0ff";
    ctx.font = '28px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText(fx.countdown, w / 2, playTop + playH * 0.48);
    ctx.textAlign = "left";
  }
}
