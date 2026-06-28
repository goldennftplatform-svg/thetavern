import type { GamePhase } from "../game/types";

type DrawCtx = {
  phase: GamePhase;
  castPower: number;
  biteOpen: boolean;
  waitPulse: number;
  reelTension: number;
  reelProgress: number;
  seasonTint: string;
  banner?: string;
};

function floorRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
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
  const shimmer = 0.35 + Math.sin(pulse * 2) * 0.1;

  ctx2d.fillStyle = "#1a1410";
  floorRect(ctx2d, w * 0.04, groundY - 42, 10, 38);
  floorRect(ctx2d, w * 0.92, groundY - 38, 10, 34);
  ctx2d.fillStyle = `rgba(232, 176, 80, ${shimmer})`;
  ctx2d.font = '7px "Press Start 2P", monospace';
  ctx2d.fillText("⚔", w * 0.045, groundY - 48);
  ctx2d.fillText("⚔", w * 0.925, groundY - 44);

  ctx2d.fillStyle = "rgba(72, 48, 88, 0.55)";
  floorRect(ctx2d, 8, groundY - 72, 22, 52);
  floorRect(ctx2d, w - 30, groundY - 68, 22, 48);
  ctx2d.fillStyle = `rgba(232, 176, 80, ${0.25 + shimmer * 0.3})`;
  floorRect(ctx2d, 12, groundY - 66, 14, 6);
  floorRect(ctx2d, w - 26, groundY - 62, 14, 6);

  ctx2d.fillStyle = `rgba(200, 160, 80, ${0.12 + shimmer * 0.08})`;
  ctx2d.font = '6px "Press Start 2P", monospace';
  ctx2d.textAlign = "center";
  ctx2d.fillText("MOONWELL TAVERN", w / 2, groundY - 52);
  ctx2d.textAlign = "left";

  ctx2d.strokeStyle = `rgba(152, 144, 200, ${0.35 + shimmer * 0.2})`;
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  ctx2d.moveTo(w * 0.18, groundY - 8);
  ctx2d.lineTo(w * 0.42, groundY - 18);
  ctx2d.lineTo(w * 0.58, groundY - 18);
  ctx2d.lineTo(w * 0.82, groundY - 8);
  ctx2d.stroke();
}

