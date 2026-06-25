/**
 * Demplar Warrior — three charter trials with real mechanics:
 * I  Sargaano Sprint — side-scroll platformer (fixed cam, gaps, variable jump)
 * II Corsus Circuit — waypoint track, 2 laps, you vs 4 rivals + clock
 * III Veil Shards — ship shooter, waves, combos, 42s survival
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

type Pickup = { x: number; y: number; kind: "coin" | "blade"; taken?: boolean };
type Plat = { x: number; y: number; w: number; h: number };

type TrackSeg = { x0: number; y0: number; x1: number; y1: number; len: number };
type Track = { segments: TrackSeg[]; total: number };

type Racer = {
  name: string;
  color: string;
  isPlayer: boolean;
  lapProgress: number;
  lateral: number;
  speed: number;
  steerHeld: number;
  finished: boolean;
  finishMs: number;
  boost: number;
};

type Bullet = { x: number; y: number; vx: number; vy: number; life: number };
type Asteroid = {
  x: number;
  y: number;
  r: number;
  tier: 0 | 1 | 2;
  vx: number;
  vy: number;
  hp: number;
  rot: number;
};

const STAGE_MS = {
  brief: 2800,
  platform: 48_000,
  race: 52_000,
  asteroids: 42_000,
} as const;

const LAP_COUNT = 2;
const PLAYER_SCREEN_X = 148;
const RUN_SPEED = 4.85;
const GRAVITY = 0.58;
const JUMP_VEL = -12.8;
const COYOTE_MS = 110;
const TRACK_HALF_W = 0.042;

/** Hand-built platform course — gaps are intentional pits. */
const PLATFORM_PLATS: Plat[] = [
  { x: -60, y: 0, w: 520, h: 40 },
  { x: 520, y: 0, w: 280, h: 40 },
  { x: 920, y: -36, w: 200, h: 28 },
  { x: 1180, y: -72, w: 160, h: 28 },
  { x: 1420, y: -36, w: 220, h: 28 },
  { x: 1720, y: 0, w: 300, h: 40 },
  { x: 2120, y: 0, w: 180, h: 40 },
  { x: 2380, y: -48, w: 140, h: 28 },
  { x: 2580, y: -96, w: 120, h: 28 },
  { x: 2760, y: -48, w: 160, h: 28 },
  { x: 2980, y: 0, w: 240, h: 40 },
  { x: 3300, y: 0, w: 420, h: 40 },
];

const PLATFORM_PICKUPS: Pickup[] = [
  { x: 280, y: -44, kind: "coin" },
  { x: 340, y: -44, kind: "coin" },
  { x: 600, y: -44, kind: "coin" },
  { x: 980, y: -80, kind: "blade" },
  { x: 1240, y: -116, kind: "coin" },
  { x: 1500, y: -80, kind: "coin" },
  { x: 1880, y: -44, kind: "blade" },
  { x: 2200, y: -44, kind: "coin" },
  { x: 2440, y: -92, kind: "coin" },
  { x: 2620, y: -140, kind: "blade" },
  { x: 2820, y: -92, kind: "coin" },
  { x: 3100, y: -44, kind: "coin" },
  { x: 3500, y: -44, kind: "blade" },
  { x: 3600, y: -44, kind: "coin" },
];

const GOAL_X = 3650;

/** Closed circuit — Corsus desert loop (normalized 0–1). */
const TRACK_POINTS: Array<[number, number]> = [
  [0.5, 0.8],
  [0.68, 0.76],
  [0.84, 0.64],
  [0.9, 0.46],
  [0.82, 0.28],
  [0.64, 0.18],
  [0.42, 0.2],
  [0.24, 0.32],
  [0.16, 0.5],
  [0.22, 0.68],
  [0.34, 0.76],
];

