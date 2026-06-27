/**
 * Corsus Circuit — pseudo-3D chase cam + desert road rendering.
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
};

export type ChaseItem = {
  t: number;
  lateral: number;
  kind: "turbo" | "boot" | "oil";
  taken?: boolean;
};

const SEGMENTS = 72;
const LOOK_AHEAD = 0.34;

export function trackCurvature(track: Track, t: number): number {
  const eps = 0.006;
  const a = trackAt(((t - eps) % 1 + 1) % 1, track).angle;
  const b = trackAt(((t + eps) % 1 + 1) % 1, track).angle;
  let da = b - a;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return Math.abs(da) / (eps * 2);
}

type RoadSeg = {
  sx: number;
  sy: number;
  hw: number;
  t: number;
  ahead: number;
};

function buildRoadSegments(
  track: Track,
  playerFrac: number,
  playerLat: number,
  w: number,
  playTop: number,
  playH: number,
): RoadSeg[] {
  const player = trackAt(playerFrac, track);
  const cosA = Math.cos(player.angle);
  const sinA = Math.sin(player.angle);
  const baseY = playTop + playH * 0.9;
  const depth = playH * 0.72;
  const out: RoadSeg[] = [];

  for (let i = 0; i <= SEGMENTS; i++) {
    const aheadNorm = (i / SEGMENTS) * LOOK_AHEAD;
    const t = (playerFrac + aheadNorm) % 1;
    const pos = trackAt(t, track);
    let dx = pos.x - player.x;
    let dy = pos.y - player.y;
    if (dx > 0.5) dx -= 1;
    if (dx < -0.5) dx += 1;

    const ahead = dx * cosA + dy * sinA;
    const right = dx * -sinA + dy * cosA;
    const persp = 1 / (1 + Math.max(0, ahead) * 9);
    const sx = w / 2 + right * w * 2.1 * persp + playerLat * w * 0.14 * persp;
    const sy = baseY - ahead * depth * 5.2 * persp;
    const hw = Math.max(8, w * 0.22 * persp);

    out.push({ sx, sy, hw, t, ahead });
  }
  return out;
}

function drawDesertSky(ctx: CanvasRenderingContext2D, w: number, playTop: number, playH: number, tick: number) {
  const grad = ctx.createLinearGradient(0, playTop, 0, playTop + playH);
  grad.addColorStop(0, "#1a1428");
  grad.addColorStop(0.35, "#4a2838");
  grad.addColorStop(0.7, "#8a5848");
  grad.addColorStop(1, "#c89868");
  ctx.fillStyle = grad;
  ctx.fillRect(0, playTop, w, playH);

  const sunX = w * 0.72;
  const sunY = playTop + playH * 0.22;
  ctx.fillStyle = "rgba(232, 176, 80, 0.15)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8c878";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const mx = ((i * 137 + tick * 0.2) % (w + 80)) - 40;
    ctx.fillStyle = "rgba(90, 60, 50, 0.35)";
    ctx.fillRect(mx, playTop + playH * 0.55, 24 + (i % 3) * 12, 8 + (i % 2) * 6);
  }
}

function drawRoadStrip(ctx: CanvasRenderingContext2D, segs: RoadSeg[]) {
  for (let i = segs.length - 2; i >= 0; i--) {
    const a = segs[i]!;
    const b = segs[i + 1]!;
    if (a.sy < b.sy - 2) continue;

    ctx.fillStyle = "#3a2818";
    ctx.beginPath();
    ctx.moveTo(a.sx - a.hw - 4, a.sy);
    ctx.lineTo(b.sx - b.hw - 4, b.sy);
    ctx.lineTo(b.sx + b.hw + 4, b.sy);
    ctx.lineTo(a.sx + a.hw + 4, a.sy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = i % 2 === 0 ? "#5a4030" : "#4a3428";
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

    if (i % 5 === 0 && a.hw > 12) {
      ctx.fillStyle = "rgba(248, 240, 255, 0.75)";
      const dashH = Math.max(4, (a.sy - b.sy) * 0.35);
      ctx.fillRect(a.sx - 2, a.sy - dashH, 4, dashH);
    }

    if (a.hw > 14 && i % 3 === 0) {
      ctx.fillStyle = "rgba(200, 60, 60, 0.55)";
      ctx.fillRect(a.sx - a.hw + 2, a.sy - 3, 5, 3);
      ctx.fillRect(a.sx + a.hw - 7, a.sy - 3, 5, 3);
    }
  }
}

function placeOnRoad(
  track: Track,
  playerFrac: number,
  playerLat: number,
  targetT: number,
  targetLat: number,
  w: number,
  playTop: number,
  playH: number,
): { x: number; y: number; angle: number; visible: boolean } | null {
  const player = trackAt(playerFrac, track);
  const cosA = Math.cos(player.angle);
  const sinA = Math.sin(player.angle);
  const pos = trackAt(targetT, track);
  let dx = pos.x - player.x;
  let dy = pos.y - player.y;
  if (dx > 0.5) dx -= 1;
  if (dx < -0.5) dx += 1;

  const ahead = dx * cosA + dy * sinA;
  if (ahead < -0.015) return null;
  const right = dx * -sinA + dy * cosA + (targetLat - playerLat) * 0.22;
  const persp = 1 / (1 + ahead * 9);
  const baseY = playTop + playH * 0.9;
  const depth = playH * 0.72;

  return {
    x: w / 2 + right * w * 2.1 * persp,
    y: baseY - ahead * depth * 5.2 * persp,
    angle: pos.angle - player.angle,
    visible: true,
  };
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
) {
  const player = racers.find((r) => r.isPlayer)!;
  const playerFrac = ((player.lapProgress % 1) + 1) % 1;

  drawDesertSky(ctx, w, playTop, playH, tick);
  const segs = buildRoadSegments(track, playerFrac, player.lateral, w, playTop, playH);
  drawRoadStrip(ctx, segs);

  for (const item of items) {
    if (item.taken) continue;
    const p = placeOnRoad(track, playerFrac, player.lateral, item.t, item.lateral, w, playTop, playH);
    if (!p || p.y > playTop + playH - 40) continue;
    ctx.fillStyle = item.kind === "turbo" ? "#e87850" : item.kind === "boot" ? "#98b8e8" : "#2a1810";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
    if (item.kind === "turbo") {
      ctx.strokeStyle = "rgba(248, 240, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9 + Math.sin(tick * 0.2) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const sorted = [...racers].sort((a, b) => {
    const fa = ((a.lapProgress % 1) + 1) % 1;
    const fb = ((b.lapProgress % 1) + 1) % 1;
    let da = fb - fa;
    if (da > 0.5) da -= 1;
    if (da < -0.5) da += 1;
    return da;
  });

  for (const r of sorted) {
    const frac = ((r.lapProgress % 1) + 1) % 1;
    const p = placeOnRoad(track, playerFrac, player.lateral, frac, r.lateral, w, playTop, playH);
    if (!p) continue;
    const scale = r.isPlayer ? 1.15 : 0.95;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.scale(scale, scale);
    if (r.isPlayer) {
      drawKnightRacer(ctx, 0, 0, 0, true);
      if (r.boost > 1.05) {
        ctx.fillStyle = "rgba(232, 120, 80, 0.45)";
        ctx.fillRect(-18, 8, 36, 6);
      }
    } else {
      ctx.fillStyle = r.color;
      ctx.fillRect(-12, -7, 24, 14);
      ctx.fillStyle = "#1a1810";
      ctx.fillRect(4, -5, 8, 10);
    }
    ctx.restore();
  }

  drawMiniMap(ctx, track, racers, w, playTop);

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(10, playTop + playH - 36, 72, 28);
  ctx.strokeStyle = "#e8b050";
  ctx.lineWidth = 1;
  ctx.strokeRect(10, playTop + playH - 36, 72, 28);
  ctx.fillStyle = "#f8f0ff";
  ctx.font = '14px "VT323", monospace';
  ctx.fillText(`${Math.round(speedMph)}`, 18, playTop + playH - 18);
  ctx.fillStyle = "rgba(248, 240, 255, 0.55)";
  ctx.font = '10px "VT323", monospace';
  ctx.fillText("CHARTER", 18, playTop + playH - 8);

  const startP = placeOnRoad(track, playerFrac, player.lateral, 0, 0, w, playTop, playH);
  if (startP && startP.y > playTop + 24 && startP.y < playTop + playH - 20) {
    ctx.fillStyle = "rgba(248, 240, 255, 0.85)";
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText("START", startP.x - 18, startP.y - 10);
  }

  if (player.boost > 1.05) {
    ctx.fillStyle = "rgba(232, 120, 80, 0.25)";
    for (let i = 0; i < 8; i++) {
      const lx = w / 2 + (Math.sin(tick * 0.3 + i) * 40);
      const ly = playTop + playH * 0.82 + i * 4;
      ctx.fillRect(lx, ly, 3, 8);
    }
  }
}
