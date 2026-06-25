/**
 * Demplar Warrior — three speed trials: Sargaano sprint, Corsus circuit, veil shards.
 */

import { warriorBriefLines, warriorTrialNames } from "../content/demplarKnights";
import { pickLine } from "../content/arcaneLore";

export type DemplarStage = "brief" | "platform" | "race" | "asteroids" | "done";

export type DemplarRunResult = {
  total: number;
  platform: number;
  race: number;
  asteroids: number;
};

type Pickup = { x: number; y: number; kind: "coin" | "knife"; taken?: boolean };
type Plat = { x: number; y: number; w: number; h: number };
type RaceItem = { x: number; y: number; kind: "turbo" | "boot" | "oil"; taken?: boolean };
type Shard = { x: number; y: number; r: number; tier: 0 | 1 | 2; vx: number; vy: number; hp: number };

const STAGE_MS = {
  brief: 2200,
  platform: 26_000,
  race: 22_000,
  asteroids: 12_000,
} as const;

export class DemplarWarrior {
  stage: DemplarStage = "brief";
  stageStarted = 0;
  banner = "DEMPLAR WARRIOR";
  subBanner = warriorTrialNames.platform;
  done = false;

  platform = {
    x: 80,
    y: 0,
    vy: 0,
    cam: 0,
    score: 0,
    goal: 2100,
    onGround: false,
    pickups: [] as Pickup[],
    plats: [] as Plat[],
  };

  race = {
    t: 0,
    x: 0.5,
    y: 0.82,
    angle: -Math.PI / 2,
    speed: 0,
    score: 0,
    boost: 0,
    slip: 0,
    items: [] as RaceItem[],
  };

  asteroids = {
    score: 0,
    shards: [] as Shard[],
    sparkles: [] as { x: number; y: number; life: number }[],
  };

  result: DemplarRunResult = { total: 0, platform: 0, race: 0, asteroids: 0 };

  constructor() {
    this.resetPlatform();
    this.resetRace();
    this.resetAsteroids();
    this.stageStarted = performance.now();
  }

  private resetPlatform() {
    const pickups: Pickup[] = [];
    const plats: Plat[] = [{ x: -40, y: 0, w: 520, h: 48 }];
    for (let i = 0; i < 18; i++) {
      const px = 180 + i * 118;
      const py = i % 3 === 1 ? -52 : i % 3 === 2 ? -88 : 0;
      plats.push({ x: px, y: py, w: 72 + (i % 4) * 16, h: 24 });
      if (i % 2 === 0) pickups.push({ x: px + 28, y: py - 36, kind: "coin" });
      if (i % 5 === 2) pickups.push({ x: px + 44, y: py - 52, kind: "knife" });
    }
    plats.push({ x: 2050, y: -20, w: 120, h: 32 });
    pickups.push({ x: 2100, y: -56, kind: "knife" });
    pickups.push({ x: 2140, y: -40, kind: "coin" });
    this.platform = {
      x: 80,
      y: 0,
      vy: 0,
      cam: 0,
      score: 0,
      goal: 2180,
      onGround: false,
      pickups,
      plats,
    };
  }

  private resetRace() {
    const items: RaceItem[] = [];
    for (let i = 0; i < 10; i++) {
      const kinds: RaceItem["kind"][] = ["turbo", "boot", "oil", "turbo", "coin" as never];
      const kind = (["turbo", "boot", "oil", "turbo", "boot"] as const)[i % 5]!;
      items.push({
        x: 0.15 + (i * 0.08) % 0.7,
        y: 0.2 + ((i * 0.17) % 0.6),
        kind,
      });
    }
    this.race = {
      t: 0,
      x: 0.5,
      y: 0.82,
      angle: -Math.PI / 2,
      speed: 0,
      score: 0,
      boost: 0,
      slip: 0,
      items,
    };
  }

  private resetAsteroids() {
    const shards: Shard[] = [];
    for (let i = 0; i < 5; i++) {
      shards.push(this.spawnShard(Math.random() * 0.75 + 0.1, Math.random() * 0.65 + 0.12, 0));
    }
    this.asteroids = { score: 0, shards, sparkles: [] };
  }