const AI_RIVALS: Array<{ name: string; color: string; pace: number }> = [
  { name: "Corsus", color: "#c87878", pace: 0.000095 },
  { name: "Sparrow", color: "#98b8e8", pace: 0.000102 },
  { name: "Veil", color: "#b898c8", pace: 0.000088 },
  { name: "Herald", color: "#e8b050", pace: 0.000108 },
];

function buildTrack(pts: Array<[number, number]>): Track {
  const segments: TrackSeg[] = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    segments.push({ x0, y0, x1, y1, len });
    total += len;
  }
  return { segments, total };
}

function trackAt(t: number, track: Track): { x: number; y: number; angle: number } {
  const wrapped = ((t % 1) + 1) % 1;
  let d = wrapped * track.total;
  for (const seg of track.segments) {
    if (d <= seg.len + 1e-6) {
      const f = seg.len > 0 ? d / seg.len : 0;
      return {
        x: seg.x0 + (seg.x1 - seg.x0) * f,
        y: seg.y0 + (seg.y1 - seg.y0) * f,
        angle: Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0),
      };
    }
    d -= seg.len;
  }
  const last = track.segments[track.segments.length - 1]!;
  return { x: last.x1, y: last.y1, angle: 0 };
}

function racerRank(racers: Racer[]): Racer[] {
  return [...racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishMs - b.finishMs;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.lapProgress - a.lapProgress;
  });
}

export class DemplarWarrior {
  stage: DemplarStage = "brief";
  stageStarted = 0;
  banner = "DEMPLAR WARRIOR";
  subBanner = warriorTrialNames.platform;
  done = false;

  private track = buildTrack(TRACK_POINTS);
  private jumpHeld = false;
  private coyoteUntil = 0;
  private pointerSteer = 0;

  platform = {
    x: 64,
    y: 0,
    vy: 0,
    cam: 0,
    score: 0,
    onGround: false,
    deaths: 0,
    pickups: [] as Pickup[],
    plats: [] as Plat[],
  };

  race = {
    racers: [] as Racer[],
    track: this.track,
    items: [] as Array<{ t: number; lateral: number; kind: "turbo" | "boot" | "oil"; taken?: boolean }>,
    score: 0,
    raceOver: false,
    playerPlace: 5,
  };

  asteroids = {
    shipX: 0.5,
    score: 0,
    combo: 0,
    comboTimer: 0,
    wave: 1,
    waveTimer: 0,
    bullets: [] as Bullet[],
    rocks: [] as Asteroid[],
    lives: 3,
  };

  result: DemplarRunResult = { total: 0, platform: 0, race: 0, asteroids: 0 };

  constructor() {
    this.resetPlatform();
    this.resetRace();
    this.resetAsteroids();
    this.stageStarted = performance.now();
  }

  private resetPlatform() {
    this.platform = {
      x: 64,
      y: 0,
      vy: 0,
      cam: 0,
      score: 0,
      onGround: false,
      deaths: 0,
      pickups: PLATFORM_PICKUPS.map((p) => ({ ...p })),
      plats: PLATFORM_PLATS.map((p) => ({ ...p })),
    };
    this.jumpHeld = false;
    this.coyoteUntil = 0;
  }

  private resetRace() {
    const racers: Racer[] = [
      {
        name: "You",
        color: "#68e8a8",
        isPlayer: true,
        lapProgress: 0,
        lateral: 0,
        speed: 0.0001,
        steerHeld: 0,
        finished: false,
        finishMs: 0,
        boost: 0,
      },
      ...AI_RIVALS.map((r) => ({
        name: r.name,
        color: r.color,
        isPlayer: false,
        lapProgress: -0.02 - Math.random() * 0.04,
        lateral: (Math.random() - 0.5) * 0.3,
        speed: r.pace,
        steerHeld: 0,
        finished: false,
        finishMs: 0,
        boost: 0,
      })),
    ];

    const items: typeof this.race.items = [];
    for (let i = 0; i < 14; i++) {
      const kinds = ["turbo", "boot", "oil", "turbo", "boot"] as const;
      items.push({
        t: (i * 0.07 + 0.05) % 0.98,
        lateral: (i % 3) * 0.22 - 0.22,
        kind: kinds[i % kinds.length]!,
      });
    }

    this.race = {
      racers,
      track: this.track,
      items,
      score: 0,
      raceOver: false,
      playerPlace: 5,
    };
    this.pointerSteer = 0;
  }

