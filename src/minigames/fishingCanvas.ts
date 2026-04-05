import type { GamePhase } from "../game/types";
import type { LoadedMediaTheme } from "../media/types";

type DrawCtx = {
  phase: GamePhase;
  castPower: number;
  biteOpen: boolean;
  waitPulse: number;
  reelTension: number;
  reelProgress: number;
  seasonTint: string;
};

function floorRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  const ir = iw / ih;
  const rr = dw / dh;
  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;
  if (ir > rr) {
    sh = ih;
    sw = sh * rr;
    sx = (iw - sw) / 2;
    sy = 0;
  } else {
    sw = iw;
    sh = sw / rr;
    sx = 0;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, Math.floor(dx), Math.floor(dy), Math.ceil(dw), Math.ceil(dh));
}

function drawProceduralSky(ctx2d: CanvasRenderingContext2D, w: number, h: number) {
  const bands = ["#1a0a2e", "#241038", "#2e1848", "#382060", "#301850"];
  const bh = h / bands.length;
  for (let i = 0; i < bands.length; i++) {
    ctx2d.fillStyle = bands[i]!;
    floorRect(ctx2d, 0, i * bh, w, bh + 1);
  }
}

function drawStars(ctx2d: CanvasRenderingContext2D, w: number, h: number) {
  ctx2d.fillStyle = "#e8e8ff";
  for (let i = 0; i < 48; i++) {
    const sx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const sy = (Math.cos(i * 78.233) * 23421.424) % 1;
    const x = Math.floor(((sx + 1) / 2) * w);
    const y = Math.floor((((sy + 1) / 2) * h) * 0.4);
    floorRect(ctx2d, x, y, 2, 2);
  }
}

