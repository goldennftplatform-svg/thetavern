/** Puzzle Combo: Stack Attack followed by Veil Cure. */
import { playWarriorImpact } from "../audio/warriorSfx";
import { KnightDrMario } from "./knightDrMario";
import { KnightTetris, TETRIS_MAX_PIECES, TETRIS_WIN_LINES } from "./knightTetris";

export type DemplarStage = "brief" | "tetris" | "drmario" | "done";
// Keep the score keys used by the result screen; saved best scores remain untouched.
export type DemplarRunResult = { total: number; race: number; asteroids: number };
const LIMIT = { tetris: 70_000, drmario: 38_000 };
const INTRO_MS = 3000;
const HANDOFF_MS = 1600;

export class DemplarWarrior {
  stage: DemplarStage = "brief";
  stageStarted = performance.now();
  banner = "PUZZLE COMBO";
  done = false;
  tetris = new KnightTetris();
  drMario = new KnightDrMario();
  result: DemplarRunResult = { total: 0, race: 0, asteroids: 0 };
  readonly mobileEase: boolean;
  private deadline = 0;
  private handoffAt = 0;
  private steerHeld: -1 | 0 | 1 = 0;
  private steerMs = 0;
  private dropHeld = false;
  private dropMs = 0;

  constructor(opts?: { mobileEase?: boolean }) {
    this.mobileEase = !!opts?.mobileEase;
    this.tetris.mobileEase = this.mobileEase;
    this.drMario.mobileEase = this.mobileEase;
    this.tetris.reset();
    this.drMario.reset();
  }

  getBriefMetrics() {
    return { basePx: 26, lineH: 32, rowCount: 6, minFontPx: 26 };
  }

  private clearInput() {
    this.releaseSteer();
    this.boost(false);
  }

  private startStage(now: number, next: "tetris" | "drmario") {
    this.clearInput();
    this.stage = next;
    this.stageStarted = now;
    this.deadline = now + LIMIT[next];
    this.handoffAt = 0;
    this.banner = next === "tetris" ? "STACK ATTACK" : "VEIL CURE";
  }

  private finishStack(now: number) {
    this.tetris.finished = true;
    this.tetris.freeze();
    this.result.race = Math.max(0, this.tetris.score);
    this.handoffAt = now + HANDOFF_MS;
    this.clearInput();
    playWarriorImpact(0.8);
  }

  tetrisSecondsLeft(now: number): number {
    return this.stage === "brief" ? 70 : this.handoffAt ? 0 : Math.max(0, (this.deadline - now) / 1000);
  }

  /** Starting/skipping consumes the action so the first piece is never dropped by accident. */
  private consumeStart(): boolean {
    const now = performance.now();
    if (this.stage === "brief") {
      this.startStage(now, "tetris");
      return true;
    }
    if (this.handoffAt) {
      this.startStage(now, "drmario");
      return true;
    }
    return this.done;
  }

  rotate() {
    if (this.consumeStart()) return;
    if (this.stage === "tetris") this.tetris.rotate();
    if (this.stage === "drmario") this.drMario.rotate();
  }

  steer(dir: -1 | 1, hold = true) {
    if (this.stage === "brief" || this.handoffAt || this.done) return;
    if (hold && this.steerHeld !== dir) {
      this.steerHeld = dir;
      this.steerMs = -130;
    }
    if (this.stage === "tetris") this.tetris.move(dir);
    if (this.stage === "drmario") this.drMario.move(dir);
  }

  releaseSteer() {
    this.steerHeld = 0;
    this.steerMs = 0;
  }

  boost(on: boolean) {
    if (!on) {
      this.dropHeld = false;
      this.dropMs = 0;
      this.tetris.setSoftDrop(false);
      return;
    }
    if (this.stage === "brief" || this.handoffAt || this.done || this.dropHeld) return;
    this.dropHeld = true;
    this.dropMs = -230;
    if (this.stage === "tetris") this.tetris.setSoftDrop(true);
    if (this.stage === "drmario") this.drMario.stepDown();
  }

  hardDrop() {
    if (this.consumeStart()) return;
    if (this.stage === "tetris") this.tetris.hardDrop();
    if (this.stage === "drmario") this.drMario.hardDrop();
  }

  pointerDown(x: number, y: number, w: number, h: number) {
    if (this.consumeStart() || this.mobileEase) return;
    if (y >= h * 0.72) this.boost(true);
    else if (x < w / 3) this.steer(-1);
    else if (x > w * 2 / 3) this.steer(1);
    else this.rotate();
  }

  pointerUp() { this.clearInput(); }

  pointerMove(_x: number, y: number, _w: number, h: number) {
    if (!this.mobileEase) this.boost(y >= h * 0.72);
  }