  private spawnShard(nx: number, ny: number, tier: 0 | 1 | 2): Shard {
    const r = tier === 0 ? 34 : tier === 1 ? 20 : 11;
    return {
      x: nx,
      y: ny,
      r,
      tier,
      vx: (Math.random() - 0.5) * 0.0008,
      vy: (Math.random() - 0.5) * 0.0008,
      hp: tier === 0 ? 3 : tier === 1 ? 2 : 1,
    };
  }

  private stageElapsed(now: number): number {
    return now - this.stageStarted;
  }

  advanceStage(now: number, next: DemplarStage) {
    if (next === "race") {
      this.result.platform = this.platform.score;
      this.subBanner = warriorTrialNames.race;
    } else if (next === "asteroids") {
      this.result.race = this.race.score;
      this.subBanner = warriorTrialNames.asteroids;
    } else if (next === "done") {
      this.result.asteroids = this.asteroids.score;
      this.result.total = this.result.platform + this.result.race + this.result.asteroids;
      this.done = true;
      this.banner = "CHARTER TRIALS SEALED";
      this.subBanner = `Total ${this.result.total}`;
    }
    this.stage = next;
    this.stageStarted = now;
  }

  jump() {
    if (this.stage !== "platform") return;
    if (this.platform.onGround) {
      this.platform.vy = -11.2;
      this.platform.onGround = false;
    }
  }

  steer(dir: -1 | 1) {
    if (this.stage !== "race") return;
    this.race.angle += dir * 0.085;
  }

  pointerDown(nx: number, ny: number, w: number, h: number) {
    if (this.stage === "platform") {
      this.jump();
      return;
    }
    if (this.stage === "race") {
      this.steer(nx < w * 0.5 ? -1 : 1);
      return;
    }
    if (this.stage === "asteroids") {
      this.hitShard(nx / w, ny / h);
    }
  }

  private hitShard(nx: number, ny: number) {
    for (let i = this.asteroids.shards.length - 1; i >= 0; i--) {
      const s = this.asteroids.shards[i]!;
      const dx = nx - s.x;
      const dy = ny - s.y;
      const hit = Math.hypot(dx, dy) < s.r / Math.max(280, 320);
      if (!hit) continue;
      s.hp -= 1;
      this.asteroids.sparkles.push({ x: s.x, y: s.y, life: 1 });
      if (s.hp > 0) return;
      const pts = s.tier === 0 ? 120 : s.tier === 1 ? 65 : 35;
      this.asteroids.score += pts;
      this.asteroids.shards.splice(i, 1);
      if (s.tier < 2) {
        const childTier = (s.tier + 1) as 1 | 2;
        this.asteroids.shards.push(this.spawnShard(s.x - 0.04, s.y, childTier));
        this.asteroids.shards.push(this.spawnShard(s.x + 0.04, s.y, childTier));
      }
      if (this.asteroids.shards.length < 4 && Math.random() > 0.35) {
        this.asteroids.shards.push(
          this.spawnShard(Math.random() * 0.7 + 0.12, Math.random() * 0.55 + 0.14, 0),
        );
      }
      return;
    }
  }

  update(dt: number, now: number) {
    const elapsed = this.stageElapsed(now);

    if (this.stage === "brief" && elapsed > STAGE_MS.brief) {
      this.advanceStage(now, "platform");
      return;
    }

    if (this.stage === "platform") this.tickPlatform(dt, elapsed, now);
    if (this.stage === "race") this.tickRace(dt, elapsed, now);
    if (this.stage === "asteroids") this.tickAsteroids(dt, elapsed, now);
  }

