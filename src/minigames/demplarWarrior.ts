/**
 * Demplar Warrior — three charter trials with real mechanics:
 * I  Sargaano Sprint — side-scroll platformer (fixed cam, gaps, variable jump)
 * II Corsus Circuit — waypoint track, 2 laps, you vs 4 rivals + clock
 * III Veil Shards — ship shooter, waves, combos, 42s survival
 */

import { warriorBriefLines, warriorTrialNames } from "../content/demplarKnights";
import { pickLine } from "../content/arcaneLore";
import { playWarriorImpact } from "../audio/warriorSfx";
import { drawKnightFlyer, drawKnightPlatformer, drawKnightPortrait, drawKnightRacer } from "../sprites/knightSprite";
import {
  drawRaceBoostPad,
  drawRaceSteeringWheel,
  hitRaceBoost,
  hitRaceWheel,
  MAX_TURN,
  raceWheelLayout,
  steerFromWheelPointer,
} from "./raceSteeringWheel";

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

const BRIEF_CHUNK_CHARS = 8;
const BRIEF_LINE_STAGGER_MS = 680;
const BRIEF_LINE_FLY_MS = 420;
/** h wonder / PROMPTME: never ship illegible canvas type (Press Start 2P sub-12px). */
const BRIEF_MIN_FONT_PX = 26;
const BRIEF_MAX_FONT_PX = 36;

type BriefLine = { text: string; color: string; fontScale: number; title?: boolean };

function briefFont(line: BriefLine, px: number): string {
  const size = Math.max(BRIEF_MIN_FONT_PX, Math.round(px * line.fontScale));
  if (line.title) {
    return `600 ${size}px "Pixelify Sans", sans-serif`;
  }
  return `${size}px "VT323", monospace`;
}

function briefBaseFontPx(w: number, h: number): number {
  const short = Math.min(w, h);
  return Math.max(
    BRIEF_MIN_FONT_PX,
    Math.min(BRIEF_MAX_FONT_PX, Math.floor(short * 0.062), Math.floor(w * 0.078)),
  );
}

function warriorHintFont(w: number): string {
  const px = Math.max(16, Math.min(22, Math.floor(w * 0.042)));
  return `${px}px "VT323", monospace`;
}

function buildBriefLines(lore: string): BriefLine[] {
  return [
    { text: "DEMPLAR WARRIOR", color: "#e8b050", fontScale: 1.18, title: true },
    { text: lore, color: "#d8e4f8", fontScale: 1.05 },
    { text: "SPRINT · CIRCUIT · VEIL SHARDS", color: "#78d0b8", fontScale: 1 },
    { text: "REACH THE GATE", color: "#e8b050", fontScale: 1 },
  ];
}

function wrapBriefLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

const LAP_COUNT = 2;
const PLAYER_SCREEN_X = 148;
const RUN_SPEED = 4.85;
const GRAVITY = 0.58;
const JUMP_VEL = -12.8;
const COYOTE_MS = 110;
const TRACK_HALF_W = 0.042;

const ASTEROID_WAVE_MS = 9000;
const ASTEROID_SPAWN_GAP_START = 1700;
const ASTEROID_SPAWN_GAP_MIN = 1000;
const ASTEROID_FIRST_SPAWN_MS = 900;

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
const WARRIOR_HUD_H = 44;

/** Sargaano charter causeway — parallax props (no collision). */
type SargaanoProp = { x: number; y: number; kind: "banner" | "torch" | "pillar" | "well" | "swords" };
const SARGAANO_PROPS: SargaanoProp[] = [
  { x: 120, y: 0, kind: "banner" },
  { x: 400, y: 0, kind: "torch" },
  { x: 780, y: -36, kind: "pillar" },
  { x: 1050, y: -72, kind: "swords" },
  { x: 1350, y: -36, kind: "banner" },
  { x: 1680, y: 0, kind: "well" },
  { x: 2050, y: 0, kind: "torch" },
  { x: 2480, y: -96, kind: "pillar" },
  { x: 2850, y: -48, kind: "banner" },
  { x: 3180, y: 0, kind: "swords" },
  { x: 3480, y: 0, kind: "torch" },
];

