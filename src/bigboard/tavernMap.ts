import { drawCatchBurst, drawSplashFx, drawTableFish, type SplashFx, type TableFish } from "./tableFish";
import { drawChanceCorner, type ChanceCardSnap } from "./chanceTable";
import { houseAvatarById, isHouseAvatarId } from "../content/houseAvatars";

export type FishingPhase = "idle" | "fish_cast" | "fish_wait" | "fish_reel";
export type ChancePhase = "idle" | "chance_pick" | "chance_play" | "chance_result";

export type MapPatron = {
  name: string;
  title?: string;
  catalogSize?: number;
  tokens?: number;
  avatarId?: string;
  pulseUntil?: number;
  fishing?: {
    phase: FishingPhase;
    castPower?: number;
    biteOpen?: boolean;
    reelProgress?: number;
    updatedAt: number;
  };
  chance?: {
    phase: ChancePhase;
    game?: "high_low" | "red_black";
    cards?: ChanceCardSnap[];
    target?: number;
    outcome?: "win" | "lose" | "push";
    stake?: number;
    tokens?: number;
    updatedAt: number;
  };
};

export type SeatSlot = { x: number; y: number; angle: number; index: number };

export type MapFx = {
  tableFish: TableFish[];
  splashes: SplashFx[];
  catchBurstUntil: number;
  chanceFlashUntil: number;
};

export type MapDrawTheme = {
  crest?: HTMLImageElement | null;
  charterNight?: string;
};

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

export function computeSeatRing(
  w: number,
  h: number,
  count = 20,
  table?: { cx: number; cy: number; tw: number; th: number },
): SeatSlot[] {
  const cx = table?.cx ?? w / 2;
  const cy = table?.cy ?? h / 2 + 4;
  const rx = table ? Math.min(table.tw * 0.44, 240) : Math.min(w * 0.38, 280);
  const ry = table ? Math.min(table.th * 0.4, 130) : Math.min(h * 0.32, 160);
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

function drawPlankFloor(ctx: CanvasRenderingContext2D, w: number, h: number, tick: number) {
  for (let y = 0; y < h; y += 24) {
    ctx.fillStyle = y % 48 === 0 ? "#3d2818" : "#2e2014";
    ctx.fillRect(0, y, w, 22);
  }
  drawKnightWallLore(ctx, w, h, tick);
  ctx.strokeStyle = "#120808";
  ctx.lineWidth = 12;
  ctx.strokeRect(4, 4, w - 8, h - 8);
}

function drawKnightWallLore(ctx: CanvasRenderingContext2D, w: number, h: number, tick: number) {
  drawCornerPillar(ctx, 0, 0, h, tick, true);
  drawCornerPillar(ctx, w - 44, 0, h, tick, false);

  const banners = [
    { x: 56, y: 18, c: "#483058", label: "SARGAANO" },
    { x: w - 104, y: 18, c: "#304858", label: "CORSUS" },
    { x: 56, y: h - 82, c: "#584838", label: "VEIL" },
    { x: w - 104, y: h - 82, c: "#385848", label: "CODEX" },
  ];
  for (const b of banners) {
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x, b.y, 48, 64);
    ctx.strokeStyle = "#e8b050";
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, 48, 64);
    ctx.fillStyle = "#e8b050";
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillText("⚔", b.x + 16, b.y + 28);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText(b.label, b.x + 24, b.y + 52);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "rgba(232, 176, 80, 0.22)";
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillText("⚔ CHARTER HALL ⚔", w / 2, 12);
  ctx.textAlign = "left";
}

function drawCornerPillar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  tick: number,
  left: boolean,
) {
  const pw = 44;
  const ph = Math.min(h * 0.55, 220);
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(x, y + 28, pw, ph);
  ctx.fillStyle = "#3d2818";
  ctx.fillRect(x + 4, y + 32, pw - 8, ph - 8);
  ctx.strokeStyle = "#e8b050";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y + 28, pw, ph);

  const flicker = 0.65 + Math.sin(tick * 0.08 + (left ? 0 : 2)) * 0.25;
  const tx = x + (left ? pw - 10 : 10);
  ctx.fillStyle = `rgba(232, 140, 60, ${flicker})`;
  ctx.beginPath();
  ctx.arc(tx, y + 22, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 220, 140, ${flicker * 0.8})`;
  ctx.beginPath();
  ctx.arc(tx, y + 22, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCharterSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, crest?: HTMLImageElement | null) {
  if (crest) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(crest, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = "#e8b050";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = "rgba(72, 48, 88, 0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e8b050";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#e8b050";
  ctx.font = `${Math.max(10, r * 0.9)}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("D", cx, cy + r * 0.28);
  ctx.textAlign = "left";
}

