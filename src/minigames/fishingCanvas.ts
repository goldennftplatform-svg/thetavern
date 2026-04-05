import type { GamePhase } from "../game/types";

type DrawCtx = {
  phase: GamePhase;
  castPower: number;
  biteOpen: boolean;
  waitPulse: number;
  reelTension: number;
  reelProgress: number;
  seasonTint: string;
};

export function drawMoonwell(
  ctx2d: CanvasRenderingContext2D,
  d: DrawCtx,
  w: number,
  h: number,
) {
  ctx2d.clearRect(0, 0, w, h);

  const grd = ctx2d.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#1a1528");
  grd.addColorStop(0.45, "#2a2340");
  grd.addColorStop(1, "#0c3d4a");
  ctx2d.fillStyle = grd;
  ctx2d.fillRect(0, 0, w, h);

  // Stars
  ctx2d.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < 42; i++) {
    const sx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const sy = (Math.cos(i * 78.233) * 23421.424) % 1;
    const x = ((sx + 1) / 2) * w;
    const y = (((sy + 1) / 2) * h) * 0.42;
    ctx2d.fillRect(x, y, 1.2, 1.2);
  }

  // Well ring
  const cy = h * 0.58;
  ctx2d.save();
  ctx2d.strokeStyle = d.seasonTint;
  ctx2d.lineWidth = 4;
  ctx2d.beginPath();
  ctx2d.ellipse(w / 2, cy, w * 0.38, h * 0.12, 0, 0, Math.PI * 2);
  ctx2d.stroke();
  ctx2d.restore();

  // Water glow
  const rg = ctx2d.createRadialGradient(w / 2, cy, 10, w / 2, cy, w * 0.45);
  rg.addColorStop(0, "rgba(120,220,255,0.35)");
  rg.addColorStop(1, "rgba(20,40,80,0.05)");
  ctx2d.fillStyle = rg;
  ctx2d.beginPath();
  ctx2d.ellipse(w / 2, cy, w * 0.38, h * 0.11, 0, 0, Math.PI * 2);
  ctx2d.fill();

  if (d.phase === "fish_cast") {
    const barW = w * 0.72;
    const bx = (w - barW) / 2;
    const by = h * 0.78;
    ctx2d.fillStyle = "rgba(0,0,0,0.35)";
    ctx2d.fillRect(bx, by, barW, 18);
    ctx2d.fillStyle = "#c9a227";
    ctx2d.fillRect(bx, by, barW * d.castPower, 18);
    ctx2d.fillStyle = "#e8dcc8";
    ctx2d.font = "600 14px Georgia, serif";
    ctx2d.fillText("Hold to draw — release to cast", bx, by - 10);
  }

  if (d.phase === "fish_wait") {
    const pulse = 0.5 + 0.5 * Math.sin(d.waitPulse * 6);
    ctx2d.strokeStyle = `rgba(200,240,255,${0.15 + pulse * 0.25})`;
    ctx2d.lineWidth = 2;
    for (let r = 20; r < 120; r += 28) {
      ctx2d.beginPath();
      ctx2d.arc(w / 2, cy, r + pulse * 8, 0, Math.PI * 2);
      ctx2d.stroke();
    }
    ctx2d.fillStyle = "#e8dcc8";
    ctx2d.font = "600 16px Georgia, serif";
    ctx2d.fillText(d.biteOpen ? "STRIKE NOW" : "Watch the rings…", w / 2 - 80, h * 0.28);
  }

  if (d.phase === "fish_reel") {
    const barW = w * 0.8;
    const bx = (w - barW) / 2;
    const by = h * 0.72;
    ctx2d.fillStyle = "rgba(0,0,0,0.45)";
    ctx2d.fillRect(bx, by, barW, 28);
    const green0 = bx + barW * 0.38;
    const green1 = bx + barW * 0.62;
    ctx2d.fillStyle = "rgba(80,200,120,0.35)";
    ctx2d.fillRect(green0, by, green1 - green0, 28);
    const tx = bx + barW * d.reelTension;
    ctx2d.fillStyle = "#f4d58d";
    ctx2d.beginPath();
    ctx2d.arc(tx, by + 14, 12, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.fillStyle = "#e8dcc8";
    ctx2d.font = "600 14px Georgia, serif";
    ctx2d.fillText("Keep the bob in the jade band", bx, by - 10);
    ctx2d.fillStyle = "rgba(255,255,255,0.2)";
    ctx2d.fillRect(bx, by + 34, barW * d.reelProgress, 8);
  }
}

export const seasonTints: Record<string, string> = {
  frost: "#b8e8ff",
  bloom: "#ffd4f0",
  ember: "#ffb38a",
  void: "#c4b5fd",
};