/** Flat bands + chunky pixels; optional daily media layers from MEdiaFiles scan. */
export function drawMoonwell(
  ctx2d: CanvasRenderingContext2D,
  d: DrawCtx,
  w: number,
  h: number,
  theme: LoadedMediaTheme | null = null,
) {
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.clearRect(0, 0, w, h);

  const sky = theme?.images.sky;
  if (sky) {
    drawCover(ctx2d, sky, 0, 0, w, h * 0.62);
    ctx2d.save();
    ctx2d.globalAlpha = 0.4;
    ctx2d.fillStyle = "#1a0a2e";
    floorRect(ctx2d, 0, 0, w, h * 0.62);
    ctx2d.restore();
  } else {
    drawProceduralSky(ctx2d, w, h);
  }

  drawStars(ctx2d, w, h);

  const cy = Math.floor(h * 0.58);

  ctx2d.fillStyle = "#104868";
  ctx2d.beginPath();
  ctx2d.ellipse(w / 2, cy, w * 0.38, h * 0.11, 0, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.fillStyle = "#186a90";
  floorRect(ctx2d, w * 0.2, cy - h * 0.04, w * 0.6, Math.max(3, h * 0.025));

  ctx2d.save();
  ctx2d.strokeStyle = d.seasonTint;
  ctx2d.lineWidth = 6;
  ctx2d.lineJoin = "miter";
  ctx2d.beginPath();
  ctx2d.ellipse(w / 2, cy, w * 0.38, h * 0.12, 0, 0, Math.PI * 2);
  ctx2d.stroke();
  ctx2d.strokeStyle = "#000";
  ctx2d.lineWidth = 2;
  ctx2d.stroke();
  ctx2d.restore();

  const deck = theme?.images.deck;
  if (deck) {
    ctx2d.save();
    drawCover(ctx2d, deck, 0, h * 0.66, w, h * 0.36);
    ctx2d.restore();
    ctx2d.save();
    ctx2d.globalAlpha = 0.25;
    ctx2d.fillStyle = "#000";
    floorRect(ctx2d, 0, h * 0.66, w, h * 0.36);
    ctx2d.restore();
  }

  const banner = theme?.images.banner;
  if (banner) {
    const bh = h * 0.22;
    floorRect(ctx2d, 4, 4, w - 8, bh);
    ctx2d.fillStyle = "#000";
    floorRect(ctx2d, 8, 8, w - 16, bh - 8);
    drawCover(ctx2d, banner, 10, 10, w - 20, bh - 12);
    ctx2d.strokeStyle = "#f8d820";
    ctx2d.lineWidth = 3;
    ctx2d.strokeRect(6, 6, w - 12, bh - 2);
    ctx2d.strokeStyle = "#000";
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(4, 4, w - 8, bh + 2);
  }

  const crest = theme?.images.crest;
  if (crest) {
    const cs = Math.min(w * 0.2, h * 0.18, 72);
    const topPad = banner ? h * 0.22 + 8 : 10;
    const cx = w - cs - 10;
    const cyy = topPad;
    floorRect(ctx2d, cx - 4, cyy - 4, cs + 8, cs + 8);
    ctx2d.fillStyle = "#000";
    floorRect(ctx2d, cx - 2, cyy - 2, cs + 4, cs + 4);
    drawCover(ctx2d, crest, cx, cyy, cs, cs);
    ctx2d.strokeStyle = "#f8d820";
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(cx - 4, cyy - 4, cs + 8, cs + 8);
  }

  const font = '10px "Press Start 2P", monospace';

  if (d.phase === "fish_cast") {
    const barW = Math.floor(w * 0.72);
    const bx = Math.floor((w - barW) / 2);
    const by = Math.floor(h * 0.76);
    const bh = 20;
    floorRect(ctx2d, bx, by, barW, bh);
    ctx2d.fillStyle = "#000";
    floorRect(ctx2d, bx + 4, by + 4, barW - 8, bh - 8);
    const fillW = Math.floor((barW - 8) * d.castPower);
    ctx2d.fillStyle = "#f8d820";
    floorRect(ctx2d, bx + 4, by + 4, fillW, bh - 8);
    ctx2d.fillStyle = "#f8f0ff";
    ctx2d.font = font;
    ctx2d.fillText("HOLD / RELEASE", bx, by - 8);
  }

  if (d.phase === "fish_wait") {
    const pulse = 0.5 + 0.5 * Math.sin(d.waitPulse * 6);
    ctx2d.strokeStyle = d.seasonTint;
    ctx2d.lineWidth = 3;
    for (let r = 16; r < Math.min(w, h) * 0.35; r += 24) {
      ctx2d.beginPath();
      ctx2d.arc(w / 2, cy, r + pulse * 10, 0, Math.PI * 2);
      ctx2d.stroke();
    }
    ctx2d.fillStyle = d.biteOpen ? "#f85838" : "#f8f0ff";
    ctx2d.font = font;
    const msg = d.biteOpen ? "STRIKE!!" : "WAIT...";
    const tw = ctx2d.measureText(msg).width;
    ctx2d.fillText(msg, (w - tw) / 2, h * 0.26);
  }

  if (d.phase === "fish_reel") {
    const barW = Math.floor(w * 0.82);
    const bx = Math.floor((w - barW) / 2);
    const by = Math.floor(h * 0.7);
    const bh = 32;
    floorRect(ctx2d, bx, by, barW, bh);
    ctx2d.fillStyle = "#000";
    floorRect(ctx2d, bx + 4, by + 4, barW - 8, bh - 8);
    const g0 = bx + 4 + Math.floor((barW - 8) * 0.36);
    const g1 = bx + 4 + Math.floor((barW - 8) * 0.64);
    ctx2d.fillStyle = "#109060";
    floorRect(ctx2d, g0, by + 4, g1 - g0, bh - 8);
    const tx = bx + 4 + Math.floor((barW - 8) * d.reelTension);
    ctx2d.fillStyle = "#f8d820";
    floorRect(ctx2d, tx - 8, by + 2, 16, bh + 4);
    ctx2d.strokeStyle = "#000";
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(tx - 8, by + 2, 16, bh + 4);
    ctx2d.fillStyle = "#f8f0ff";
    ctx2d.font = font;
    ctx2d.fillText("JADE ZONE", bx, by - 8);
    const progH = 10;
    const py = by + bh + 10;
    floorRect(ctx2d, bx, py, barW, progH);
    ctx2d.fillStyle = "#38f0a8";
    floorRect(ctx2d, bx + 2, py + 2, Math.floor((barW - 4) * d.reelProgress), progH - 4);
  }
}

export const seasonTints: Record<string, string> = {
  frost: "#78c8f8",
  bloom: "#f878c8",
  ember: "#f8a838",
  void: "#b088f8",
};