  private resetAsteroids() {
    this.asteroids = {
      shipX: 0.5,
      score: 0,
      combo: 0,
      comboTimer: 0,
      wave: 1,
      waveTimer: 0,
      bullets: [],
      rocks: [],
      lives: 3,
    };
    this.spawnWave(1);
  }

  private spawnWave(n: number) {
    const count = Math.min(4 + n * 2, 14);
    for (let i = 0; i < count; i++) {
      this.asteroids.rocks.push({
        x: 0.08 + Math.random() * 0.84,
        y: -0.05 - Math.random() * 0.12,
        r: n >= 4 ? 38 : 32,
        tier: 0,
        vx: (Math.random() - 0.5) * 0.00012,
        vy: 0.00014 + Math.random() * 0.0001 + n * 0.00001,
        hp: n >= 4 ? 4 : 3,
        rot: Math.random() * Math.PI,
      });
    }
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
    this.jumpHeld = true;
    const now = performance.now();
    if (this.platform.onGround || now < this.coyoteUntil) {
      this.platform.vy = JUMP_VEL;
      this.platform.onGround = false;
    }
  }

  releaseJump() {
    this.jumpHeld = false;
    if (this.stage === "platform" && this.platform.vy < -4) {
      this.platform.vy *= 0.45;
    }
  }

  steer(dir: -1 | 1) {
    if (this.stage === "race") {
      this.pointerSteer = dir;
      const player = this.race.racers.find((r) => r.isPlayer);
      if (player) player.steerHeld = dir;
    }
    if (this.stage === "asteroids") {
      this.asteroids.shipX = Math.max(0.08, Math.min(0.92, this.asteroids.shipX + dir * 0.04));
    }
  }

  releaseSteer() {
    this.pointerSteer = 0;
    const player = this.race.racers.find((r) => r.isPlayer);
    if (player) player.steerHeld = 0;
  }

  boost(on: boolean) {
    if (this.stage !== "race") return;
    const player = this.race.racers.find((r) => r.isPlayer);
    if (player && on) player.boost = 1.35;
  }

  pointerDown(nx: number, ny: number, w: number, h: number) {
    const nxn = nx / w;
    const nyn = ny / h;

    if (this.stage === "platform") {
      this.jump();
      return;
    }
    if (this.stage === "race") {
      if (nx < w * 0.45) this.steer(-1);
      else if (nx > w * 0.55) this.steer(1);
      else this.boost(true);
      return;
    }
    if (this.stage === "asteroids") {
      this.asteroids.shipX = Math.max(0.08, Math.min(0.92, nxn));
      this.fireBullet(nxn, nyn);
    }
  }

  pointerUp() {
    this.releaseJump();
    this.releaseSteer();
    this.boost(false);
  }

  pointerMove(nx: number, w: number) {
    if (this.stage === "asteroids") {
      this.asteroids.shipX = Math.max(0.08, Math.min(0.92, nx / w));
    }
  }

