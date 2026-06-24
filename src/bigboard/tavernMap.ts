export type MapPatron = { name: string; pulseUntil?: number };

export type SeatSlot = { x: number; y: number; angle: number; index: number };

function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function hueForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Seat ring around the giant table — used for canvas + DOM overlay. */
export function computeSeatRing(w: number, h: number, count = 20): SeatSlot[] {
  const cx = w / 2;
  const cy = h / 2 + 4;
  const rx = Math.min(w * 0.38, 280);
  const ry = Math.min(h * 0.32, 160);
  const seats: SeatSlot[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    seats.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
      angle,
      index: i,
    });
  }
  return seats;
}

function drawPlankFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  for (let y = 0; y < h; y += 24) {
    ctx.fillStyle = y % 48 === 0 ? "#3d2818" : "#2e2014";
    ctx.fillRect(0, y, w, 22);
  }
  ctx.strokeStyle = "#120808";
  ctx.lineWidth = 12;
  ctx.strokeRect(4, 4, w - 8, h - 8);
}

function drawGiantTable(ctx: CanvasRenderingContext2D, w: number, h: number, tick: number) {
  const cx = w / 2;
  const cy = h / 2 + 4;
  const tw = Math.min(w * 0.78, w - 48);
  const th = Math.min(h * 0.58, h - 72);
  const tx = cx - tw / 2;
  const ty = cy - th / 2;

  ctx.fillStyle = "#1a0c08";
  ctx.fillRect(tx - 8, ty - 8, tw + 16, th + 16);

  const grad = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
  grad.addColorStop(0, "#6b4428");
  grad.addColorStop(0.5, "#5a3820");
  grad.addColorStop(1, "#4a3020");
  ctx.fillStyle = grad;
  ctx.fillRect(tx, ty, tw, th);

  for (let i = 0; i < 7; i++) {
    const ly = ty + 18 + i * ((th - 36) / 6);
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx + 12, ly);
    ctx.lineTo(tx + tw - 12, ly);
    ctx.stroke();
  }

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;
  ctx.strokeRect(tx, ty, tw, th);

  ctx.fillStyle = "#2a1810";
  ctx.fillRect(tx + 8, ty + 8, tw - 16, th - 16);
  ctx.strokeStyle = "#3d2818";
  ctx.lineWidth = 2;
  ctx.strokeRect(tx + 8, ty + 8, tw - 16, th - 16);

  const mrx = Math.min(tw * 0.22, 100);
  const mry = Math.min(th * 0.2, 64);
  ctx.fillStyle = "#0a3048";
  ctx.beginPath();
  ctx.ellipse(cx, cy, mrx, mry, 0, 0, Math.PI * 2);
  ctx.fill();

  const shimmer = 0.55 + Math.sin(tick * 0.04) * 0.12;
  ctx.fillStyle = `rgba(24, 106, 144, ${shimmer})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, mrx - 6, mry - 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#f8d820";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, mrx, mry, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#186a90";
  const wave = Math.sin(tick * 0.06) * 4;
  ctx.fillRect(cx - mrx + 8, cy - 6 + wave, (mrx - 8) * 2, 10);

  ctx.fillStyle = "#f8f0ff";
  ctx.font = `${Math.max(8, w * 0.012)}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("MOONWELL", cx, cy - mry - 14);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(248, 216, 32, 0.08)";
  ctx.font = `${Math.max(7, w * 0.01)}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("THE GREAT TABLE", cx, ty + th + 28);
  ctx.textAlign = "left";

  return { tx, ty, tw, th, cx, cy };
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = "#3d2818";
  ctx.fillRect(-10, -6, 20, 12);
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(-8, 4, 16, 8);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.strokeRect(-10, -6, 20, 12);
  ctx.restore();
}

function drawSideTables(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const zones: Array<{ x: number; y: number; label: string; color: string }> = [
    { x: 24, y: 24, label: "CHANCE", color: "#f8d820" },
    { x: w - 108, y: 24, label: "KITCHEN", color: "#38f0a8" },
    { x: 24, y: h - 52, label: "BAR", color: "#f878c8" },
    { x: w - 100, y: h - 52, label: "HERALD", color: "#78c8f8" },
  ];
  for (const z of zones) {
    ctx.fillStyle = "#4a3020";
    ctx.fillRect(z.x, z.y, 52, 32);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(z.x, z.y, 52, 32);
    ctx.fillStyle = z.color;
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText(z.label, z.x + 4, z.y + 20);
  }
}

function drawPatronToken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  tick: number,
  pulse: boolean,
) {
  const bob = Math.sin(tick * 0.05 + hashName(name) * 0.01) * 3;
  const px = x - 14;
  const py = y - 14 + bob;
  const hue = hueForName(name);

  if (pulse) {
    ctx.fillStyle = "rgba(248, 216, 32, 0.35)";
    ctx.beginPath();
    ctx.arc(x, y + bob, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = `hsl(${hue} 68% 52%)`;
  ctx.fillRect(px, py, 28, 28);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.strokeRect(px, py, 28, 28);

  ctx.fillStyle = "#12081a";
  ctx.font = '10px "Press Start 2P", monospace';
  const ini = (name.trim()[0] ?? "?").toUpperCase();
  ctx.textAlign = "center";
  ctx.fillText(ini, x, py + 18);
  ctx.textAlign = "left";

  ctx.fillStyle = "#f8f0ff";
  ctx.font = '7px "Press Start 2P", monospace';
  const short = name.length > 12 ? `${name.slice(0, 10)}…` : name;
  ctx.textAlign = "center";
  ctx.fillText(short, x, py + 38);
  ctx.textAlign = "left";
}

/** Top-down hall: giant communal table, Moonwell in the center, patrons seated around. */
export function drawTavernMap(
  canvas: HTMLCanvasElement,
  patrons: MapPatron[],
  flashLine: string,
  tick = 0,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.clientWidth || 960;
  const h = canvas.clientHeight || 520;
  ctx.imageSmoothingEnabled = false;

  drawPlankFloor(ctx, w, h);
  drawSideTables(ctx, w, h);
  drawGiantTable(ctx, w, h, tick);

  const seats = computeSeatRing(w, h);
  const now = performance.now();

  for (const seat of seats) {
    drawChair(ctx, seat.x, seat.y, seat.angle);
  }

  const sorted = [...patrons].sort((a, b) => hashName(a.name) - hashName(b.name));
  sorted.forEach((p) => {
    const seat = seats[hashName(p.name) % seats.length]!;
    const pulse = (p.pulseUntil ?? 0) > now;
    drawPatronToken(ctx, seat.x, seat.y, p.name, tick, pulse);
  });

  if (sorted.length === 0) {
    ctx.fillStyle = "rgba(248, 240, 255, 0.55)";
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("Pull up a chair — open the game & bind thy name", w / 2, h - 18);
    ctx.textAlign = "left";
  }

  if (flashLine) {
    const pulse = 0.85 + Math.sin(tick * 0.12) * 0.15;
    ctx.fillStyle = `rgba(0,0,0,${0.82 * pulse})`;
    ctx.fillRect(12, h - 64, w - 24, 52);
    ctx.strokeStyle = "#f8d820";
    ctx.lineWidth = 3;
    ctx.strokeRect(12, h - 64, w - 24, 52);
    ctx.fillStyle = "#f8d820";
    ctx.font = `${Math.max(7, w * 0.009)}px "Press Start 2P", monospace`;
    const t = flashLine.length > 88 ? `${flashLine.slice(0, 86)}…` : flashLine;
    ctx.textAlign = "center";
    ctx.fillText(t, w / 2, h - 32);
    ctx.textAlign = "left";
  }
}

export function resizeMapCanvas(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const lw = rect.width || 960;
  const lh = Math.min(560, Math.max(320, rect.width * 0.52));
  canvas.style.height = `${lh}px`;
  canvas.width = Math.floor(lw * dpr);
  canvas.height = Math.floor(lh * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