function drawGiantTable(
  ctx: CanvasRenderingContext2D,
  w: number,
  ph: number,
  tick: number,
  theme?: MapDrawTheme,
) {
  const padX = 76;
  const padTop = 10;
  const tw = Math.max(200, w - padX * 2);
  const th = Math.min(ph * 0.54, ph - padTop - 16);
  const tx = (w - tw) / 2;
  const ty = padTop + 4;
  const cx = w / 2;
  const cy = ty + th / 2;

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

  ctx.strokeStyle = "#e8b050";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, mrx, mry, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#3a6878";
  const wave = Math.sin(tick * 0.06) * 4;
  ctx.fillRect(cx - mrx + 8, cy - 6 + wave, (mrx - 8) * 2, 10);

  drawCharterSeal(ctx, cx, cy, Math.min(mrx * 0.42, 36), theme?.crest);

  ctx.fillStyle = "#f8f0ff";
  ctx.font = `${Math.max(8, w * 0.012)}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("MOONWELL", cx, cy - mry - 14);
  ctx.fillStyle = "rgba(232, 176, 80, 0.55)";
  ctx.font = `${Math.max(5, w * 0.007)}px "Press Start 2P", monospace`;
  ctx.fillText("⚔ CHARTER TABLE", cx, cy - mry - 4);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(248, 216, 32, 0.12)";
  ctx.font = `${Math.max(6, w * 0.008)}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("THE GREAT TABLE", cx, ty + th - 10);
  ctx.textAlign = "left";

  return { cx, cy, mrx, mry, tx, ty, tw, th };
}

function patronAtChance(p: MapPatron): boolean {
  return !!p.chance && p.chance.phase !== "idle";
}

function chanceSeat(index: number, table: { tx: number; ty: number }): { x: number; y: number; angle: number } {
  const baseX = table.tx + 14;
  const baseY = table.ty + 54;
  return {
    x: baseX + (index % 3) * 36,
    y: baseY + Math.floor(index / 3) * 30,
    angle: -Math.PI / 4,
  };
}

