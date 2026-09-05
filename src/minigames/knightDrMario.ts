/**
 * Veil Cure: the second puzzle in the combo.
 * Shorter burst trial: fewer viruses, clearer capsules, match flash.
 */

export type PillColor = "R" | "B" | "Y";

const COLS = 8;
const ROWS = 16;
const VIRUS_COUNT = 4;
const MAX_MATCH_CHAINS = 6;
const COLORS: PillColor[] = ["R", "B", "Y"];
const PALETTE: Record<PillColor, string> = {
  R: "#e86058",
  B: "#5898e8",
  Y: "#e8b048",
};
const PALETTE_HI: Record<PillColor, string> = {
  R: "#ffb0a0",
  B: "#a8d0ff",
  Y: "#ffe090",
};

type Cell = PillColor | "vR" | "vB" | "vY" | null;

type FallingPill = {
  x: number;
  y: number;
  horiz: boolean;
  a: PillColor;
  b: PillColor;
};

function cellColor(c: Cell): PillColor | null {
  if (!c) return null;
  if (c === "vR") return "R";
  if (c === "vB") return "B";
  if (c === "vY") return "Y";
  return c;
}

function isVirus(c: Cell): boolean {
  return c === "vR" || c === "vB" || c === "vY";
}

export class KnightDrMario {
  score = 0;
  virusesLeft = 0;
  combo = 0;
  finished = false;
  private comboTimer = 0;

  private grid: Cell[][] = [];
  private bonds: number[][] = [];
  private nextBond = 0;
  private pill: FallingPill | null = null;
  private nextPill: { a: PillColor; b: PillColor; horiz: boolean } | null = null;
  private dropMs = 0;
  private gravityMs = 720;
  private flashMs = 0;
  private flashCells: Array<{ x: number; y: number; color: PillColor; virus: boolean }> = [];
  mobileEase = false;

