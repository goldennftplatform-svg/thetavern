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
  bank: number;
  shake: number;
  countdown?: string;
  boosting: boolean;
};

const SEGMENTS = 84;
const LOOK_AHEAD = 0.42;

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
  steerHeld: number,
  speedNorm: number,
  w: number,
  playTop: number,
  playH: number,
): RoadSeg[] {
  const camLat = playerLat * 0.88 + steerHeld * 0.22;
  const player = trackAt(playerFrac, track);
  const cosA = Math.cos(player.angle);
  const sinA = Math.sin(player.angle);
  const baseY = playTop + playH * 0.9;
  const depth = playH * 0.78;
  const fovBoost = 1 + speedNorm * 0.18;
  const out: RoadSeg[] = [];

  for (let i = 0; i <= SEGMENTS; i++) {
    const aheadNorm = (i / SEGMENTS) * LOOK_AHEAD * fovBoost;
    const t = (playerFrac + aheadNorm) % 1;
    const pos = trackAt(t, track);
    let dx = pos.x - player.x;
    let dy = pos.y - player.y;
    if (dx > 0.5) dx -= 1;
    if (dx < -0.5) dx += 1;

    const ahead = dx * cosA + dy * sinA;
    const right = dx * -sinA + dy * cosA;
    const persp = 1 / (1 + Math.max(0, ahead) * (8.2 - speedNorm * 1.8));
    const sx = w / 2 + right * w * 2.35 * persp + camLat * w * 0.52 * persp;
    const sy = baseY - ahead * depth * 5.6 * persp;
    const hw = Math.max(10, w * (0.24 + speedNorm * 0.02) * persp);

    out.push({ sx, sy, hw, t, ahead });
  }
  return out;
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

  const sunX = w * 0.68 + Math.sin(tick * 0.08) * 6;
  const sunY = playTop + playH * 0.2;
  ctx.fillStyle = "rgba(232, 176, 80, 0.22)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 56 + speedNorm * 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0d878";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 8; i++) {
    const mx = ((i * 151 + tick * (18 + speedNorm * 40)) % (w + 120)) - 60;
    const my = playTop + playH * (0.48 + (i % 4) * 0.08);
    ctx.fillStyle = `rgba(70, 45, 35, ${0.28 + (i % 2) * 0.12})`;
    ctx.fillRect(mx, my, 28 + (i % 3) * 16, 10 + (i % 2) * 8);
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
  if (speedNorm < 0.35) return;
  const n = Math.floor(6 + speedNorm * 18);
  ctx.save();
  ctx.globalAlpha = 0.08 + speedNorm * 0.22;
  ctx.strokeStyle = "#f8f0ff";
  ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const x = (i * 97 + tick * (80 + speedNorm * 120)) % (w + 40) - 20;
    const y0 = playTop + playH * (0.22 + (i % 5) * 0.12);
    const len = 16 + speedNorm * 48;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x - 8, y0 + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSideScenery(ctx: CanvasRenderingContext2D, segs: RoadSeg[], tick: number, speedNorm: number) {
  for (let i = 8; i < segs.length - 4; i += 7) {
    const s = segs[i]!;
    if (s.hw < 16 || s.sy > segs[0]!.sy - 20) continue;
    const h = 12 + (i % 3) * 10;
    const sway = Math.sin(tick * 0.15 + i) * 2;
    for (const side of [-1, 1]) {
      const bx = s.sx + side * (s.hw + 14 + (i % 4) * 6) + sway;
      const by = s.sy;
      ctx.fillStyle = side < 0 ? "rgba(40, 28, 22, 0.75)" : "rgba(52, 36, 28, 0.7)";
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + side * 8, by - h);
      ctx.lineTo(bx + side * 16, by);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (speedNorm > 0.55) {
    ctx.fillStyle = `rgba(200, 140, 80, ${0.06 + speedNorm * 0.08})`;
    for (let i = 0; i < 5; i++) {
      const s = segs[12 + i * 5];
      if (!s) continue;
      ctx.fillRect(s.sx - s.hw - 20, s.sy - 4, s.hw * 2 + 40, 3);
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
    ctx.moveTo(a.sx - a.hw - 6, a.sy);
    ctx.lineTo(b.sx - b.hw - 6, b.sy);
    ctx.lineTo(b.sx + b.hw + 6, b.sy);
    ctx.lineTo(a.sx + a.hw + 6, a.sy);
    ctx.closePath();
    ctx.fill();

    const stripe = i % (speedNorm > 0.6 ? 3 : 4) === 0;
    ctx.fillStyle = stripe ? "#6a5038" : "#4a3828";
    ctx.beginPath();
    ctx.moveTo(a.sx - a.hw, a.sy);
    ctx.lineTo(b.sx - b.hw, b.sy);
    ctx.lineTo(b.sx + b.hw, b.sy);
    ctx.lineTo(a.sx + a.hw, a.sy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = i % 2 === 0 ? "#f0c868" : "#e8b050";
    ctx.lineWidth = 2 + speedNorm;
    ctx.beginPath();
    ctx.moveTo(a.sx - a.hw, a.sy);
    ctx.lineTo(b.sx - b.hw, b.sy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.sx + a.hw, a.sy);
    ctx.lineTo(b.sx + b.hw, b.sy);
    ctx.stroke();

    if (i % 4 === 0 && a.hw > 10) {
      ctx.fillStyle = "rgba(248, 240, 255, 0.85)";
      const dashH = Math.max(5, (a.sy - b.sy) * (0.42 + speedNorm * 0.2));
      ctx.fillRect(a.sx - 2, a.sy - dashH, 4, dashH);
    }

    if (a.hw > 16 && i % 2 === 0) {
      ctx.fillStyle = "rgba(220, 70, 60, 0.65)";
      ctx.fillRect(a.sx - a.hw + 2, a.sy - 4, 6, 4);
      ctx.fillRect(a.sx + a.hw - 8, a.sy - 4, 6, 4);
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
  const right = dx * -sinA + dy * cosA + (targetLat - playerLat) * 0.26;
  const persp = 1 / (1 + ahead * 8.2);
  const baseY = playTop + playH * 0.9;
  const depth = playH * 0.78;

  return {
    x: w / 2 + right * w * 2.35 * persp,
    y: baseY - ahead * depth * 5.6 * persp,
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
) {
  const player = racers.find((r) => r.isPlayer)!;
  const playerFrac = ((player.lapProgress % 1) + 1) % 1;
  const cx = w / 2;
  const cy = playTop + playH * 0.55;

  drawDesertSky(ctx, w, playTop, playH, tick, fx.speedNorm);
  drawSpeedLines(ctx, w, playTop, playH, fx.speedNorm, tick);

  ctx.save();
  ctx.translate(cx + fx.shake, cy);
  ctx.rotate(fx.bank);
  ctx.translate(-cx, -cy);

  const segs = buildRoadSegments(
    track,
    playerFrac,
    player.lateral,
    player.steerHeld ?? 0,
    fx.speedNorm,
    w,
    playTop,
    playH,
  );
  drawSideScenery(ctx, segs, tick, fx.speedNorm);
  drawRoadStrip(ctx, segs, fx.speedNorm);

  for (const item of items) {
    if (item.taken) continue;
    const p = placeOnRoad(track, playerFrac, player.lateral, item.t, item.lateral, w, playTop, playH);
    if (!p || p.y > playTop + playH - 40) continue;
    ctx.fillStyle = item.kind === "turbo" ? "#e87850" : item.kind === "boot" ? "#98b8e8" : "#2a1810";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    if (item.kind === "turbo") {
      ctx.strokeStyle = "rgba(248, 240, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11 + Math.sin(tick * 0.25) * 3, 0, Math.PI * 2);
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
    const scale = r.isPlayer ? 1.2 : 0.92;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2 + (r.isPlayer ? (r.steerHeld ?? 0) * 0.55 : 0));
    ctx.scale(scale, scale);
    if (r.isPlayer) {
      drawKnightRacer(ctx, 0, 0, 0, true);
      if (r.boost > 1.05 || fx.boosting) {
        ctx.fillStyle = "rgba(232, 120, 80, 0.55)";
        ctx.fillRect(-20, 10, 40, 8);
        ctx.fillStyle = "rgba(248, 240, 255, 0.35)";
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(-22 - i * 5, 12 + (i % 2) * 2, 4, 3);
        }
      }
      if (r.drifting) {
        ctx.strokeStyle = "rgba(248, 240, 255, 0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-14, 12);
        ctx.lineTo(-28, 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(14, 12);
        ctx.lineTo(28, 18);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = r.color;
      ctx.fillRect(-13, -8, 26, 16);
      ctx.fillStyle = "#1a1810";
      ctx.fillRect(5, -6, 9, 12);
      ctx.fillStyle = "rgba(248,240,255,0.5)";
      ctx.fillRect(-10, -2, 6, 4);
    }
    ctx.restore();
  }

  ctx.restore();

  drawMiniMap(ctx, track, racers, w, playTop);
  drawSpeedHud(ctx, playTop, playH, speedMph, fx.speedNorm, fx.boosting);

  const startP = placeOnRoad(track, playerFrac, player.lateral, 0, 0, w, playTop, playH);
  if (startP && startP.y > playTop + 24 && startP.y < playTop + playH - 20) {
    ctx.fillStyle = "rgba(248, 240, 255, 0.9)";
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText("START", startP.x - 18, startP.y - 10);
  }

  if (fx.boosting) {
    ctx.fillStyle = "rgba(232, 120, 80, 0.2)";
    for (let i = 0; i < 10; i++) {
      const lx = w / 2 + Math.sin(tick * 0.35 + i * 0.8) * (50 + i * 4);
      const ly = playTop + playH * 0.78 + (i % 4) * 5;
      ctx.fillRect(lx, ly, 4, 10 + (i % 3) * 4);
    }
  }

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