  private tickPlatform(dt: number, elapsed: number, now: number) {
    const p = this.platform;
    const gravity = 0.52;
    p.vy += gravity;
    p.x += 2.4 + dt * 0.004;
    p.y += p.vy;

    p.onGround = false;
    for (const plat of p.plats) {
      if (
        p.x + 14 > plat.x &&
        p.x - 14 < plat.x + plat.w &&
        p.y >= plat.y - 36 &&
        p.y <= plat.y + 8 &&
        p.vy >= 0
      ) {
        p.y = plat.y - 36;
        p.vy = 0;
        p.onGround = true;
      }
    }

    if (p.y > 120) {
      p.y = 0;
      p.vy = 0;
      p.score = Math.max(0, p.score - 40);
    }

    p.cam = Math.max(0, p.x - 120);

    for (const pick of p.pickups) {
      if (pick.taken) continue;
      if (Math.abs(p.x - pick.x) < 26 && Math.abs(p.y - pick.y) < 36) {
        pick.taken = true;
        p.score += pick.kind === "coin" ? 80 : 150;
      }
    }

    const timeLeft = Math.max(0, STAGE_MS.platform - elapsed);
    p.score += Math.floor(dt * 0.06);

    if (p.x >= p.goal || elapsed >= STAGE_MS.platform) {
      p.score += Math.floor(timeLeft / 120);
      this.platform.score = p.score;
      this.advanceStage(now, "race");
    }
  }

  private tickRace(dt: number, elapsed: number, now: number) {
    const r = this.race;
    r.t += dt * 0.001;
    r.boost = Math.max(0, r.boost - dt * 0.0012);
    r.slip = Math.max(0, r.slip - dt * 0.0016);

    const accel = 0.00034 + r.boost * 0.00022;
    r.speed = Math.min(0.014, r.speed + accel * dt);
    if (r.slip > 0) r.speed *= 0.92;

    r.x += Math.cos(r.angle) * r.speed * dt;
    r.y += Math.sin(r.angle) * r.speed * dt;

    r.x = Math.max(0.08, Math.min(0.92, r.x));
    r.y = Math.max(0.1, Math.min(0.9, r.y));

    if (r.x < 0.12 || r.x > 0.88) r.angle = Math.PI - r.angle;
    if (r.y < 0.14 || r.y > 0.86) r.angle = -r.angle;

    for (const item of r.items) {
      if (item.taken) continue;
      if (Math.hypot(r.x - item.x, r.y - item.y) < 0.055) {
        item.taken = true;
        if (item.kind === "turbo") {
          r.boost = 1;
          r.score += 90;
        } else if (item.kind === "boot") {
          r.score += 70;
          r.speed = Math.min(0.016, r.speed + 0.002);
        } else {
          r.slip = 1;
          r.score = Math.max(0, r.score - 30);
        }
      }
    }

    r.score += Math.floor(dt * 0.14);

    if (elapsed >= STAGE_MS.race) {
      this.race.score = r.score;
      this.advanceStage(now, "asteroids");
    }
  }

