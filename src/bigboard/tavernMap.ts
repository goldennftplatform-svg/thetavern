export type MapPatron = { name: string };

const tokenColors = ["#f8d820", "#38f0a8", "#f878c8", "#78c8f8", "#f8a838", "#c4b5fd"];

function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Top-down hall: planks, tables, Moonwell, patron tokens on the rim. */
export function drawTavernMap(
  canvas: HTMLCanvasElement,
  patrons: MapPatron[],
  flashLine: string,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.clientWidth || 720;
  const h = canvas.clientHeight || 400;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 22) {
    ctx.fillStyle = y % 44 === 0 ? "#3d2818" : "#322218";
    ctx.fillRect(0, y, w, 20);
  }

  ctx.strokeStyle = "#120808";
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  const tables: [number, number][] = [
    [64, 56],
    [w - 108, 48],
    [52, h - 88],
    [w - 92, h - 96],
  ];
  for (const [tx, ty] of tables) {
    ctx.fillStyle = "#4a3020";
    ctx.fillRect(tx, ty, 44, 28);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty, 44, 28);
  }

  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = "#104868";
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.min(88, w * 0.14), Math.min(56, h * 0.13), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f8d820";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#186a90";
  ctx.fillRect(cx - 56, cy - 10, 112, 14);

  ctx.fillStyle = "#f8f0ff";
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText("MOONWELL", cx - 44, cy - 62);

  patrons.forEach((p, i) => {
    const hh = hashName(p.name);
    const angle = ((hh % 628) / 100) * 0.85 + i * 0.55;
    const rx = Math.min(130, w * 0.2);
    const ry = Math.min(88, h * 0.2);
    const px = cx + Math.cos(angle) * rx - 10;
    const py = cy + Math.sin(angle) * ry - 10;
    ctx.fillStyle = tokenColors[hh % tokenColors.length]!;
    ctx.fillRect(px, py, 20, 20);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, 20, 20);
    ctx.fillStyle = "#12081a";
    ctx.font = '8px "Press Start 2P", monospace';
    const ini = (p.name.trim()[0] ?? "?").toUpperCase();
    ctx.fillText(ini, px + 4, py + 14);
  });

  if (flashLine) {
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(8, h - 56, w - 16, 46);
    ctx.fillStyle = "#f8d820";
    ctx.font = '8px "Press Start 2P", monospace';
    const t = flashLine.length > 72 ? `${flashLine.slice(0, 70)}…` : flashLine;
    ctx.fillText(t, 14, h - 32);
  }
}

export function resizeMapCanvas(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const lw = rect.width || 720;
  const lh = Math.min(480, Math.max(280, rect.width * 0.55));
  canvas.style.height = `${lh}px`;
  canvas.width = Math.floor(lw * dpr);
  canvas.height = Math.floor(lh * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