const SARGAANO = {
  skyTop: "#120818",
  skyMid: "#281838",
  skyLow: "#3a2848",
  veil: "#c87878",
  moon: "#d8dce8",
  stone: "#3a3048",
  stoneDark: "#221830",
  stoneCap: "#4a3858",
  mortar: "#1a1420",
  gold: "#e8b050",
  goldDim: "#a87830",
  charter: "#9890c8",
  mist: "rgba(152, 144, 200, 0.18)",
} as const;

function drawSargaanoSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundY: number,
  cam: number,
  tick: number,
) {
  const top = WARRIOR_HUD_H;
  const grad = ctx.createLinearGradient(0, top, 0, groundY);
  grad.addColorStop(0, SARGAANO.skyTop);
  grad.addColorStop(0.45, SARGAANO.skyMid);
  grad.addColorStop(1, SARGAANO.skyLow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, w, groundY - top);

  for (let i = 0; i < 36; i++) {
    const sx = ((i * 97 + 13) % (w + 40)) - 20;
    const sy = top + 12 + ((i * 53) % Math.floor((groundY - top) * 0.55));
    ctx.fillStyle = i % 5 === 0 ? "rgba(232, 176, 80, 0.55)" : "rgba(220, 228, 240, 0.35)";
    ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, 1);
  }

  const moonX = w * 0.78 - cam * 0.04;
  const moonY = top + (groundY - top) * 0.14;
  ctx.fillStyle = "rgba(200, 210, 230, 0.08)";
  ctx.beginPath();
  ctx.arc(moonX, moonY, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SARGAANO.moon;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9aa8b8";
  ctx.fillRect(moonX - 6, moonY - 2, 10, 8);

  const bleed = 0.35 + Math.sin(tick * 0.002) * 0.12;
  const veilGrad = ctx.createLinearGradient(0, groundY - 120, 0, groundY);
  veilGrad.addColorStop(0, "rgba(200, 120, 120, 0)");
  veilGrad.addColorStop(1, `rgba(200, 120, 120, ${bleed * 0.35})`);
  ctx.fillStyle = veilGrad;
  ctx.fillRect(0, groundY - 120, w, 120);

  const hallX = w * 0.5 - cam * 0.08;
  const hallBase = groundY - 8;
  ctx.fillStyle = "rgba(10, 8, 18, 0.72)";
  ctx.fillRect(hallX - 90, hallBase - 72, 180, 72);
  ctx.fillRect(hallX - 70, hallBase - 98, 140, 28);
  ctx.fillStyle = "rgba(232, 176, 80, 0.22)";
  ctx.fillRect(hallX - 62, hallBase - 94, 124, 4);
  for (let i = -1; i <= 1; i++) {
    ctx.fillStyle = "rgba(72, 48, 88, 0.55)";
    ctx.fillRect(hallX + i * 52 - 8, hallBase - 72, 16, 72);
  }
  ctx.fillStyle = SARGAANO.mist;
  ctx.fillRect(0, groundY - 48, w, 48);
}

