/**
 * Charter Tetris — trial II stack for Demplar Warrior.
 */

export type TetrisColor = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const COLS = 10;
const ROWS = 20;
const SHAPES: readonly (readonly [number, number])[][] = [
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 1], [1, 0], [1, 1], [2, 0]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [0, 1], [1, 1], [2, 1]],
];

const PALETTE = ["#68e8a8", "#e8b050", "#98b8e8", "#78d0b8", "#e87850", "#6898e8", "#d8a868"];

type ActivePiece = {
  shape: number;
  color: TetrisColor;
  rot: number;
  x: number;
  y: number;
};

function rotateCells(cells: readonly [number, number][], rot: number): [number, number][] {
  return cells.map(([x, y]) => {
    if (rot === 0) return [x, y];
    if (rot === 1) return [-y, x];
    if (rot === 2) return [-x, -y];
    return [y, -x];
  });
}

export class KnightTetris {
  score = 0;
  lines = 0;
  level = 1;
  gameOver = false;
  finished = false;

  private grid: (TetrisColor | -1)[][] = [];
  private bag: number[] = [];
  private active: ActivePiece | null = null;
  private dropMs = 0;
  private lockMs = 0;
  private softDrop = false;
  private gravityMs = 820;

  reset() {
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.finished = false;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(-1) as (TetrisColor | -1)[]);
    this.bag = [];
    this.dropMs = 0;
    this.lockMs = 0;
    this.softDrop = false;
    this.gravityMs = 820;
    this.spawn();
  }

  private refillBag() {
    const next = [0, 1, 2, 3, 4, 5, 6];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j]!, next[i]!];
    }
    this.bag.push(...next);
  }

  private spawn() {
    if (this.bag.length < 2) this.refillBag();
    const shape = this.bag.shift()!;
    const color = shape as TetrisColor;
    this.active = { shape, color, rot: 0, x: 3, y: -1 };
    if (this.collides(this.active)) {
      this.gameOver = true;
      this.active = null;
    }
  }

  private cells(p: ActivePiece): [number, number][] {
    return rotateCells(SHAPES[p.shape]!, p.rot).map(([x, y]) => [p.x + x, p.y + y]);
  }

  private collides(p: ActivePiece, ox = 0, oy = 0, rot = p.rot): boolean {
    for (const [x, y] of rotateCells(SHAPES[p.shape]!, rot).map(([cx, cy]) => [p.x + cx + ox, p.y + cy + oy])) {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && this.grid[y]![x]! >= 0) return true;
    }
    return false;
  }

  move(dir: -1 | 1) {
    if (!this.active || this.gameOver) return;
    const p = this.active;
    if (!this.collides(p, dir, 0)) p.x += dir;
  }

  rotate() {
    if (!this.active || this.gameOver) return;
    const p = this.active;
    const nextRot = (p.rot + 1) % 4;
    if (!this.collides(p, 0, 0, nextRot)) {
      p.rot = nextRot;
      return;
    }
    for (const kick of [-1, 1, -2, 2]) {
      if (!this.collides(p, kick, 0, nextRot)) {
        p.x += kick;
        p.rot = nextRot;
        return;
      }
    }
  }

  setSoftDrop(on: boolean) {
    this.softDrop = on;
  }

  hardDrop() {
    if (!this.active || this.gameOver) return;
    let dropped = 0;
    while (!this.collides(this.active, 0, 1)) {
      this.active.y += 1;
      dropped += 1;
    }
    this.score += dropped * 2;
    this.lockPiece();
  }

  private lockPiece() {
    const p = this.active;
    if (!p) return;
    for (const [x, y] of this.cells(p)) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) this.grid[y]![x] = p.color;
    }
    this.clearLines();
    this.spawn();
    this.lockMs = 0;
  }

  private clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (this.grid[y]!.every((c) => c >= 0)) {
        this.grid.splice(y, 1);
        this.grid.unshift(Array(COLS).fill(-1) as (TetrisColor | -1)[]);
        cleared += 1;
        y += 1;
      }
    }
    if (cleared > 0) {
      this.lines += cleared;
      const base = [0, 120, 320, 620, 900][cleared] ?? 900;
      this.score += base * this.level;
      this.level = 1 + Math.floor(this.lines / 8);
      this.gravityMs = Math.max(280, 820 - (this.level - 1) * 55);
    }
  }

  update(dt: number, elapsed: number, timeLimitMs: number): boolean {
    if (this.finished || this.gameOver) {
      if (!this.finished) {
        this.finished = true;
        return true;
      }
      return false;
    }

    if (elapsed >= timeLimitMs || this.lines >= 18) {
      this.score += Math.max(0, Math.floor((timeLimitMs - elapsed) / 200)) + this.lines * 40;
      this.finished = true;
      return true;
    }

    if (!this.active) return false;

    const grav = this.softDrop ? Math.min(80, this.gravityMs * 0.12) : this.gravityMs;
    this.dropMs += dt;
    if (this.dropMs >= grav) {
      this.dropMs = 0;
      if (!this.collides(this.active, 0, 1)) {
        this.active.y += 1;
        this.lockMs = 0;
        if (this.softDrop) this.score += 1;
      } else {
        this.lockMs += dt;
        if (this.lockMs >= 420) this.lockPiece();
      }
    }
    return false;
  }

  hudLine(): string {
    return `L${this.lines} · LV${this.level}`;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, hudTop: number) {
    const pad = 8;
    const playH = h - hudTop - pad * 2;
    const cell = Math.floor(Math.min((w - pad * 2) / COLS, playH / ROWS));
    const boardW = cell * COLS;
    const boardH = cell * ROWS;
    const ox = Math.floor((w - boardW) / 2);
    const oy = hudTop + Math.floor((playH - boardH) / 2) + pad;

    ctx.fillStyle = "#0a1020";
    ctx.fillRect(ox - 4, oy - 4, boardW + 8, boardH + 8);
    ctx.strokeStyle = "#68e8a8";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 4, oy - 4, boardW + 8, boardH + 8);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = this.grid[y]![x]!;
        if (c >= 0) this.drawCell(ctx, ox + x * cell, oy + y * cell, cell, PALETTE[c]!);
      }
    }

    if (this.active) {
      for (const [x, y] of this.cells(this.active)) {
        if (y < 0) continue;
        this.drawCell(ctx, ox + x * cell, oy + y * cell, cell, PALETTE[this.active.color]!);
      }
    }

    ctx.fillStyle = "rgba(248,240,255,0.7)";
    ctx.font = `${Math.max(14, Math.floor(w * 0.034))}px "VT323", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("← → MOVE · ↑ ROTATE · ↓ DROP", w / 2, h - 8);
    ctx.textAlign = "left";
  }

  private drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 2, y + 2, size - 6, 3);
  }
}