/** Cohesive moonlit well — knightly charter rim, no scraped banner layers. */
export function drawMoonwell(ctx2d: CanvasRenderingContext2D, d: DrawCtx, w: number, h: number) {
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.clearRect(0, 0, w, h);

  const pulse = d.waitPulse;
  const skyH = h * 0.64;

  const sky = ctx2d.createLinearGradient(0, 0, 0, skyH);
  sky.addColorStop(0, "#050810");
  sky.addColorStop(0.55, "#0c1420");
  sky.addColorStop(1, "#162030");
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

  ctx2d.fillStyle = "rgba(232, 168, 74, 0.35)";
  floorRect(ctx2d, w * 0.06, groundY - 28, 6, 10);
  floorRect(ctx2d, w * 0.9, groundY - 24, 5, 8);

  const cy = Math.floor(h * 0.58);
  const rx = w * 0.36;
  const ry = h * 0.1;

  ctx2d.fillStyle = "rgba(70, 130, 120, 0.12)";
  drawEllipseFill(ctx2d, w / 2, cy, rx * 1.08, ry * 1.15);

  const water = ctx2d.createRadialGradient(w / 2, cy, 0, w / 2, cy, rx);
  water.addColorStop(0, "#1a4858");
  water.addColorStop(0.55, "#123040");
  water.addColorStop(1, "#0a1824");
  ctx2d.fillStyle = water;
  drawEllipseFill(ctx2d, w / 2, cy, rx, ry);

  const shimmer = 0.04 + 0.03 * Math.sin(pulse * 4);
  ctx2d.save();
  ctx2d.globalAlpha = shimmer;
  ctx2d.fillStyle = "#88c8b8";
  drawEllipseFill(ctx2d, w / 2 - rx * 0.15, cy - ry * 0.2, rx * 0.35, ry * 0.25);
  ctx2d.restore();

  ctx2d.fillStyle = "rgba(200, 210, 220, 0.08)";
  drawEllipseFill(ctx2d, mx - w * 0.12, cy + ry * 0.15, rx * 0.12, ry * 0.08);

  ctx2d.strokeStyle = d.seasonTint;
  ctx2d.lineWidth = 3;
  ctx2d.beginPath();
  ctx2d.ellipse(w / 2, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx2d.stroke();
  ctx2d.strokeStyle = "rgba(0,0,0,0.65)";
  ctx2d.lineWidth = 1;
  ctx2d.stroke();

  ctx2d.fillStyle = "#2a2018";
  floorRect(ctx2d, w / 2 - 2, cy - ry - 18, 4, 20);

  const font = '9px "Press Start 2P", monospace';

  if (d.phase === "fish_cast") {
    const barW = Math.floor(w * 0.68);
    const bx = Math.floor((w - barW) / 2);
    const by = Math.floor(h * 0.78);
    const bh = 18;
    ctx2d.fillStyle = "#0a0e14";
    floorRect(ctx2d, bx, by, barW, bh);
    ctx2d.fillStyle = "#1a222c";
    floorRect(ctx2d, bx + 2, by + 2, barW - 4, bh - 4);
    const fillW = Math.floor((barW - 4) * d.castPower);
    ctx2d.fillStyle = "#e8a84a";
    floorRect(ctx2d, bx + 2, by + 2, fillW, bh - 4);
    ctx2d.fillStyle = "#c8d0dc";
    ctx2d.font = font;
    ctx2d.fillText("HOLD / RELEASE", bx, by - 6);
  }

  if (d.phase === "fish_wait") {
    const ringPulse = 0.5 + 0.5 * Math.sin(pulse * 6);
    ctx2d.strokeStyle = d.biteOpen ? "rgba(232, 120, 80, 0.85)" : "rgba(94, 184, 168, 0.45)";
    ctx2d.lineWidth = 2;
    for (let r = 12; r < Math.min(w, h) * 0.32; r += 20) {
      ctx2d.beginPath();
      ctx2d.arc(w / 2, cy, r + ringPulse * 8, 0, Math.PI * 2);
      ctx2d.stroke();
    }
    ctx2d.fillStyle = d.biteOpen ? "#e87850" : "#c8d0dc";
    ctx2d.font = font;
    const msg = d.biteOpen ? "STRIKE!" : "WAIT...";
    const tw = ctx2d.measureText(msg).width;
    ctx2d.fillText(msg, (w - tw) / 2, h * 0.22);
  }

  if (d.phase === "fish_reel") {
    const barW = Math.floor(w * 0.8);
    const bx = Math.floor((w - barW) / 2);
    const by = Math.floor(h * 0.72);
    const bh = 28;
    ctx2d.fillStyle = "#0a0e14";
    floorRect(ctx2d, bx, by, barW, bh);
    ctx2d.fillStyle = "#1a222c";
    floorRect(ctx2d, bx + 2, by + 2, barW - 4, bh - 4);
    const g0 = bx + 2 + Math.floor((barW - 4) * 0.36);
    const g1 = bx + 2 + Math.floor((barW - 4) * 0.64);
    ctx2d.fillStyle = "#3a7868";
    floorRect(ctx2d, g0, by + 2, g1 - g0, bh - 4);
    const tx = bx + 2 + Math.floor((barW - 4) * d.reelTension);
    ctx2d.fillStyle = "#e8a84a";
    floorRect(ctx2d, tx - 6, by + 1, 12, bh + 2);
    ctx2d.strokeStyle = "#0a0e14";
    ctx2d.lineWidth = 1;
    ctx2d.strokeRect(tx - 6, by + 1, 12, bh + 2);
    ctx2d.fillStyle = "#c8d0dc";
    ctx2d.font = font;
    ctx2d.fillText("KEEP IN GREEN", bx, by - 6);
    const progH = 8;
    const py = by + bh + 8;
    floorRect(ctx2d, bx, py, barW, progH);
    ctx2d.fillStyle = "#5eb8a8";
    floorRect(ctx2d, bx + 1, py + 1, Math.floor((barW - 2) * d.reelProgress), progH - 2);
  }

  if (d.banner) {
    const label = d.banner.length > 28 ? `${d.banner.slice(0, 26)}…` : d.banner;
    ctx2d.font = `${Math.max(8, w * 0.014)}px "Press Start 2P", monospace`;
    const tw = ctx2d.measureText(label).width;
    const bx = Math.floor((w - tw) / 2) - 14;
    const by = Math.floor(h * 0.44);
    ctx2d.fillStyle = "rgba(0, 0, 0, 0.72)";
    floorRect(ctx2d, bx, by, tw + 28, 28);
    ctx2d.strokeStyle = "#e8b050";
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(bx, by, tw + 28, 28);
    ctx2d.fillStyle = "#e8b050";
    ctx2d.textAlign = "center";
    ctx2d.fillText(label, w / 2, by + 18);
    ctx2d.textAlign = "left";
  }
}

export const seasonTints: Record<string, string> = {
  frost: "#8cb8d8",
  bloom: "#c898b8",
  ember: "#d8a868",
  void: "#9890c8",
};