function drawSargaanoProp(
  ctx: CanvasRenderingContext2D,
  prop: SargaanoProp,
  sx: number,
  groundY: number,
  tick: number,
) {
  const py = groundY + prop.y;
  const sway = Math.sin(tick * 0.003 + prop.x * 0.01) * 3;

  switch (prop.kind) {
    case "pillar": {
      ctx.fillStyle = SARGAANO.stoneDark;
      ctx.fillRect(sx - 10, py - 88, 20, 88);
      ctx.fillStyle = SARGAANO.goldDim;
      ctx.fillRect(sx - 12, py - 92, 24, 6);
      ctx.fillStyle = SARGAANO.charter;
      ctx.fillRect(sx - 4, py - 78, 8, 8);
      break;
    }
    case "torch": {
      const flicker = 0.7 + Math.sin(tick * 0.02 + prop.x) * 0.3;
      ctx.fillStyle = SARGAANO.stoneDark;
      ctx.fillRect(sx - 4, py - 36, 8, 36);
      ctx.fillStyle = `rgba(232, 176, 80, ${0.35 * flicker})`;
      ctx.beginPath();
      ctx.arc(sx, py - 42, 10 * flicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(200, 120, 80, ${0.55 * flicker})`;
      ctx.fillRect(sx - 3, py - 48, 6, 10);
      break;
    }
    case "banner": {
      ctx.fillStyle = SARGAANO.stoneDark;
      ctx.fillRect(sx - 3, py - 64, 6, 64);
      ctx.fillStyle = "#583868";
      ctx.fillRect(sx + sway, py - 58, 22, 34);
      ctx.fillStyle = SARGAANO.gold;
      ctx.fillRect(sx + sway + 2, py - 54, 18, 3);
      ctx.font = '7px "VT323", monospace';
      ctx.fillStyle = SARGAANO.gold;
      ctx.textAlign = "center";
      ctx.fillText("⚔", sx + sway + 11, py - 38);
      ctx.textAlign = "left";
      break;
    }
    case "swords": {
      ctx.fillStyle = SARGAANO.stoneDark;
      ctx.fillRect(sx - 14, py - 28, 28, 28);
      ctx.fillStyle = SARGAANO.gold;
      ctx.fillRect(sx - 10, py - 22, 4, 18);
      ctx.fillRect(sx + 6, py - 22, 4, 18);
      ctx.fillStyle = "#c8d8e8";
      ctx.fillRect(sx - 12, py - 24, 8, 3);
      ctx.fillRect(sx + 4, py - 24, 8, 3);
      break;
    }
    case "well": {
      ctx.fillStyle = SARGAANO.stoneDark;
      ctx.fillRect(sx - 18, py - 12, 36, 12);
      ctx.fillStyle = "#1a4858";
      ctx.beginPath();
      ctx.ellipse(sx, py - 14, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = SARGAANO.goldDim;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(136, 200, 184, 0.35)";
      ctx.beginPath();
      ctx.ellipse(sx - 3, py - 15, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

function drawCharterPlat(
  ctx: CanvasRenderingContext2D,
  sx: number,
  groundY: number,
  plat: Plat,
  platIndex: number,
) {
  const py = groundY + plat.y;
  const tileW = 32;
  const tiles = Math.ceil(plat.w / tileW);

  for (let t = 0; t < tiles; t++) {
    const tx = sx + t * tileW;
    const tw = Math.min(tileW, plat.w - t * tileW);
    if (tw <= 0) continue;

    ctx.fillStyle = SARGAANO.stoneDark;
    ctx.fillRect(tx, py + 6, tw, plat.h - 6);
    ctx.fillStyle = (t + platIndex) % 2 === 0 ? SARGAANO.stone : SARGAANO.stoneCap;
    ctx.fillRect(tx + 1, py + 4, tw - 2, plat.h - 8);
    ctx.fillStyle = SARGAANO.mortar;
    ctx.fillRect(tx, py + plat.h - 4, tw, 2);

    ctx.fillStyle = SARGAANO.goldDim;
    ctx.fillRect(tx, py, tw, 4);
    ctx.fillStyle = SARGAANO.gold;
    ctx.fillRect(tx + 2, py, tw - 4, 2);

    if (t === 0 || t === tiles - 1) {
      ctx.fillStyle = SARGAANO.charter;
      ctx.fillRect(tx + 4, py - 10, tw - 8, 8);
      ctx.fillStyle = SARGAANO.gold;
      ctx.fillRect(tx + 6, py - 8, tw - 12, 2);
    }
  }

  if (platIndex % 3 === 1 && plat.w > 80) {
    ctx.font = '8px "VT323", monospace';
    ctx.fillStyle = SARGAANO.gold;
    ctx.textAlign = "center";
    ctx.fillText("⚔", sx + plat.w / 2, py - 2);
    ctx.textAlign = "left";
  }

  ctx.strokeStyle = "rgba(232, 176, 80, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(sx, py, plat.w, plat.h);
}

function drawCharterPickup(
  ctx: CanvasRenderingContext2D,
  sx: number,
  groundY: number,
  pick: Pickup,
  tick: number,
) {
  const bob = Math.sin(tick * 0.006 + pick.x * 0.02) * 4;
  const py = groundY + pick.y - 8 + bob;

  if (pick.kind === "coin") {
    ctx.fillStyle = "rgba(232, 176, 80, 0.25)";
    ctx.beginPath();
    ctx.arc(sx, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SARGAANO.gold;
    ctx.beginPath();
    ctx.arc(sx, py, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f8f0c0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '10px "VT323", monospace';
    ctx.fillStyle = SARGAANO.stoneDark;
    ctx.textAlign = "center";
    ctx.fillText("◎", sx, py + 4);
    ctx.textAlign = "left";
  } else {
    ctx.fillStyle = "rgba(152, 144, 200, 0.35)";
    ctx.fillRect(sx - 10, py - 20, 20, 24);
    ctx.fillStyle = SARGAANO.charter;
    ctx.fillRect(sx - 8, py - 18, 16, 20);
    ctx.fillStyle = SARGAANO.gold;
    ctx.fillRect(sx - 6, py - 16, 12, 3);
    ctx.font = '12px "VT323", monospace';
    ctx.fillStyle = SARGAANO.gold;
    ctx.textAlign = "center";
    ctx.fillText("†", sx, py - 2);
    ctx.textAlign = "left";
  }
}

function drawCharterGate(ctx: CanvasRenderingContext2D, gx: number, groundY: number, tick: number) {
  const glow = 0.55 + Math.sin(tick * 0.004) * 0.2;
  ctx.fillStyle = SARGAANO.stoneDark;
  ctx.fillRect(gx - 28, groundY - 108, 18, 108);
  ctx.fillRect(gx + 16, groundY - 108, 18, 108);
  ctx.fillStyle = SARGAANO.stone;
  ctx.fillRect(gx - 26, groundY - 112, 14, 8);
  ctx.fillRect(gx + 18, groundY - 112, 14, 8);

  ctx.fillStyle = `rgba(232, 176, 80, ${glow})`;
  ctx.fillRect(gx - 8, groundY - 96, 34, 6);
  ctx.fillRect(gx - 8, groundY - 72, 34, 4);

  ctx.fillStyle = "rgba(10, 8, 18, 0.55)";
  ctx.fillRect(gx - 6, groundY - 90, 30, 90);

  ctx.strokeStyle = SARGAANO.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gx - 6, groundY - 90);
  ctx.lineTo(gx + 8, groundY - 108);
  ctx.lineTo(gx + 22, groundY - 90);
  ctx.stroke();

  ctx.font = '10px "VT323", monospace';
  ctx.fillStyle = SARGAANO.gold;
  ctx.textAlign = "center";
  ctx.fillText("CHARTER", gx + 8, groundY - 98);
  ctx.fillText("GATE", gx + 8, groundY - 86);
  ctx.textAlign = "left";
}

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
  private raceControls = {
    wheelAngle: 0,
    wheelDragging: false,
    boostHeld: false,
  };

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
    lastSpawnElapsed: 0,
    spawnGap: ASTEROID_SPAWN_GAP_START,
    bullets: [] as Bullet[],
    rocks: [] as Asteroid[],
    lives: 3,
  };

  result: DemplarRunResult = { total: 0, platform: 0, race: 0, asteroids: 0 };

  private briefLines = buildBriefLines(pickLine(warriorBriefLines));
  private briefDisplayLines: BriefLine[] = [];
  private briefLayoutW = 0;
  private briefLayoutH = 0;
  private briefBasePx = BRIEF_MIN_FONT_PX;
  private briefLineH = 22;
  private briefImpacted = new Set<number>();

  /** QA hook — smoke tests assert readable brief typography. */
  getBriefMetrics(): { basePx: number; lineH: number; rowCount: number; minFontPx: number } {
    const minFontPx = Math.max(
      BRIEF_MIN_FONT_PX,
      ...this.briefLines.map((line) => Math.round(this.briefBasePx * line.fontScale)),
    );
    return {
      basePx: this.briefBasePx,
      lineH: this.briefLineH,
      rowCount: this.briefDisplayLines.length,
      minFontPx,
    };
  }

  private briefDurationMs(): number {
    const rows = this.briefDisplayLines.length || this.briefLines.length;
    return Math.max(STAGE_MS.brief, rows * BRIEF_LINE_STAGGER_MS + BRIEF_LINE_FLY_MS + 900);
  }

  private layoutBriefLines(ctx: CanvasRenderingContext2D, w: number, h: number, basePx?: number): BriefLine[] {
    const px = basePx ?? briefBaseFontPx(w, h);
    const maxW = w * 0.86;
    const out: BriefLine[] = [];
    for (const line of this.briefLines) {
      ctx.font = briefFont(line, px);
      for (const row of wrapBriefLine(ctx, line.text, maxW)) {
        out.push({ ...line, text: row });
      }
    }
    return out;
  }

  private syncBriefLayout(ctx: CanvasRenderingContext2D, w: number, h: number): BriefLine[] {
    if (
      this.briefDisplayLines.length &&
      Math.abs(w - this.briefLayoutW) < 12 &&
      Math.abs(h - this.briefLayoutH) < 16
    ) {
      return this.briefDisplayLines;
    }
    this.briefLayoutW = w;
    this.briefLayoutH = h;
    const basePx = briefBaseFontPx(w, h);
    const rows = this.layoutBriefLines(ctx, w, h, basePx);
    const lineH = Math.max(BRIEF_MIN_FONT_PX + 8, Math.round(basePx * 1.34));
    this.briefBasePx = basePx;
    this.briefLineH = lineH;
    this.briefDisplayLines = rows;
    return rows;
  }

  constructor() {
    this.resetPlatform();
    this.resetRace();
    this.resetAsteroids();
    this.stageStarted = performance.now();
    const probe = document.createElement("canvas");
    const probeCtx = probe.getContext("2d");
    if (probeCtx) {
      this.briefDisplayLines = this.layoutBriefLines(probeCtx, 520, 420);
      this.briefLayoutW = 520;
      this.briefLayoutH = 420;
      this.briefBasePx = briefBaseFontPx(520, 420);
      this.briefLineH = Math.round(this.briefBasePx * 1.28);
    } else {
      this.briefDisplayLines = [...this.briefLines];
    }
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
    this.raceControls = { wheelAngle: 0, wheelDragging: false, boostHeld: false };
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
      lastSpawnElapsed: -ASTEROID_FIRST_SPAWN_MS,
      spawnGap: ASTEROID_SPAWN_GAP_START,
      bullets: [],
      rocks: [],
      lives: 3,
    };
  }

  private maxRocksOnScreen(wave: number): number {
    return Math.min(2 + wave, 7);
  }

  private spawnOneRock(wave: number) {
    this.asteroids.rocks.push({
      x: 0.1 + Math.random() * 0.8,
      y: -0.08 - Math.random() * 0.22,
      r: wave >= 5 ? 36 : wave >= 3 ? 34 : 32,
      tier: 0,
      vx: (Math.random() - 0.5) * 0.00009,
      vy: 0.00009 + Math.random() * 0.000055 + wave * 0.000007,
      hp: wave >= 5 ? 4 : 3,
      rot: Math.random() * Math.PI,
    });
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
      if (player) {
        player.steerHeld = dir;
        this.raceControls.wheelAngle = dir * MAX_TURN;
      }
    }
    if (this.stage === "asteroids") {
      this.asteroids.shipX = Math.max(0.08, Math.min(0.92, this.asteroids.shipX + dir * 0.04));
    }
  }

  releaseSteer() {
    this.pointerSteer = 0;
    if (this.stage === "race" && !this.raceControls.wheelDragging) {
      const player = this.race.racers.find((r) => r.isPlayer);
      if (player) player.steerHeld = 0;
      this.raceControls.wheelAngle = 0;
      return;
    }
    const player = this.race.racers.find((r) => r.isPlayer);
    if (player) player.steerHeld = 0;
  }

  private applyWheelSteer(steer: number) {
    const player = this.race.racers.find((r) => r.isPlayer);
    if (!player) return;
    player.steerHeld = steer;
    this.raceControls.wheelAngle = steer * MAX_TURN;
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
      const layout = raceWheelLayout(w, h);
      if (hitRaceBoost(nx, ny, layout)) {
        this.raceControls.boostHeld = true;
        this.boost(true);
        return;
      }
      if (hitRaceWheel(nx, ny, layout)) {
        this.raceControls.wheelDragging = true;
        this.applyWheelSteer(steerFromWheelPointer(nx, ny, layout));
        return;
      }
      return;
    }
    if (this.stage === "asteroids") {
      this.asteroids.shipX = Math.max(0.08, Math.min(0.92, nxn));
      this.fireBullet(nxn, nyn);
    }
  }

  pointerUp() {
    this.releaseJump();
    if (this.stage === "race") {
      this.raceControls.wheelDragging = false;
      this.raceControls.boostHeld = false;
      this.boost(false);
      this.releaseSteer();
      return;
    }
    this.releaseSteer();
    this.boost(false);
  }

  pointerMove(nx: number, ny: number, w: number, h: number) {
    if (this.stage === "race" && this.raceControls.wheelDragging) {
      const layout = raceWheelLayout(w, h);
      this.applyWheelSteer(steerFromWheelPointer(nx, ny, layout));
      return;
    }
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

    if (this.stage === "brief") {
      this.tickBriefImpacts(elapsed, this.briefDisplayLines);
      if (elapsed > this.briefDurationMs()) {
        this.advanceStage(now, "platform");
        return;
      }
      return;
    }

    if (this.stage === "platform") this.tickPlatform(dt, elapsed, now);
    if (this.stage === "race") this.tickRace(dt, elapsed, now);
    if (this.stage === "asteroids") this.tickAsteroids(dt, elapsed, now);
  }

  private impactSlotsBefore(lineIndex: number, rows: BriefLine[]): number {
    let n = 0;
    for (let i = 0; i < lineIndex; i++) {
      n += Math.ceil(rows[i]!.text.length / BRIEF_CHUNK_CHARS);
    }
    return n;
  }

  private tickBriefImpacts(elapsed: number, rows: BriefLine[]) {
    for (let i = 0; i < rows.length; i++) {
      const line = rows[i]!;
      const lineStart = i * BRIEF_LINE_STAGGER_MS;
      const t = elapsed - lineStart;
      if (t <= 0) continue;
      const flyT = Math.min(1, t / BRIEF_LINE_FLY_MS);
      const revealed = Math.max(0, Math.floor(line.text.length * flyT));
      const impacts = Math.floor(revealed / BRIEF_CHUNK_CHARS);
      const base = this.impactSlotsBefore(i, rows);
      for (let k = 0; k < impacts; k++) {
        const idx = base + k;
        if (this.briefImpacted.has(idx)) continue;
        this.briefImpacted.add(idx);
        playWarriorImpact(0.85 + (k % 4) * 0.08);
        if (navigator.vibrate) navigator.vibrate(10 + (k % 3) * 4);
      }
    }
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

    const player = this.race.racers.find((r) => r.isPlayer)!;
    if (!this.raceControls.wheelDragging && this.pointerSteer === 0) {
      const decay = Math.pow(0.04, dt / 220);
      player.steerHeld *= decay;
      if (Math.abs(player.steerHeld) < 0.03) player.steerHeld = 0;
      this.raceControls.wheelAngle = player.steerHeld * MAX_TURN;
    }

    for (const r of this.race.racers) {
      this.tickRacer(r, dt, elapsed, now, r.isPlayer);
    }

    const ranked = racerRank(this.race.racers);
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
    if (a.waveTimer >= ASTEROID_WAVE_MS && elapsed < STAGE_MS.asteroids - 5000 && a.wave < 6) {
      a.wave += 1;
      a.waveTimer = 0;
      a.score += 40 + a.wave * 15;
      this.subBanner = `Wave ${a.wave} — break the veil`;
    }

    const timeLeft = STAGE_MS.asteroids - elapsed;
    const sinceSpawn = elapsed - a.lastSpawnElapsed;
    const onScreenCap = this.maxRocksOnScreen(a.wave);
    if (
      timeLeft > 2800 &&
      sinceSpawn >= a.spawnGap &&
      a.rocks.length < onScreenCap
    ) {
      this.spawnOneRock(a.wave);
      a.lastSpawnElapsed = elapsed;
      a.spawnGap = Math.max(
        ASTEROID_SPAWN_GAP_MIN,
        ASTEROID_SPAWN_GAP_START - a.wave * 110 + (Math.random() - 0.5) * 380,
      );
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

    if (this.stage === "brief") {
      this.drawBrief(ctx, w, h, now);
      return;
    }

    this.drawHud(ctx, w, h, now);
    if (this.stage === "platform") this.drawPlatform(ctx, w, h, now);
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

    const hudH = WARRIOR_HUD_H;
    const titlePx = Math.max(18, Math.min(26, Math.floor(w * 0.048)));
    const subPx = Math.max(16, Math.min(22, Math.floor(w * 0.04)));
    const statPx = Math.max(16, Math.min(20, Math.floor(w * 0.038)));
    const timePx = Math.max(18, Math.min(24, Math.floor(w * 0.046)));
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, 0, w, hudH);
    ctx.fillStyle = "#e8b050";
    ctx.font = `${titlePx}px "VT323", monospace`;
    ctx.fillText(this.fitHudLine(ctx, this.banner, w * 0.42), 10, 16);
    ctx.fillStyle = "#98b8e8";
    ctx.font = `${subPx}px "VT323", monospace`;
    ctx.fillText(this.fitHudLine(ctx, this.subBanner, w * 0.58), 10, 34);

    if (this.stage === "race" && !this.race.raceOver) {
      const player = this.race.racers.find((r) => r.isPlayer)!;
      const lap = Math.min(LAP_COUNT, Math.floor(player.lapProgress) + 1);
      ctx.fillStyle = "#f8f0ff";
      ctx.font = `${statPx}px "VT323", monospace`;
      ctx.fillText(`LAP ${lap}/${LAP_COUNT}  P${this.race.playerPlace}/5`, w * 0.34, 16);
    }

    if (this.stage === "asteroids") {
      ctx.fillStyle = "#f8f0ff";
      ctx.font = `${statPx}px "VT323", monospace`;
      ctx.fillText(`W${this.asteroids.wave} ♥${this.asteroids.lives}`, w * 0.36, 16);
      if (this.asteroids.combo > 1) {
        ctx.fillStyle = "#e87850";
        ctx.fillText(`x${this.asteroids.combo}`, w * 0.54, 16);
      }
    }

    if (timeLeft > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#68b8a8";
      ctx.font = `${timePx}px "VT323", monospace`;
      ctx.fillText(`${timeLeft.toFixed(1)}s`, w - 10, 20);
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
    ctx.font = `${statPx}px "VT323", monospace`;
    ctx.fillText(`◎ ${live}`, w - 10, 36);
    ctx.textAlign = "left";
  }

  private fitHudLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let trimmed = text;
    while (trimmed.length > 3 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}…`;
  }

  private drawBrief(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const elapsed = this.stageElapsed(now);
    const tick = elapsed * 0.06;
    const basePx = this.briefBasePx;
    const rows = this.syncBriefLayout(ctx, w, h);
    const lineH = this.briefLineH;
    const panelLeft = w * 0.04;
    const panelW = w * 0.92;
    const panelTop = Math.max(12, h * 0.06);
    const knightFootY = h - Math.max(20, h * 0.05);
    const panelH = Math.min(h * 0.72, knightFootY - panelTop - 12);
    const textBlockH = rows.length * lineH;
    const textStartY = panelTop + 18 + Math.max(0, (panelH - 36 - textBlockH) / 2) + lineH * 0.5;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1a1030");
    grad.addColorStop(0.55, "#0a1428");
    grad.addColorStop(1, "#060a14");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(72, 48, 88, 0.5)";
    ctx.fillRect(panelLeft, panelTop, panelW, panelH);
    ctx.strokeStyle = "#e8b050";
    ctx.lineWidth = 3;
    ctx.strokeRect(panelLeft + 1, panelTop + 1, panelW - 2, panelH - 2);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < rows.length; i++) {
      const line = rows[i]!;
      const lineStart = i * BRIEF_LINE_STAGGER_MS;
      const t = elapsed - lineStart;
      if (t < 0) continue;

      const flyT = Math.min(1, t / BRIEF_LINE_FLY_MS);
      const eased = 1 - Math.pow(1 - flyT, 3);
      const font = briefFont(line, basePx);
      ctx.font = font;
      const lineW = ctx.measureText(line.text).width;
      const targetX = w * 0.5;
      const targetY = textStartY + i * lineH;
      const startX = w + lineW * 0.5 + 24;
      const x = startX + (targetX - startX) * eased;

      ctx.save();
      ctx.globalAlpha = Math.min(1, 0.35 + flyT * 0.75);
      ctx.fillStyle = line.color;
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = line.title ? 6 : 3;
      ctx.fillText(line.text, x, targetY);
      ctx.shadowBlur = 0;

      if (flyT >= 1 && t < BRIEF_LINE_FLY_MS + 70) {
        const flash = 1 - (t - BRIEF_LINE_FLY_MS) / 70;
        ctx.fillStyle = `rgba(232, 176, 80, ${0.22 * flash})`;
        ctx.fillRect(x - lineW * 0.5 - 8, targetY - lineH * 0.48, lineW + 16, lineH * 0.96);
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, x, targetY);
      }
      ctx.restore();
    }

    const knightScale = Math.min(1.35, w / 280, (h * 0.16) / 48);
    drawKnightPortrait(ctx, w / 2, knightFootY, tick, knightScale);
    ctx.textAlign = "left";
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const groundY = h * 0.72;
    const p = this.platform;
    const cam = p.cam;
    const tick = now;

    drawSargaanoSky(ctx, w, h, groundY, cam, tick);

    for (const prop of SARGAANO_PROPS) {
      const sx = prop.x - cam;
      if (sx < -60 || sx > w + 60) continue;
      drawSargaanoProp(ctx, prop, sx, groundY, tick);
    }

    const abyssGrad = ctx.createLinearGradient(0, groundY + 20, 0, h);
    abyssGrad.addColorStop(0, "#120818");
    abyssGrad.addColorStop(1, "#06040c");
    ctx.fillStyle = abyssGrad;
    ctx.fillRect(0, groundY + 20, w, h - groundY - 20);

    for (let i = 0; i < 24; i++) {
      const px = ((i * 80 - cam * 0.18) % (w + 80)) - 40;
      ctx.fillStyle = i % 2 ? "rgba(58, 40, 72, 0.45)" : "rgba(34, 24, 48, 0.55)";
      ctx.fillRect(px, groundY + 28, 48, h);
    }

    for (let pi = 0; pi < p.plats.length; pi++) {
      const plat = p.plats[pi]!;
      const sx = plat.x - cam;
      if (sx < -120 || sx > w + 120) continue;
      drawCharterPlat(ctx, sx, groundY, plat, pi);
    }

    for (const pick of p.pickups) {
      if (pick.taken) continue;
      const sx = pick.x - cam;
      if (sx < -24 || sx > w + 24) continue;
      drawCharterPickup(ctx, sx, groundY, pick, tick);
    }

    const px = p.x - cam;
    const py = groundY + p.y;
    const pose = !p.onGround ? (p.vy < -1.5 ? "jump" : "fall") : "run";
    const frame = Math.floor(p.x / 14) % 2;
    drawKnightPlatformer(ctx, px, py, { pose, frame, facing: 1, scale: 2 });

    const gx = GOAL_X - cam;
    if (gx > -40 && gx < w + 80) {
      drawCharterGate(ctx, gx, groundY, tick);
    }

    const prog = Math.min(1, p.x / GOAL_X);
    ctx.fillStyle = "#1a1420";
    ctx.fillRect(12, h - 22, w - 24, 8);
    ctx.fillStyle = SARGAANO.gold;
    ctx.fillRect(12, h - 22, (w - 24) * prog, 8);
    ctx.strokeStyle = SARGAANO.charter;
    ctx.lineWidth = 1;
    ctx.strokeRect(12, h - 22, w - 24, 8);

    ctx.fillStyle = "rgba(248, 240, 255, 0.75)";
    ctx.font = warriorHintFont(w);
    ctx.textAlign = "center";
    ctx.fillText("SARGAANO CAUSEWAY — TAP / SPACE TO LEAP", w / 2, h - 28);
    ctx.textAlign = "left";
  }

  private drawRace(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const playTop = WARRIOR_HUD_H;
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
      if (r.isPlayer) {
        drawKnightRacer(ctx, 0, 0, 0, true);
      } else {
        ctx.fillStyle = r.color;
        ctx.fillRect(-12, -7, 24, 14);
        ctx.fillStyle = "#1a1810";
        ctx.fillRect(4, -5, 8, 10);
      }
      ctx.restore();

      ctx.fillStyle = r.isPlayer ? "#f8f0ff" : "rgba(248,240,255,0.7)";
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText(r.isPlayer ? "YOU" : String(idx + 1), px, py - 16);
      ctx.textAlign = "left";
    });

    const layout = raceWheelLayout(w, h);
    drawRaceSteeringWheel(
      ctx,
      layout,
      this.raceControls.wheelAngle,
      this.raceControls.wheelDragging,
    );
    drawRaceBoostPad(ctx, layout, this.raceControls.boostHeld);

    ctx.fillStyle = "rgba(248,240,255,0.7)";
    ctx.font = warriorHintFont(w);
    ctx.textAlign = "center";
    ctx.fillText("DRAG WHEEL · TAP BOOST · 2 LAPS vs 4 RIVALS", w / 2, h - 12);
    ctx.textAlign = "left";
  }

  private drawAsteroids(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const playTop = WARRIOR_HUD_H;
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
    drawKnightFlyer(ctx, shipX, shipY);

    ctx.fillStyle = "rgba(248,240,255,0.7)";
    ctx.font = warriorHintFont(w);
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
    if (this.stage === "brief") return "";
    if (this.stage === "platform") return "Sprint the Sargaano causeway — leap the veil pits to the Charter Gate";
    if (this.stage === "race") {
      const p = this.race.playerPlace;
      return `Drag the wheel to steer · tap ⚡ boost — P${p}/5`;
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