  private fireBullet(tx: number, ty: number) {
    const sx = this.asteroids.shipX;
    const sy = 0.88;
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    const spd = 0.00095;
    this.asteroids.bullets.push({
      x: sx,
      y: sy,
      vx: (dx / len) * spd,
      vy: (dy / len) * spd,
      life: 1.4,
    });
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

  private respawnPlatform() {
    const p = this.platform;
    p.deaths += 1;
    p.score = Math.max(0, p.score - 80);
    p.x = Math.max(64, p.x - 180);
    p.y = 0;
    p.vy = 0;
  }

  private tickPlatform(dt: number, elapsed: number, now: number) {
    const p = this.platform;
    p.x += RUN_SPEED + dt * 0.0025;
    p.vy += GRAVITY;
    if (!this.jumpHeld && p.vy < 0) p.vy += GRAVITY * 0.35;
    p.y += p.vy;

    p.onGround = false;
    for (const plat of p.plats) {
      const feet = p.y;
      const head = p.y - 38;
      if (
        p.x + 12 > plat.x &&
        p.x - 12 < plat.x + plat.w &&
        feet >= plat.y - 4 &&
        head <= plat.y + plat.h &&
        p.vy >= 0
      ) {
        p.y = plat.y;
        p.vy = 0;
        p.onGround = true;
        this.coyoteUntil = now + COYOTE_MS;
      }
    }

    if (p.y > 160) {
      this.respawnPlatform();
    }

    p.cam = Math.max(0, p.x - PLAYER_SCREEN_X);

    for (const pick of p.pickups) {
      if (pick.taken) continue;
      if (Math.abs(p.x - pick.x) < 22 && Math.abs(p.y - pick.y) < 40) {
        pick.taken = true;
        p.score += pick.kind === "coin" ? 60 : 140;
      }
    }

    p.score += Math.floor(dt * 0.04);

    const timeLeft = Math.max(0, STAGE_MS.platform - elapsed);
    if (p.x >= GOAL_X) {
      p.score += 420 + Math.floor(timeLeft / 100);
      this.platform.score = p.score;
      this.advanceStage(now, "race");
    } else if (elapsed >= STAGE_MS.platform) {
      p.score += Math.floor(timeLeft / 200);
      this.platform.score = p.score;
      this.advanceStage(now, "race");
    }
  }

  private tickRacer(r: Racer, dt: number, elapsed: number, now: number, isPlayer: boolean) {
    if (r.finished) return;

    if (isPlayer) {
      r.lateral += r.steerHeld * dt * 0.00022;
      r.lateral = Math.max(-0.75, Math.min(0.75, r.lateral));
      const offTrack = Math.abs(r.lateral) > 0.55;
      const boostMul = r.boost > 1 ? 1.28 : 1;
      r.boost = Math.max(1, r.boost - dt * 0.0008);
      const base = 0.000108 * boostMul;
      r.speed = offTrack ? base * 0.72 : base;

      for (const item of this.race.items) {
        if (item.taken) continue;
        const dist = Math.abs(r.lapProgress % 1 - item.t);
        if (dist < 0.018 && Math.abs(r.lateral - item.lateral) < 0.12) {
          item.taken = true;
          if (item.kind === "turbo") {
            r.boost = 1.5;
            this.race.score += 80;
          } else if (item.kind === "boot") {
            this.race.score += 60;
            r.speed *= 1.15;
          } else {
            r.speed *= 0.55;
            this.race.score = Math.max(0, this.race.score - 25);
          }
        }
      }
    } else {
      r.lateral += (Math.sin(elapsed * 0.0012 + r.lapProgress * 12) * 0.5 - r.lateral) * dt * 0.00008;
      r.speed = r.speed * 0.92 + AI_RIVALS.find((a) => a.name === r.name)!.pace * 0.08;
      if (r.lateral > 0.5) r.speed *= 0.9;
    }

    r.lapProgress += r.speed * dt;
    if (r.lapProgress >= LAP_COUNT) {
      r.finished = true;
      r.finishMs = elapsed;
      r.lapProgress = LAP_COUNT;
    }
  }

  private tickRace(dt: number, elapsed: number, now: number) {
    if (this.race.raceOver) return;

    for (const r of this.race.racers) {
      this.tickRacer(r, dt, elapsed, now, r.isPlayer);
    }

    const ranked = racerRank(this.race.racers);
    const player = this.race.racers.find((r) => r.isPlayer)!;
    this.race.playerPlace = ranked.indexOf(player) + 1;

    this.race.score += Math.floor(dt * 0.05);

    const allDone = this.race.racers.every((r) => r.finished);
    const playerDone = player.finished;

    if (allDone || elapsed >= STAGE_MS.race) {
      const place = this.race.playerPlace;
      const placePts = [1100, 900, 700, 500, 300][place - 1] ?? 200;
      const lapFrac = Math.min(LAP_COUNT, player.lapProgress);
      const lapPts = Math.floor(lapFrac * 280);
      const timeBonus = Math.floor(Math.max(0, STAGE_MS.race - elapsed) / 120);
      this.race.score += placePts + lapPts + timeBonus;
      if (place === 1) this.race.score += 200;
      this.race.raceOver = true;
      this.advanceStage(now, "asteroids");
    } else if (playerDone && elapsed > 14_000) {
      const place = this.race.playerPlace;
      this.race.score += [1100, 900, 700, 500, 300][place - 1] ?? 200;
      this.race.score += Math.floor(player.lapProgress * 280);
      this.race.raceOver = true;
      this.advanceStage(now, "asteroids");
    }
  }

  private splitRock(s: Asteroid, i: number) {
    const pts = s.tier === 0 ? 100 : s.tier === 1 ? 55 : 30;
    const mult = 1 + Math.min(4, this.asteroids.combo) * 0.15;
    this.asteroids.score += Math.floor(pts * mult);
    this.asteroids.combo += 1;
    this.asteroids.comboTimer = 2200;

    this.asteroids.rocks.splice(i, 1);
    if (s.tier < 2) {
      const child: 1 | 2 = (s.tier + 1) as 1 | 2;
      const cr = child === 1 ? 22 : 12;
      this.asteroids.rocks.push({
        x: s.x - 0.03,
        y: s.y,
        r: cr,
        tier: child,
        vx: -0.0001,
        vy: s.vy * 0.9,
        hp: child === 1 ? 2 : 1,
        rot: s.rot,
      });
      this.asteroids.rocks.push({
        x: s.x + 0.03,
        y: s.y,
        r: cr,
        tier: child,
        vx: 0.0001,
        vy: s.vy * 0.9,
        hp: child === 1 ? 2 : 1,
        rot: s.rot + 0.5,
      });
    }
  }

  private tickAsteroids(dt: number, elapsed: number, now: number) {
    const a = this.asteroids;

    if (a.comboTimer > 0) a.comboTimer -= dt;
    else a.combo = 0;

    a.waveTimer += dt;
    if (a.waveTimer > 7500 && elapsed < STAGE_MS.asteroids - 4000) {
      a.wave += 1;
      a.waveTimer = 0;
      a.score += 40 + a.wave * 15;
      this.spawnWave(a.wave);
      this.subBanner = `Wave ${a.wave} — break the veil`;
    }

    a.bullets = a.bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt * 0.001;
      return b.life > 0 && b.y > 0.04 && b.x > 0.02 && b.x < 0.98;
    });