function seatForPatron(
  p: MapPatron,
  seats: SeatSlot[],
  chanceIndex: number,
  table: { tx: number; ty: number },
): SeatSlot {
  if (patronAtChance(p)) {
    const c = chanceSeat(chanceIndex, table);
    return { ...c, index: -1 };
  }
  return seats[hashName(p.name) % seats.length]!;
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

function drawSideTables(
  ctx: CanvasRenderingContext2D,
  w: number,
  _ph: number,
  table: { tx: number; ty: number; tw: number; th: number },
) {
  const zones: Array<{ x: number; y: number; label: string; sub?: string; color: string; hot?: boolean }> = [
    { x: w - 70, y: table.ty + 8, label: "WARRIOR", sub: "TRIALS", color: "#9890c8" },
    { x: 10, y: table.ty + table.th - 44, label: "BAR", sub: "CHARTER", color: "#c89898" },
    { x: w - 70, y: table.ty + table.th - 44, label: "CODEX", sub: "DEMPLAR", color: "#8cb8d8" },
  ];
  for (const z of zones) {
    if (z.hot) {
      ctx.fillStyle = "rgba(232, 176, 80, 0.14)";
      ctx.fillRect(z.x - 4, z.y - 4, 68, 48);
    }
    ctx.fillStyle = "#4a3020";
    ctx.fillRect(z.x, z.y, 60, 40);
    ctx.strokeStyle = z.hot ? "#e8b050" : "#e8b050";
    ctx.lineWidth = z.hot ? 3 : 2;
    ctx.strokeRect(z.x, z.y, 60, 40);
    ctx.fillStyle = z.color;
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText(z.label, z.x + 5, z.y + 16);
    if (z.sub) {
      ctx.fillStyle = "rgba(248, 240, 255, 0.55)";
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText(z.sub, z.x + 5, z.y + 30);
    }
  }
}

function drawFishingLine(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  wx: number,
  wy: number,
  patron: MapPatron,
  tick: number,
) {
  const f = patron.fishing;
  if (!f || f.phase === "idle") return;

  const lean = f.phase === "fish_cast" ? (f.castPower ?? 0) * 0.12 : f.phase === "fish_reel" ? 0.08 : 0.04;
  const tx = sx + (wx - sx) * lean;
  const ty = sy + (wy - sy) * lean;

  ctx.strokeStyle = f.biteOpen ? "#e87850" : f.phase === "fish_reel" ? "#e8b050" : "#88b8a8";
  ctx.lineWidth = f.biteOpen ? 3 : 2;
  ctx.setLineDash(f.phase === "fish_wait" ? [4, 4] : []);
  ctx.beginPath();
  ctx.moveTo(tx, ty - 8);
  const sag = Math.sin(tick * 0.08 + hashName(patron.name)) * (f.phase === "fish_reel" ? 10 : 4);
  ctx.quadraticCurveTo((tx + wx) / 2, (ty + wy) / 2 + sag, wx, wy);
  ctx.stroke();
  ctx.setLineDash([]);

  if (f.phase === "fish_cast" && (f.castPower ?? 0) > 0.15) {
    const p = f.castPower ?? 0;
    ctx.fillStyle = `rgba(232, 176, 80, ${0.25 + p * 0.45})`;
    ctx.beginPath();
    ctx.arc(wx, wy, 6 + p * 14, 0, Math.PI * 2);
    ctx.fill();
  }

  if (f.biteOpen) {
    const pulse = 0.6 + Math.sin(tick * 0.35) * 0.4;
    ctx.strokeStyle = `rgba(232, 120, 80, ${pulse})`;
    ctx.lineWidth = 2;
    for (let r = 10; r < 36; r += 10) {
      ctx.beginPath();
      ctx.arc(wx, wy, r + Math.sin(tick * 0.2 + r) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (f.phase === "fish_reel") {
    const prog = f.reelProgress ?? 0;
    ctx.fillStyle = "#3a7868";
    ctx.fillRect(wx - 22, wy + 12, 44 * prog, 5);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(wx - 22, wy + 12, 44, 5);
  }
}

function drawPatronToken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  patron: MapPatron,
  tick: number,
  pulse: boolean,
) {
  const name = patron.name;
  const fishing = patron.fishing;
  const chance = patron.chance;
  const fishingActive = fishing && fishing.phase !== "idle";
  const chanceActive = chance && chance.phase !== "idle";
  const active = fishingActive || chanceActive;
  const bob = Math.sin(tick * 0.05 + hashName(name) * 0.01) * (active ? 5 : 3);
  const px = x - 14;
  const py = y - 14 + bob;
  const hue = hueForName(name);

  if (pulse) {
    ctx.fillStyle = "rgba(248, 216, 32, 0.35)";
    ctx.beginPath();
    ctx.arc(x, y + bob, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fishing?.biteOpen) {
    ctx.fillStyle = "rgba(232, 120, 80, 0.35)";
    ctx.beginPath();
    ctx.arc(x, y + bob, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  if (chanceActive && chance!.phase === "chance_play") {
    ctx.fillStyle = "rgba(232, 176, 80, 0.28)";
    ctx.beginPath();
    ctx.arc(x, y + bob, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = `hsl(${hue} 42% 48%)`;
  if (patron.avatarId && isHouseAvatarId(patron.avatarId)) {
    const face = houseAvatarById(patron.avatarId);
    ctx.fillStyle = face.ink;
  }
  ctx.fillRect(px, py, 28, 28);
  ctx.strokeStyle = chanceActive ? "#e8b050" : active ? "#e8b050" : "#000";
  ctx.lineWidth = 3;
  ctx.strokeRect(px, py, 28, 28);

  if (chanceActive) {
    const stakeBit =
      typeof chance!.stake === "number" && chance!.stake > 0 ? `◎${chance!.stake}` : null;
    const badge =
      chance!.phase === "chance_pick"
        ? "PICK"
        : stakeBit
          ? stakeBit
          : chance!.game === "red_black"
            ? "R/B"
            : "HI-LO";
    ctx.fillStyle = chance!.outcome === "win" ? "#68e8a8" : "#e8b050";
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText(badge, x, py - 4);
    ctx.textAlign = "left";
  } else if (fishingActive) {
    const badge =
      fishing!.phase === "fish_cast" ? "CAST" : fishing!.phase === "fish_wait" ? "WAIT" : "REEL";
    ctx.fillStyle = "#e8b050";
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText(badge, x, py - 4);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#f8f0ff";
  ctx.font = '11px "VT323", monospace';
  const mark =
    patron.avatarId && isHouseAvatarId(patron.avatarId)
      ? houseAvatarById(patron.avatarId).glyph
      : (name.trim()[0] ?? "?").toUpperCase();
  ctx.textAlign = "center";
  ctx.fillText(mark, x, py + 18);
  ctx.textAlign = "left";

  ctx.fillStyle = "#f8f0ff";
  ctx.font = '6px "Press Start 2P", monospace';
  const short = name.length > 9 ? `${name.slice(0, 7)}…` : name;
  ctx.textAlign = "center";
  ctx.fillText(short, x, py - 6);

  const title = patron.title?.trim();
  if (title) {
    ctx.fillStyle = "rgba(232, 196, 120, 0.92)";
    ctx.font = '5px "Press Start 2P", monospace';
    const titleShort = title.length > 12 ? `${title.slice(0, 10)}…` : title;
    ctx.fillText(titleShort, x, py + 38);
  } else if (typeof patron.catalogSize === "number" && patron.catalogSize > 0) {
    ctx.fillStyle = "rgba(184, 216, 200, 0.85)";
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText(`${patron.catalogSize} codex`, x, py + 38);
  }
  ctx.textAlign = "left";
}

export function drawTavernMap(
  canvas: HTMLCanvasElement,
  patrons: MapPatron[],
  flashLine: string,
  tick = 0,
  fx: MapFx = { tableFish: [], splashes: [], catchBurstUntil: 0, chanceFlashUntil: 0 },
  whisperLine = "",
  theme?: MapDrawTheme,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr =
    canvas.width > 0 && rect.width > 0
      ? canvas.width / rect.width
      : Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(320, rect.width || canvas.width / dpr || 960);
  const h = Math.max(200, rect.height || canvas.height / dpr || 520);
  const ph = h;
  const now = performance.now();
  ctx.imageSmoothingEnabled = false;

  const sorted = [...patrons].sort((a, b) => hashName(a.name) - hashName(b.name));
  const chancePatrons = sorted.filter(patronAtChance);
  const chanceSessions = chancePatrons
    .filter((p) => p.chance && p.chance.phase !== "idle")
    .map((p) => ({
      from: p.name,
      game: p.chance!.game,
      phase: p.chance!.phase as "chance_pick" | "chance_play" | "chance_result",
      cards: p.chance!.cards,
      target: p.chance!.target,
      outcome: p.chance!.outcome,
      stake: p.chance!.stake,
      tokens: p.chance!.tokens,
      updatedAt: p.chance!.updatedAt,
    }));

  drawPlankFloor(ctx, w, ph, tick);
  const table = drawGiantTable(ctx, w, ph, tick, theme);
  drawSideTables(ctx, w, ph, table);

  drawChanceCorner(ctx, 10, table.ty + 8, chanceSessions, tick, fx.chanceFlashUntil, now);
  drawCatchBurst(ctx, table.cx, table.cy, tick, fx.catchBurstUntil, now);
  drawSplashFx(ctx, fx.splashes, now);
  drawTableFish(ctx, table.cx, table.cy, fx.tableFish, tick, now);

  const seats = computeSeatRing(w, ph, 20, table);

  for (const seat of seats) {
    drawChair(ctx, seat.x, seat.y, seat.angle);
  }

  let chanceIdx = 0;
  for (const p of sorted) {
    if (patronAtChance(p)) continue;
    const seat = seatForPatron(p, seats, 0, table);
    drawFishingLine(ctx, seat.x, seat.y, table.cx, table.cy, p, tick);
  }

  chanceIdx = 0;
  sorted.forEach((p) => {
    const atChance = patronAtChance(p);
    const seat = seatForPatron(p, seats, atChance ? chanceIdx++ : 0, table);
    const pulse = (p.pulseUntil ?? 0) > now;
    drawPatronToken(ctx, seat.x, seat.y, p, tick, pulse);
  });

  const activeFishers = sorted.filter((p) => p.fishing && p.fishing.phase !== "idle").length;
  const activeGamblers = chancePatrons.length;
  if (activeFishers > 0 || activeGamblers > 0) {
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "right";
    const headerY = 14;
    if (activeFishers > 0 && activeGamblers > 0) {
      ctx.fillStyle = "rgba(104, 184, 168, 0.9)";
      ctx.fillText(`${activeFishers} ANGLING`, w - 10, headerY);
      ctx.fillStyle = "rgba(232, 176, 80, 0.95)";
      ctx.fillText(`${activeGamblers} AT CHANCE`, w - 10, headerY + 12);
    } else if (activeFishers > 0) {
      ctx.fillStyle = "rgba(104, 184, 168, 0.9)";
      ctx.fillText(`${activeFishers} ANGLING`, w - 10, headerY);
    } else {
      ctx.fillStyle = "rgba(232, 176, 80, 0.95)";
      ctx.fillText(`${activeGamblers} AT CHANCE`, w - 10, headerY);
    }
    ctx.textAlign = "left";
  }
}

export function resizeMapCanvas(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const parent = canvas.parentElement?.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const lw = Math.max(320, rect.width || parent?.width || 960);
  const lh = Math.max(260, rect.height || parent?.height || 486);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.width = Math.floor(lw * dpr);
  canvas.height = Math.floor(lh * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
