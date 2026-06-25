import type { FishRarity } from "../content/lore";

export type TableFish = {
  id: string;
  name: string;
  rarity: FishRarity | string;
  from: string;
  landedAt: number;
};

export type SplashFx = {
  x: number;
  y: number;
  startedAt: number;
  rarity: string;
};

const RARITY_COLOR: Record<string, string> = {
  common: "#a8b0b8",
  uncommon: "#8ec8a0",
  rare: "#98b8e8",
  omen: "#c898d8",
  mythic: "#e8b050",
};

export function rarityColor(rarity: string): string {
  return RARITY_COLOR[rarity] ?? "#a8b0b8";
}

function fishScale(landedAt: number, now: number): number {
  const age = now - landedAt;
  if (age < 420) return age / 420;
  return 1 + Math.sin((age - 420) / 380) * 0.06;
}

export function drawTableFish(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  fishes: TableFish[],
  tick: number,
  now: number,
): void {
  if (fishes.length === 0) return;

  const live = fishes.filter((f) => now - f.landedAt < 55_000);
  live.forEach((f, i) => {
    const n = live.length;
    const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2 + Math.sin(tick * 0.02 + i) * 0.08;
    const ring = 28 + (i % 3) * 14;
    const fx = cx + Math.cos(angle) * ring;
    const fy = cy + Math.sin(angle) * (ring * 0.55);
    const sc = fishScale(f.landedAt, now) * (f.rarity === "mythic" ? 1.15 : 1);
    const col = rarityColor(f.rarity);

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(angle + Math.PI / 2);
    ctx.scale(sc, sc);

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-20, -5);
    ctx.lineTo(-20, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0c1018";
    ctx.beginPath();
    ctx.arc(6, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f8f0ff";
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    const label = f.name.length > 10 ? `${f.name.slice(0, 8)}…` : f.name;
    ctx.fillText(label, 0, -14);
    ctx.textAlign = "left";
    ctx.restore();
  });
}

export function drawSplashFx(ctx: CanvasRenderingContext2D, splashes: SplashFx[], now: number): void {
  for (const s of splashes) {
    const age = now - s.startedAt;
    if (age > 1400) continue;
    const t = age / 1400;
    const r = 8 + t * 48;
    const alpha = (1 - t) * 0.55;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = rarityColor(s.rarity);
    ctx.lineWidth = 3 - t * 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawCatchBurst(ctx: CanvasRenderingContext2D, cx: number, cy: number, tick: number, until: number, now: number): void {
  if (now > until) return;
  const pulse = 0.5 + Math.sin(tick * 0.2) * 0.5;
  ctx.fillStyle = `rgba(232, 176, 80, ${0.12 * pulse})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 36 + pulse * 12, 0, Math.PI * 2);
  ctx.fill();
}
