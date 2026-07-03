/**
 * Charter Dr. Mario — trial III pill puzzle for Demplar Warrior.
 */

export type PillColor = "R" | "B" | "Y";

const COLS = 8;
const ROWS = 16;
const VIRUS_COUNT = 6;
const MAX_MATCH_CHAINS = 6;
const COLORS: PillColor[] = ["R", "B", "Y"];
const PALETTE: Record<PillColor, string> = {
  R: "#e87850",
  B: "#6898e8",
  Y: "#e8b050",
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

  private grid: Cell[][] = [];
  private pill: FallingPill | null = null;
  private dropMs = 0;
  private gravityMs = 720;
  mobileEase = false;

  reset() {
    this.score = 0;
    this.combo = 0;
    this.finished = false;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null) as Cell[]);
    this.seedViruses();
    this.pill = null;
    this.dropMs = 0;
    this.gravityMs = this.mobileEase ? 900 : 720;
    this.spawnPill();
  }

  private seedViruses() {
    /** Fixed lower-board layout — viruses never move after spawn. */
    const slots: [number, number][] = [
      [1, 12],
      [4, 12],
      [6, 12],
      [2, 13],
      [5, 13],
      [3, 14],
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

  private spawnPill() {
    const a = COLORS[Math.floor(Math.random() * 3)]!;
    const b = COLORS[Math.floor(Math.random() * 3)]!;
    const horiz = Math.random() < 0.55;
    const pill: FallingPill = { x: 3, y: 0, horiz, a, b };
    if (this.pillBlocked(pill)) {
      this.pill = null;
      this.endTrialBoardFull();
      return;
    }
    this.pill = pill;
    this.dropMs = 0;
  }

  /** Board topped out — finish with partial credit instead of a punishing game over. */
  private endTrialBoardFull() {
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
      if (y >= 0 && this.grid[y]![x]) return true;
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
      p.horiz = next;
      return;
    }
    for (const kick of [-1, 1]) {
      if (!this.pillBlocked(p, kick, 0, next)) {
        p.x += kick;
        p.horiz = next;
        return;
      }
    }
  }

  setSoftDrop(_on: boolean) {
    /* Dr Mario uses tap-to-step (stepDown) — no hold-soft-drop. */
  }

  /** One row down per tap — not a held turbo drop. */
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

  private lockPill() {
    const p = this.pill;
    if (!p) return;
    for (const [x, y, color] of this.pillCells(p)) {
      if (y >= 0) this.grid[y]![x] = color;
    }
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
      let viruses = 0;
      for (const key of toClear) {
        const [xs, ys] = key.split(",");
        const x = Number(xs);
        const y = Number(ys);
        const cell = this.grid[y]![x];
        if (isVirus(cell)) viruses += 1;
        this.grid[y]![x] = null;
      }
      this.virusesLeft = this.countViruses();
      const mult = 1 + (chain - 1) * 0.35;
      this.score += Math.floor((toClear.size * 18 + viruses * 90) * mult);
      this.combo = chain;
      this.settlePillGravity();
    }
  }

  /** Only loose pill halves fall — viruses stay anchored in place. */
  private settlePillGravity() {
    for (let pass = 0; pass < ROWS; pass++) {
      let moved = false;
      for (let x = 0; x < COLS; x++) {
        for (let y = ROWS - 2; y >= 0; y--) {
          const c = this.grid[y]![x];
          if (!c || isVirus(c)) continue;
          if (!this.grid[y + 1]![x]) {
            this.grid[y + 1]![x] = c;
            this.grid[y]![x] = null;
            moved = true;
          }
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
    if (this.finished) return false;

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
    return this.finished;
  }

  hudLine(): string {
    return `♥${this.virusesLeft} virus${this.virusesLeft === 1 ? "" : "es"}`;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, hudTop: number) {
    const pad = 8;
    const playH = h - hudTop - pad * 2;
    const cell = Math.floor(Math.min((w - pad * 2) / COLS, playH / ROWS));
    const boardW = cell * COLS;
    const boardH = cell * ROWS;
    const ox = Math.floor((w - boardW) / 2);
    const oy = hudTop + Math.floor((playH - boardH) / 2) + pad;

    ctx.fillStyle = "#101828";
    ctx.fillRect(ox - 4, oy - 4, boardW + 8, boardH + 8);
    ctx.strokeStyle = "#c878e8";
    ctx.lineWidth = 3;
    ctx.strokeRect(ox - 4, oy - 4, boardW + 8, boardH + 8);

    ctx.fillStyle = "#e8b050";
    ctx.font = `${Math.max(16, Math.floor(w * 0.042))}px "VT323", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("III · VEIL CURE", w / 2, oy - 10);
    ctx.textAlign = "left";

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = this.grid[y]![x];
        if (!c) continue;
        const color = cellColor(c)!;
        this.drawCell(ctx, ox + x * cell, oy + y * cell, cell, PALETTE[color], isVirus(c));
      }
    }

    if (this.pill) {
      for (const [x, y, color] of this.pillCells(this.pill)) {
        if (y < 0) continue;
        this.drawCell(ctx, ox + x * cell, oy + y * cell, cell, PALETTE[color], false);
      }
    }

    ctx.fillStyle = "rgba(248,240,255,0.7)";
    ctx.font = `${Math.max(14, Math.floor(w * 0.034))}px "VT323", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("← → MOVE · ↑ ROTATE · ↓ STEP · F SLAM · CLEAR VIRUSES", w / 2, h - 8);
    ctx.textAlign = "left";
  }

  private drawCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    virus: boolean,
  ) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (virus) {
      ctx.arc(x + size / 2, y + size / 2, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.stroke();
    } else {
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }
  }
}