    for (const s of a.rocks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += dt * 0.0004;
      if (s.x < 0.04 || s.x > 0.96) s.vx *= -1;
    }

    for (let bi = a.bullets.length - 1; bi >= 0; bi--) {
      const b = a.bullets[bi]!;
      for (let ri = a.rocks.length - 1; ri >= 0; ri--) {
        const s = a.rocks[ri]!;
        const dx = (b.x - s.x) * 520;
        const dy = (b.y - s.y) * 420;
        if (Math.hypot(dx, dy) < s.r * 0.9) {
          s.hp -= 1;
          a.bullets.splice(bi, 1);
          if (s.hp <= 0) this.splitRock(s, ri);
          break;
        }
      }
    }

    for (let ri = a.rocks.length - 1; ri >= 0; ri--) {
      const s = a.rocks[ri]!;
      if (s.y > 0.94) {
        a.rocks.splice(ri, 1);
        a.lives -= 1;
        a.combo = 0;
        a.score = Math.max(0, a.score - 40);
        if (a.lives <= 0) {
          a.score = Math.max(0, a.score - 100);
          a.lives = 2;
        }
      }
    }

    if (a.rocks.length === 0 && elapsed < STAGE_MS.asteroids - 3000) {
      a.waveTimer = 7000;
    }