  reset() {
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.finished = false;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null) as Cell[]);
    this.bonds = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
    this.nextBond = 0;
    this.seedViruses();
    this.pill = null;
    this.nextPill = null;
    this.dropMs = 0;
    this.flashMs = 0;
    this.flashCells = [];
    this.gravityMs = this.mobileEase ? 980 : 780;
    this.queueNext();
    this.spawnPill();
  }

  private seedViruses() {
    const slots: [number, number][] = [
      [2, 12],
      [5, 12],
      [1, 14],
      [6, 14],
    ];
    for (let i = 0; i < VIRUS_COUNT; i++) {
      const c = COLORS[i % 3]!;
      const [x, y] = slots[i]!;
      this.grid[y]![x] = c === "R" ? "vR" : c === "B" ? "vB" : "vY";
    }
    this.virusesLeft = VIRUS_COUNT;
  }

  private countViruses(): number {
    let n = 0;
    for (const row of this.grid) {
      for (const c of row) if (isVirus(c)) n += 1;
    }
    return n;
  }

  private queueNext() {
    this.nextPill = {
      a: COLORS[Math.floor(Math.random() * 3)]!,
      b: COLORS[Math.floor(Math.random() * 3)]!,
      horiz: true,
    };
  }

  private spawnPill() {
    const next = this.nextPill ?? {
      a: COLORS[Math.floor(Math.random() * 3)]!,
      b: COLORS[Math.floor(Math.random() * 3)]!,
      horiz: true,
    };
    this.queueNext();
    const pill: FallingPill = { x: 3, y: 0, horiz: next.horiz, a: next.a, b: next.b };
    if (this.pillBlocked(pill)) {
      this.pill = null;
      this.endTrialBoardFull();
      return;
    }
    this.pill = pill;
    this.dropMs = 0;
  }

  private endTrialBoardFull() {
    this.pill = null;
    this.score += Math.max(0, 100 - this.virusesLeft * 12);
    this.score = Math.max(0, this.score);
    this.finished = true;
  }

  private pillCells(p: FallingPill): [number, number, PillColor][] {
    if (p.horiz) return [[p.x, p.y, p.a], [p.x + 1, p.y, p.b]];
    return [[p.x, p.y, p.a], [p.x, p.y + 1, p.b]];
  }

  private pillBlocked(p: FallingPill, ox = 0, oy = 0, horiz = p.horiz): boolean {
    const test = { ...p, x: p.x + ox, y: p.y + oy, horiz };
    for (const [x, y] of this.pillCells(test).map(([cx, cy]) => [cx, cy])) {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && this.grid[y][x]) return true;
    }
    return false;
  }

  move(dir: -1 | 1) {
    if (!this.pill || this.finished) return;
    if (!this.pillBlocked(this.pill, dir, 0)) this.pill.x += dir;
  }

  rotate() {
    if (!this.pill || this.finished) return;
    const p = this.pill;
    const next = !p.horiz;
    if (!this.pillBlocked(p, 0, 0, next)) {
      if (!p.horiz) [p.a, p.b] = [p.b, p.a];
      p.horiz = next;
      return;
    }
    for (const kick of [-1, 1]) {
      if (!this.pillBlocked(p, kick, 0, next)) {
        p.x += kick;
        if (!p.horiz) [p.a, p.b] = [p.b, p.a];
        p.horiz = next;
        return;
      }
    }
  }

  setSoftDrop(_on: boolean) {
    /* tap-to-step */
  }

  stepDown(): void {
    if (!this.pill || this.finished) return;
    this.dropMs = 0;
    if (!this.pillBlocked(this.pill, 0, 1)) {
      this.pill.y += 1;
      this.score += 1;
    } else {
      this.lockPill();
    }
  }

  hardDrop() {
    if (!this.pill || this.finished) return;
    let dropped = 0;
    while (!this.pillBlocked(this.pill, 0, 1)) {
      this.pill.y += 1;
      dropped += 1;
    }
    this.score += dropped;
    this.lockPill();
  }

  private ghostY(): number {
    if (!this.pill) return 0;
    let drop = 0;
    while (!this.pillBlocked(this.pill, 0, drop + 1)) drop += 1;
    return this.pill.y + drop;
  }

  private lockPill() {
    const p = this.pill;
    if (!p) return;
    for (const [x, y, color] of this.pillCells(p)) {
      if (y >= 0) {
        this.grid[y]![x] = color;
        this.bonds[y]![x] = this.nextBond;
      }
    }
    this.nextBond += 1;
    this.pill = null;
    this.resolveMatches();
    if (this.virusesLeft <= 0) {
      this.score += 600;
      this.finished = true;
      return;
    }
    this.spawnPill();
  }

  private resolveMatches() {
    let chain = 0;
    for (;;) {
      if (chain >= MAX_MATCH_CHAINS) break;
      const toClear = new Set<string>();
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const c = cellColor(this.grid[y]![x]);
          if (!c) continue;
          let runH = 1;
          while (x + runH < COLS && cellColor(this.grid[y]![x + runH]) === c) runH += 1;
          if (runH >= 4) {
            for (let i = 0; i < runH; i++) toClear.add(`${x + i},${y}`);
          }
          let runV = 1;
          while (y + runV < ROWS && cellColor(this.grid[y + runV]![x]) === c) runV += 1;
          if (runV >= 4) {
            for (let i = 0; i < runV; i++) toClear.add(`${x},${y + i}`);
          }
        }
      }
      if (toClear.size === 0) break;
      chain += 1;
      this.flashCells = [];
      let viruses = 0;
      for (const key of toClear) {
        const [xs, ys] = key.split(",");
        const x = Number(xs);
        const y = Number(ys);
        const cell = this.grid[y]![x];
        const col = cellColor(cell);
        if (col) this.flashCells.push({ x, y, color: col, virus: isVirus(cell) });
        if (isVirus(cell)) viruses += 1;
        this.grid[y]![x] = null;
        this.bonds[y]![x] = -1;
      }
      this.flashMs = 180;
      this.virusesLeft = this.countViruses();
      const mult = 1 + (chain - 1) * 0.35;
      this.score += Math.floor((toClear.size * 18 + viruses * 90) * mult);
      this.combo = chain;
      this.comboTimer = 180; // combo persists for duration of flash
      this.settlePillGravity();
    }
  }

  private settlePillGravity() {
    for (let pass = 0; pass < ROWS; pass++) {
      let moved = false;
      for (let x = 0; x < COLS; x++) {
        for (let y = ROWS - 2; y >= 0; y--) {
          const c = this.grid[y]![x];
          if (!c || isVirus(c)) continue;
          const bond = this.bonds[y]![x];
          const cells: [number, number][] = [[x, y]];
          // Intact capsules fall together. Clearing one half releases the survivor.
          if (bond >= 0) {
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const nx = x + dx, ny = y + dy;
              if (this.bonds[ny]?.[nx] === bond && this.grid[ny]?.[nx]) cells.push([nx, ny]);
            }
          }
          const canFall = cells.every(([cx, cy]) => cy + 1 < ROWS &&
            (!this.grid[cy + 1]![cx] || cells.some(([px, py]) => px === cx && py === cy + 1)));
          if (!canFall) continue;
          const colors = cells.map(([cx, cy]) => this.grid[cy]![cx]);
          for (const [cx, cy] of cells) {
            this.grid[cy]![cx] = null;
            this.bonds[cy]![cx] = -1;
          }
          cells.forEach(([cx, cy], i) => {
            this.grid[cy + 1]![cx] = colors[i];
            this.bonds[cy + 1]![cx] = bond;
          });
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  private finishTrial(timeLimitMs: number, elapsed: number) {
    const timeLeft = Math.max(0, timeLimitMs - elapsed);
    this.score += Math.floor(timeLeft / 400);
    this.score += Math.max(0, 120 - this.virusesLeft * 8);
    this.score = Math.max(0, this.score);
    this.finished = true;
  }

  update(dt: number, elapsed: number, timeLimitMs: number): boolean {
    if (this.finished) return true;
    if (this.flashMs > 0) this.flashMs = Math.max(0, this.flashMs - dt);

    if (elapsed >= timeLimitMs) {
      this.finishTrial(timeLimitMs, elapsed);
      return true;
    }

    if (!this.pill) return false;

    this.dropMs += dt;
    if (this.dropMs >= this.gravityMs) {
      this.dropMs = 0;
      if (!this.pillBlocked(this.pill, 0, 1)) {
        this.pill.y += 1;
      } else {
        this.lockPill();
      }
    }
    // Combo timer slowly decays after matches stop
    if (this.comboTimer > 0) this.comboTimer = Math.max(0, this.comboTimer - dt);
    return this.finished;
  }

  hudLine(): string {
    return `♥${this.virusesLeft} · ${this.score}`;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    hudTop: number,
    footReserve = 28,
    touchPad = false,
    timeLeftSec?: number,
    timeLimitSec = 38,
  ) {
    const pad = 8;
    const timerBand = typeof timeLeftSec === "number" ? 28 : 0;
    const playH = h - hudTop - footReserve - pad * 2 - timerBand - 28;
    const cell = Math.max(1, Math.floor(Math.min((w - 56) / (COLS + 2.1), playH / ROWS)));
    const boardW = cell * COLS;
    const boardH = cell * ROWS;
    const previewW = Math.max(8, Math.floor(cell * 0.7)) * 3 + 26;
    const ox = Math.floor((w - boardW - previewW) / 2);
    const oy = hudTop + timerBand + 28 + Math.floor((playH - boardH) / 2) + pad;

    if (typeof timeLeftSec === "number") {
      const pct = Math.max(0, Math.min(1, timeLeftSec / Math.max(1, timeLimitSec)));
      const barY = hudTop + 4;
      const barW = w - 24;
      ctx.fillStyle = "#1a1420";
      ctx.fillRect(12, barY, barW, 10);
      ctx.fillStyle = timeLeftSec <= 5 ? "#e87850" : "#c878e8";
      ctx.fillRect(12, barY, barW * pct, 10);
      ctx.strokeStyle = "#e8b050";
      ctx.strokeRect(12, barY, barW, 10);
      ctx.fillStyle = timeLeftSec <= 5 ? "#ffb898" : "#f8f0ff";
      ctx.font = `${Math.max(16, Math.min(22, Math.floor(w * 0.036)))}px "VT323", monospace`;
      ctx.textAlign = "center";
      ctx.fillText(
        `${Math.ceil(Math.max(0, timeLeftSec))}s · ${this.virusesLeft} viruses left`,
        w / 2,
        barY + 24,
      );
      ctx.textAlign = "left";
    }

    // Board frame
    ctx.fillStyle = "#0c101c";
    ctx.fillRect(ox - 6, oy - 6, boardW + 12, boardH + 12);
    ctx.strokeStyle = "#c878e8";
    ctx.lineWidth = 3;
    ctx.strokeRect(ox - 6, oy - 6, boardW + 12, boardH + 12);
    ctx.strokeStyle = "rgba(232, 176, 80, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 2, oy - 2, boardW + 4, boardH + 4);

    // Soft grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * cell, oy);
      ctx.lineTo(ox + x * cell, oy + boardH);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * cell);
      ctx.lineTo(ox + boardW, oy + y * cell);
      ctx.stroke();
    }

    ctx.fillStyle = "#e8b050";
    ctx.font = `${Math.max(16, Math.min(22, Math.floor(w * 0.042)))}px "VT323", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("MATCH 4 ACROSS OR DOWN", w / 2, oy - 10);
    ctx.textAlign = "left";

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = this.grid[y]![x];
        if (!c) continue;
        const color = cellColor(c)!;
        this.drawCell(ctx, ox + x * cell, oy + y * cell, cell, color, isVirus(c), false);
      }
    }

    if (this.flashMs > 0) {
      for (const f of this.flashCells) {
        this.drawCell(ctx, ox + f.x * cell, oy + f.y * cell, cell, f.color, f.virus, true);
      }
    }

    if (this.pill) {
      const ghost = this.ghostY();
      if (ghost > this.pill.y) {
        for (const [x, y, color] of this.pillCells({ ...this.pill, y: ghost })) {
          if (y < 0) continue;
          this.drawCell(ctx, ox + x * cell, oy + y * cell, cell, color, false, false, true);
        }
      }
      for (const [x, y, color] of this.pillCells(this.pill)) {
        if (y < 0) continue;
        this.drawCell(ctx, ox + x * cell, oy + y * cell, cell, color, false, false);
      }
    }

    this.drawNext(ctx, ox + boardW + 10, oy + 4, cell);

    if (this.combo > 1 && this.flashMs > 0) {
      const comboAlpha = Math.max(0, this.comboTimer / 180);
      ctx.fillStyle = `rgba(68, 232, 168, ${comboAlpha * 0.8})`;
      ctx.font = `${Math.max(18, Math.floor(w * 0.05))}px "VT323", monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`x${this.combo} CLEAR!`, w / 2, oy + boardH / 2);
      ctx.textAlign = "left";
    }

    if (!touchPad) {
      ctx.fillStyle = "rgba(248,240,255,0.7)";
      ctx.font = `${Math.max(16, Math.min(22, Math.floor(w * 0.034)))}px "VT323", monospace`;
      ctx.textAlign = "center";
      ctx.fillText("← → Move · ↑ / Space Rotate", w / 2, h - 28);
      ctx.fillText("↓ Step down · F Hard drop", w / 2, h - 8);
      ctx.textAlign = "left";
    }
  }

  private drawNext(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
    if (!this.nextPill) return;
    const pc = Math.max(8, Math.floor(cell * 0.7));
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x - 4, y - 2, pc * 3 + 16, pc * 3 + 28);
    ctx.strokeStyle = "rgba(200,120,232,0.5)";
    ctx.strokeRect(x - 4, y - 2, pc * 3 + 16, pc * 3 + 28);
    ctx.fillStyle = "#f8f8e8";
    ctx.font = `${Math.max(16, pc)}px "VT323", monospace`;
    ctx.fillText("NEXT", x + 2, y + 12);
    const n = this.nextPill;
    if (n.horiz) {
      this.drawCell(ctx, x + 4, y + 20, pc, n.a, false);
      this.drawCell(ctx, x + 4 + pc, y + 20, pc, n.b, false);
    } else {
      this.drawCell(ctx, x + 4 + Math.floor(pc / 2), y + 18, pc, n.a, false);
      this.drawCell(ctx, x + 4 + Math.floor(pc / 2), y + 18 + pc, pc, n.b, false);
    }
  }

  private drawCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: PillColor,
    virus: boolean,
    clearing = false,
    ghost = false,
  ) {
    const fill = clearing ? "#ffffff" : ghost ? "transparent" : PALETTE[color];
    const hi = PALETTE_HI[color];
    const m = Math.max(1, Math.floor(size * 0.08));

    if (ghost) {
      ctx.strokeStyle = `${PALETTE[color]}88`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + m, y + m, size - m * 2, size - m * 2);
      return;
    }

    if (virus) {
      const p = Math.max(1, Math.floor(size / 8));
      const cx = x + Math.floor((size - p * 8) / 2);
      const cy = y + Math.floor((size - p * 8) / 2);
      ctx.fillStyle = fill;
      ctx.fillRect(cx + p, cy + p * 2, p * 6, p * 4);
      ctx.fillRect(cx + p * 2, cy + p, p * 4, p * 6);
      ctx.fillRect(cx + p, cy, p, p * 2);
      ctx.fillRect(cx + p * 6, cy, p, p * 2);
      ctx.fillStyle = "#0a0e14";
      ctx.fillRect(cx + p * 2, cy + p * 3, p, p);
      ctx.fillRect(cx + p * 5, cy + p * 3, p, p);
      ctx.fillRect(cx + p * 3, cy + p * 5, p * 2, p);
      ctx.fillStyle = hi;
      ctx.fillRect(cx + p * 2, cy + p, p * 3, p);
      return;
    }

    // Capsule half
    const rad = Math.max(1, Math.floor(size * 0.18));
    ctx.fillStyle = fill;
    ctx.fillRect(x + m + rad, y + m, size - 2 * (m + rad), size - 2 * m);
    ctx.fillRect(x + m, y + m + rad, size - 2 * m, size - 2 * (m + rad));
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x + m + 2, y + m + 2, Math.floor(size * 0.35), Math.floor(size * 0.22));
    ctx.globalAlpha = 1;
  }
}