  update(dt: number, now: number) {
    if (this.done) return;
    if (this.stage === "brief") {
      if (now - this.stageStarted >= INTRO_MS) this.startStage(now, "tetris");
      return;
    }
    if (this.handoffAt) {
      if (now >= this.handoffAt) this.startStage(now, "drmario");
      return;
    }
    dt = Math.min(48, Math.max(0, dt));
    // Wall-clock deadlines work even when RAF is throttled; overlays never spend play time.
    const elapsed = Math.max(0, now - this.stageStarted);
    if (this.stage === "tetris") {
      this.tetris.update(dt, elapsed, LIMIT.tetris);
      if (now >= this.deadline || this.tetris.finished || this.tetris.gameOver ||
          this.tetris.lines >= TETRIS_WIN_LINES || this.tetris.piecesLocked >= TETRIS_MAX_PIECES) {
        this.finishStack(now);
        return;
      }
    } else if (this.stage === "drmario") {
      if (this.drMario.update(dt, elapsed, LIMIT.drmario)) {
        this.result.asteroids = Math.max(0, this.drMario.score);
        this.result.total = this.result.race + this.result.asteroids;
        this.done = true;
        this.stage = "done";
        this.banner = "COMBO COMPLETE";
        this.clearInput();
        return;
      }
    }
    if (this.steerHeld) {
      this.steerMs += dt;
      if (this.steerMs >= 0) {
        this.steer(this.steerHeld, false);
        this.steerMs -= 68;
      }
    }
    if (this.dropHeld && this.stage === "drmario") {
      this.dropMs += dt;
      if (this.dropMs >= 0) {
        this.drMario.stepDown();
        this.dropMs -= 230;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#080c20";
    ctx.fillRect(0, 0, w, h);
    if (this.stage === "brief" || this.handoffAt || this.done) {
      this.drawCard(ctx, w, h);
      ctx.restore();
      return;
    }
    const cure = this.stage === "drmario";
    const accent = cure ? "#fc78b8" : "#58f8b0";
    ctx.fillStyle = "#141c38";
    ctx.fillRect(0, 0, w, 52);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 50, w, 2);
    ctx.font = '24px "VT323", monospace';
    ctx.fillText(`${cure ? "02" : "01"} ${this.banner}`, 12, 23);
    ctx.fillStyle = "#f8f8e8";
    ctx.font = '18px "VT323", monospace';
    const live = cure ? this.result.race + this.drMario.score : this.tetris.score;
    ctx.fillText(`COMBO ${String(live).padStart(6, "0")}`, 12, 43);
    ctx.textAlign = "right";
    ctx.fillStyle = accent;
    ctx.fillText(`STAGE ${cure ? this.drMario.score : this.tetris.score}`, w - 12, 43);
    ctx.textAlign = "left";
    const foot = this.mobileEase ? 116 : 52;
    const left = Math.max(0, (this.deadline - now) / 1000);
    if (cure) this.drMario.draw(ctx, w, h, 52, foot, this.mobileEase, left);
    else {
      ctx.fillStyle = "#242c48";
      ctx.fillRect(12, 58, w - 24, 6);
      ctx.fillStyle = left <= 5 ? "#fc7858" : accent;
      ctx.fillRect(12, 58, Math.floor((w - 24) * left / 70), 6);
      ctx.font = '18px "VT323", monospace';
      ctx.textAlign = "center";
      ctx.fillText(`${Math.ceil(left)}s ROW ${this.tetris.lines}/12 PCS ${this.tetris.piecesLocked}/28`, w / 2, 81);
      ctx.textAlign = "left";
      this.tetris.draw(ctx, w, h, 88, foot, this.mobileEase);
    }
    ctx.restore();
  }

  private drawCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const handoff = !!this.handoffAt;
    const rows = this.done
      ? ["COMBO COMPLETE", `STACK ATTACK  ${this.result.race}`, `VEIL CURE  ${this.result.asteroids}`, `TOTAL  ${this.result.total}`]
      : handoff
        ? ["STACK COMPLETE", `SCORE  ${this.result.race}`, "02 / VEIL CURE", "4 of one color", "Across or down", "Tap / Space"]
        : ["PUZZLE COMBO", "01 STACK ATTACK", "Full rows / 70s", "02 VEIL CURE", "Match 4 / 38s", "Tap / Space"];
    const top = Math.max(16, Math.floor((h - 244) / 2));
    ctx.fillStyle = "#141c38";
    ctx.fillRect(12, top, w - 24, 244);
    ctx.fillStyle = "#f8c858";
    ctx.fillRect(12, top, w - 24, 4);
    ctx.fillRect(12, top + 240, w - 24, 4);
    ctx.textAlign = "center";
    ctx.font = '26px "VT323", monospace';
    rows.forEach((row, i) => {
      ctx.fillStyle = i === 0 ? "#f8c858" : i === rows.length - 1 ? "#58f8b0" : "#f8f8e8";
      ctx.fillText(row, Math.floor(w / 2), top + 36 + i * 32);
    });
    ctx.textAlign = "left";
  }

  hint(): string {
    if (this.stage === "brief") return "Two puzzles, one score. Tap the screen or press Space to start.";
    if (this.handoffAt) return "Veil Cure next: match 4 of one color across or down. Tap / Space to continue.";
    if (this.stage === "tetris") return "Clear full rows. 70 seconds, 12 rows or 28 pieces; a full stack advances to Veil Cure.";
    if (this.stage === "drmario") return "Match 4 of one color across or down. Clear all viruses before 38 seconds; a full bottle ends the combo.";
    return "Puzzle Combo complete: Stack Attack + Veil Cure.";
  }
}

export function renownFromDemplarScore(total: number): number {
  if (total >= 3500) return 8;
  if (total >= 2500) return 6;
  if (total >= 1500) return 4;
  if (total >= 800) return 2;
  return 1;
}

export function tokensFromDemplarScore(total: number): number {
  return total >= 2000 ? 2 : total >= 1000 ? 1 : 0;
}