    a.score += Math.floor(dt * 0.03);

    if (elapsed >= STAGE_MS.asteroids) {
      a.score += a.lives * 80 + a.wave * 35;
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
    else if (this.stage === "race") this.drawRace(ctx, w, h, now);
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
    ctx.fillText(this.subBanner.slice(0, 40), 10, 28);

    if (this.stage === "race" && !this.race.raceOver) {
      const player = this.race.racers.find((r) => r.isPlayer)!;
      const lap = Math.min(LAP_COUNT, Math.floor(player.lapProgress) + 1);
      ctx.fillStyle = "#f8f0ff";
      ctx.fillText(`LAP ${lap}/${LAP_COUNT}  P${this.race.playerPlace}/5`, w * 0.32, 14);
    }

    if (this.stage === "asteroids") {
      ctx.fillStyle = "#f8f0ff";
      ctx.fillText(`W${this.asteroids.wave} ♥${this.asteroids.lives}`, w * 0.34, 14);
      if (this.asteroids.combo > 1) {
        ctx.fillStyle = "#e87850";
        ctx.fillText(`x${this.asteroids.combo}`, w * 0.52, 14);
      }
    }

    if (timeLeft > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#68b8a8";
      ctx.fillText(`${timeLeft.toFixed(1)}s`, w - 10, 18);
      ctx.textAlign = "left";
    }

    const live =
      (this.stage === "platform" ? this.platform.score : 0) +
      (this.stage !== "platform" && this.stage !== "brief" ? this.result.platform : 0) +
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
    ctx.fillRect(w * 0.1, h * 0.2, w * 0.8, h * 0.48);
    ctx.strokeStyle = "#e8b050";
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.1, h * 0.2, w * 0.8, h * 0.48);
    ctx.fillStyle = "#e8b050";
    ctx.font = `${Math.max(10, w * 0.02)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("⚔ DEMPLAR WARRIOR", w / 2, h * 0.32);
    ctx.fillStyle = "#98b8e8";
    ctx.font = `${Math.max(7, w * 0.011)}px "Press Start 2P", monospace`;
    ctx.fillText(pickLine(warriorBriefLines), w / 2, h * 0.42);
    ctx.fillStyle = "#68b8a8";
    ctx.font = `${Math.max(6, w * 0.009)}px "Press Start 2P", monospace`;
    ctx.fillText("I RUN  ·  II 2-LAP RACE vs 4  ·  III SHOOT", w / 2, h * 0.52);
    ctx.fillStyle = "rgba(232, 176, 80, 0.65)";
    ctx.fillText("REACH THE GATE · BEAT THE CLOCK", w / 2, h * 0.6);
    ctx.textAlign = "left";
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const groundY = h * 0.72;
    const p = this.platform;
    const cam = p.cam;

    const grad = ctx.createLinearGradient(0, 36, 0, h);
    grad.addColorStop(0, "#1a2848");
    grad.addColorStop(1, "#0a1428");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 36, w, h - 36);

    for (let i = 0; i < 30; i++) {
      const px = ((i * 64 - cam * 0.25) % (w + 64)) - 32;
      ctx.fillStyle = i % 2 ? "#243858" : "#1a2840";
      ctx.fillRect(px, groundY + 24, 64, h);
    }

    for (const plat of p.plats) {
      const sx = plat.x - cam;
      if (sx < -120 || sx > w + 120) continue;
      ctx.fillStyle = "#5a3820";
      ctx.fillRect(sx, groundY + plat.y, plat.w, plat.h);
      ctx.fillStyle = "#3d2818";
      ctx.fillRect(sx + 4, groundY + plat.y + 4, plat.w - 8, plat.h - 8);
      ctx.strokeStyle = "#e8b050";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, groundY + plat.y, plat.w, plat.h);
    }

    for (const pick of p.pickups) {
      if (pick.taken) continue;
      const sx = pick.x - cam;
      if (sx < -24 || sx > w + 24) continue;
      if (pick.kind === "coin") {
        ctx.fillStyle = "#e8b050";
        ctx.beginPath();
        ctx.arc(sx, groundY + pick.y - 8, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f8f0c0";
        ctx.stroke();
      } else {
        ctx.fillStyle = "#98b8e8";
        ctx.fillRect(sx - 8, groundY + pick.y - 22, 16, 20);
        ctx.fillStyle = "#e8b050";
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = "center";
        ctx.fillText("†", sx, groundY + pick.y - 8);
        ctx.textAlign = "left";
      }
    }

    const px = p.x - cam;
    const py = groundY + p.y;
    ctx.fillStyle = "#68b8a8";
    ctx.fillRect(px - 11, py - 32, 22, 32);
    ctx.fillStyle = "#e8b050";
    ctx.fillRect(px - 14, py - 40, 28, 10);
    ctx.fillStyle = "#f8f0ff";
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText("D", px - 4, py - 44);

    const gx = GOAL_X - cam;
    if (gx > -20 && gx < w + 60) {
      ctx.fillStyle = "#e8b050";
      ctx.fillRect(gx, groundY - 88, 6, 88);
      ctx.fillStyle = "#c87878";
      ctx.fillRect(gx - 18, groundY - 96, 42, 28);
      ctx.fillStyle = "#f8f0ff";
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText("GATE", gx - 10, groundY - 102);
    }

    const prog = Math.min(1, p.x / GOAL_X);
    ctx.fillStyle = "#1a222c";
    ctx.fillRect(12, h - 22, w - 24, 8);
    ctx.fillStyle = "#68b8a8";
    ctx.fillRect(12, h - 22, (w - 24) * prog, 8);

    ctx.fillStyle = "rgba(248,240,255,0.7)";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("TAP / SPACE — JUMP (hold higher)", w / 2, h - 28);
    ctx.textAlign = "left";
  }

  private drawRace(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const playTop = 40;
    const playH = h - playTop - 8;

    ctx.fillStyle = "#1a2818";
    ctx.fillRect(0, playTop, w, playH);
    ctx.fillStyle = "#2a3828";
    for (let i = 0; i < 12; i++) {
      ctx.fillRect((i * 47) % w, playTop + 20 + (i % 3) * 40, 32, 24);
    }

    const track = this.race.track;
    const steps = 120;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const half of [-1, 1]) {
      ctx.strokeStyle = half < 0 ? "#2a4038" : "#3a5848";
      ctx.lineWidth = 38;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const { x, y, angle } = trackAt(t, track);
        const px = x * w + Math.cos(angle + Math.PI / 2) * TRACK_HALF_W * w * half;
        const py = playTop + y * playH + Math.sin(angle + Math.PI / 2) * TRACK_HALF_W * playH * half;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.strokeStyle = "#e8b050";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const { x, y } = trackAt(t, track);
      const px = x * w;
      const py = playTop + y * playH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const start = trackAt(0, track);
    ctx.fillStyle = "rgba(248,240,255,0.85)";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText("START", start.x * w - 16, playTop + start.y * playH - 12);

    for (const item of this.race.items) {
      if (item.taken) continue;
      const { x, y, angle } = trackAt(item.t, track);
      const px = x * w + Math.cos(angle + Math.PI / 2) * item.lateral * w * 0.09;
      const py = playTop + y * playH + Math.sin(angle + Math.PI / 2) * item.lateral * playH * 0.09;
      ctx.fillStyle = item.kind === "turbo" ? "#e87850" : item.kind === "boot" ? "#98b8e8" : "#2a1810";
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    const ranked = racerRank(this.race.racers);
    ranked.forEach((r, idx) => {
      const frac = ((r.lapProgress % 1) + 1) % 1;
      const { x, y, angle } = trackAt(frac, track);
      const px =
        x * w + Math.cos(angle + Math.PI / 2) * r.lateral * w * TRACK_HALF_W * 2.2;
      const py =
        playTop + y * playH + Math.sin(angle + Math.PI / 2) * r.lateral * playH * TRACK_HALF_W * 2.2;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.fillStyle = r.isPlayer ? "#68e8a8" : r.color;
      ctx.fillRect(-12, -7, 24, 14);
      ctx.fillStyle = "#1a1810";
      ctx.fillRect(4, -5, 8, 10);
      ctx.restore();

      ctx.fillStyle = r.isPlayer ? "#f8f0ff" : "rgba(248,240,255,0.7)";
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText(r.isPlayer ? "YOU" : String(idx + 1), px, py - 12);
      ctx.textAlign = "left";
    });

    ctx.fillStyle = "rgba(248,240,255,0.7)";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("L/R STEER · CENTER BOOST · 2 LAPS vs 4 RIVALS", w / 2, h - 12);
    ctx.textAlign = "left";
  }

  private drawAsteroids(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const playTop = 40;
    ctx.fillStyle = "#080818";
    ctx.fillRect(0, playTop, w, h - playTop);

    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(248,240,255,${0.12 + (i % 4) * 0.06})`;
      ctx.fillRect((i * 73) % w, playTop + ((i * 41) % (h - playTop - 40)), 2, 2);
    }

    for (const b of this.asteroids.bullets) {
      ctx.fillStyle = "#e8b050";
      ctx.beginPath();
      ctx.arc(b.x * w, playTop + b.y * (h - playTop), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of this.asteroids.rocks) {
      const col = s.tier === 0 ? "#6a5878" : s.tier === 1 ? "#8a7898" : "#aab0c8";
      const sx = s.x * w;
      const sy = playTop + s.y * (h - playTop);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(s.rot);
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rr = s.r * (0.85 + (i % 2) * 0.15);
        const vx = Math.cos(a) * rr;
        const vy = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#e8b050";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    const shipX = this.asteroids.shipX * w;
    const shipY = h - 28;
    ctx.fillStyle = "#68e8a8";
    ctx.beginPath();
    ctx.moveTo(shipX, shipY - 22);
    ctx.lineTo(shipX - 14, shipY);
    ctx.lineTo(shipX + 14, shipY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e8b050";
    ctx.fillRect(shipX - 4, shipY - 8, 8, 8);

    ctx.fillStyle = "rgba(248,240,255,0.7)";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("DRAG SHIP · TAP TO SHOOT · SURVIVE WAVES", w / 2, h - 10);
    ctx.textAlign = "left";
  }

  private drawDone(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = "#e8b050";
    ctx.font = `${Math.max(9, w * 0.018)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("CHARTER TRIAL COMPLETE", w / 2, h * 0.34);
    ctx.fillStyle = "#f8f0ff";
    ctx.font = `${Math.max(7, w * 0.011)}px "Press Start 2P", monospace`;
    ctx.fillText(`RUN ${this.result.platform}`, w / 2, h * 0.44);
    ctx.fillText(`CIRCUIT P${this.race.playerPlace} · ${this.result.race}`, w / 2, h * 0.5);
    ctx.fillText(`SHARDS ${this.result.asteroids}`, w / 2, h * 0.56);
    ctx.fillStyle = "#68e8a8";
    ctx.fillText(`TOTAL ${this.result.total}`, w / 2, h * 0.64);
    ctx.textAlign = "left";
  }

  hint(): string {
    if (this.stage === "platform") return "Jump gaps — reach the GATE before time runs out";
    if (this.stage === "race") {
      const p = this.race.playerPlace;
      return `Lap race vs 4 rivals — you are P${p}/5`;
    }
    if (this.stage === "asteroids") return `Wave ${this.asteroids.wave} — shoot shards, guard your lives`;
    return "Demplar Warrior — three charter trials";
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