  private tickAsteroids(dt: number, elapsed: number, now: number) {
    const a = this.asteroids;
    for (const s of a.shards) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 0.05 || s.x > 0.95) s.vx *= -1;
      if (s.y < 0.08 || s.y > 0.92) s.vy *= -1;
    }
    a.sparkles = a.sparkles
      .map((sp) => ({ ...sp, life: sp.life - dt * 0.002 }))
      .filter((sp) => sp.life > 0);

    if (elapsed >= STAGE_MS.asteroids) {
      a.score += Math.floor((STAGE_MS.asteroids - Math.min(elapsed, STAGE_MS.asteroids)) / 80);
      this.advanceStage(now, "done");
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#060a14";
    ctx.fillRect(0, 0, w, h);

    this.drawHud(ctx, w, h, now);

    if (this.stage === "brief") {
      this.drawBrief(ctx, w, h);
      return;
    }
    if (this.stage === "platform") this.drawPlatform(ctx, w, h);
    else if (this.stage === "race") this.drawRace(ctx, w, h);
    else if (this.stage === "asteroids") this.drawAsteroids(ctx, w, h);
    else this.drawDone(ctx, w, h);
  }

  private drawHud(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const elapsed = this.stageElapsed(now);
    let timeMax = STAGE_MS.platform;
    if (this.stage === "race") timeMax = STAGE_MS.race;
    if (this.stage === "asteroids") timeMax = STAGE_MS.asteroids;
    const timeLeft =
      this.stage === "brief" || this.stage === "done"
        ? 0
        : Math.max(0, timeMax - elapsed) / 1000;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, w, 36);
    ctx.fillStyle = "#e8b050";
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText(this.banner.slice(0, 22), 10, 14);
    ctx.fillStyle = "#98b8e8";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText(this.subBanner.slice(0, 36), 10, 28);

    if (timeLeft > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#68b8a8";
      ctx.fillText(`${timeLeft.toFixed(1)}s`, w - 10, 18);
      ctx.textAlign = "left";
    }

    const live =
      (this.stage === "platform" ? this.platform.score : 0) +
      (this.stage === "race" || this.stage === "asteroids" || this.stage === "done"
        ? this.result.platform
        : 0) +
      (this.stage === "race" ? this.race.score : 0) +
      (this.stage === "asteroids" || this.stage === "done" ? this.result.race : 0) +
      (this.stage === "asteroids" ? this.asteroids.score : 0);
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8f0ff";
    ctx.fillText(`◎ ${live}`, w - 10, 30);
    ctx.textAlign = "left";
  }

  private drawBrief(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "rgba(72, 48, 88, 0.35)";
    ctx.fillRect(w * 0.12, h * 0.22, w * 0.76, h * 0.42);
    ctx.strokeStyle = "#e8b050";
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.12, h * 0.22, w * 0.76, h * 0.42);
    ctx.fillStyle = "#e8b050";
    ctx.font = `${Math.max(10, w * 0.022)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("⚔ DEMPLAR WARRIOR", w / 2, h * 0.34);
    ctx.fillStyle = "#98b8e8";
    ctx.font = `${Math.max(7, w * 0.012)}px "Press Start 2P", monospace`;
    ctx.fillText(pickLine(warriorBriefLines), w / 2, h * 0.44);
    ctx.fillStyle = "#68b8a8";
    ctx.font = `${Math.max(6, w * 0.01)}px "Press Start 2P", monospace`;
    ctx.fillText("SARGAANO  ·  CORSUS  ·  THE VEIL", w / 2, h * 0.54);
    ctx.fillStyle = "rgba(232, 176, 80, 0.65)";
    ctx.fillText("KNIGHTS OF THE ANCIENT CHARTER", w / 2, h * 0.62);
    ctx.textAlign = "left";
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const groundY = h * 0.72;
    const p = this.platform;
    const cam = p.cam;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0a1830");
    grad.addColorStop(1, "#1a2848");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 36, w, h - 36);

    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i % 2 ? "#243858" : "#1a2840";
      ctx.fillRect(((i * 80 - cam * 0.3) % (w + 80)) - 40, groundY + 20, 80, h);
    }

    for (const plat of p.plats) {
      const sx = plat.x - cam;
      if (sx < -100 || sx > w + 100) continue;
      ctx.fillStyle = "#4a3020";
      ctx.fillRect(sx, groundY + plat.y, plat.w, plat.h);
      ctx.strokeStyle = "#e8b050";
      ctx.strokeRect(sx, groundY + plat.y, plat.w, plat.h);
    }

    for (const pick of p.pickups) {
      if (pick.taken) continue;
      const sx = pick.x - cam;
      if (sx < -20 || sx > w + 20) continue;
      if (pick.kind === "coin") {
        ctx.fillStyle = "#e8b050";
        ctx.beginPath();
        ctx.arc(sx, groundY + pick.y, 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#98b8e8";
        ctx.fillRect(sx - 10, groundY + pick.y - 12, 20, 24);
        ctx.fillStyle = "#e8b050";
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = "center";
        ctx.fillText("†", sx, groundY + pick.y + 4);
        ctx.textAlign = "left";
      }
    }

    const px = 100;
    const py = groundY + p.y;
    ctx.fillStyle = "#68b8a8";
    ctx.fillRect(px - 12, py - 34, 24, 34);
    ctx.fillStyle = "#e8b050";
    ctx.fillRect(px - 16, py - 42, 32, 10);
    ctx.fillStyle = "#f8f0ff";
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText("D", px - 4, py - 48);

    const gx = p.goal - cam;
    if (gx < w + 40) {
      ctx.fillStyle = "rgba(232,176,80,0.35)";
      ctx.fillRect(gx, groundY - 100, 8, 100);
      ctx.fillStyle = "#e8b050";
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText("GATE", gx - 8, groundY - 108);
    }

    ctx.fillStyle = "rgba(248,240,255,0.65)";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("TAP / SPACE — JUMP", w / 2, h - 14);
    ctx.textAlign = "left";
  }

  private drawRace(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const r = this.race;
    ctx.fillStyle = "#142018";
    ctx.fillRect(0, 36, w, h - 36);

    ctx.strokeStyle = "#3a5848";
    ctx.lineWidth = 28;
    ctx.strokeRect(w * 0.1, h * 0.18, w * 0.8, h * 0.68);
    ctx.strokeStyle = "#e8b050";
    ctx.lineWidth = 4;
    ctx.strokeRect(w * 0.18, h * 0.26, w * 0.64, h * 0.52);

    for (const item of r.items) {
      if (item.taken) continue;
      const ix = item.x * w;
      const iy = item.y * h;
      if (item.kind === "turbo") {
        ctx.fillStyle = "#e87850";
        ctx.fillRect(ix - 8, iy - 8, 16, 16);
        ctx.fillStyle = "#f8f0ff";
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillText("T", ix - 3, iy + 3);
      } else if (item.kind === "boot") {
        ctx.fillStyle = "#98b8e8";
        ctx.fillRect(ix - 9, iy - 6, 18, 12);
      } else {
        ctx.fillStyle = "#2a1810";
        ctx.beginPath();
        ctx.ellipse(ix, iy, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const cx = r.x * w;
    const cy = r.y * h;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(r.angle);
    ctx.fillStyle = r.slip > 0 ? "#c87878" : "#68b8a8";
    ctx.fillRect(-14, -8, 28, 16);
    ctx.fillStyle = "#e8b050";
    ctx.fillRect(8, -6, 8, 12);
    ctx.restore();

    ctx.fillStyle = "rgba(248,240,255,0.65)";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("TAP LEFT / RIGHT — STEER", w / 2, h - 14);
    ctx.textAlign = "left";
  }

  private drawAsteroids(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "#080818";
    ctx.fillRect(0, 36, w, h - 36);

    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(248,240,255,${0.15 + (i % 5) * 0.05})`;
      const sx = ((i * 97) % w) + ((performance.now() * 0.01 + i * 20) % 12);
      const sy = 40 + ((i * 53) % (h - 80));
      ctx.fillRect(sx, sy, 2, 2);
    }

    for (const sp of this.asteroids.sparkles) {
      ctx.fillStyle = `rgba(232,176,80,${sp.life})`;
      ctx.beginPath();
      ctx.arc(sp.x * w, sp.y * h, 16 * sp.life, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of this.asteroids.shards) {
      const col = s.tier === 0 ? "#6a5878" : s.tier === 1 ? "#8a7898" : "#aab0c8";
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e8b050";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(248,240,255,0.65)";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("TAP SHARDS — BIG BREAKS SMALL", w / 2, h - 14);
    ctx.textAlign = "left";
  }

  private drawDone(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "#e8b050";
    ctx.font = `${Math.max(9, w * 0.018)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("CHARTER TRIAL COMPLETE", w / 2, h * 0.36);
    ctx.fillStyle = "#f8f0ff";
    ctx.font = `${Math.max(7, w * 0.012)}px "Press Start 2P", monospace`;
    ctx.fillText(`RUN ${this.result.platform}`, w / 2, h * 0.46);
    ctx.fillText(`CIRCUIT ${this.result.race}`, w / 2, h * 0.52);
    ctx.fillText(`SHARDS ${this.result.asteroids}`, w / 2, h * 0.58);
    ctx.fillStyle = "#68e8a8";
    ctx.fillText(`TOTAL ${this.result.total}`, w / 2, h * 0.66);
    ctx.textAlign = "left";
  }

  hint(): string {
    if (this.stage === "platform") return "Jump the charter run — coins & blade boxes";
    if (this.stage === "race") return "Steer the rim circuit — turbos, boots, oil";
    if (this.stage === "asteroids") return "Shatter void shards before time runs out";
    return "Demplar Warrior — three trials of speed";
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
