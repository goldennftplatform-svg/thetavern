/**
 * Demplar Warrior — three charter trials:
 * I  Sargaano Sprint — Mario-style knight platformer
 * II Charter Stack — Tetris
 * III Veil Cure — Dr. Mario pill puzzle
 */

import { warriorBriefLines, warriorTrialNames } from "../content/demplarKnights";
import { pickLine } from "../content/arcaneLore";
import {
  playPlatformJump,
  playPlatformLand,
  playPlatformPickup,
  playWarriorImpact,
} from "../audio/warriorSfx";
import { drawKnightPlatformer, drawKnightPortrait } from "../sprites/knightSprite";
import { KnightDrMario } from "./knightDrMario";
import { KnightTetris, TETRIS_MAX_PIECES, TETRIS_WIN_LINES } from "./knightTetris";

export type DemplarStage = "brief" | "platform" | "tetris" | "drmario" | "done";

export type DemplarRunResult = {
  total: number;
  platform: number;
  race: number;
  asteroids: number;
};

type Pickup = { x: number; y: number; kind: "coin" | "blade"; taken?: boolean };
type Plat = { x: number; y: number; w: number; h: number };
type Dust = { x: number; y: number; vx: number; vy: number; life: number; max: number };

const STAGE_MS = {
  brief: 2800,
  platform: 48_000,
  tetris: 70_000,
  drmario: 38_000,
} as const;

const STAGE_BREAK_MS = 1800;
const TETRIS_HANDOFF_MS = 2400;

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
    { text: "TAVERN ARCADE", color: "#e8b050", fontScale: 1.18, title: true },
    { text: lore, color: "#d8e4f8", fontScale: 1.05 },
    { text: "SPRINT · STACK · CURE", color: "#78d0b8", fontScale: 1 },
    { text: "BACK-ROOM TRIALS", color: "#e8b050", fontScale: 1 },
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

const PLAYER_SCREEN_X = 148;
/** World units / second — frame-rate independent (old per-frame vars tunneled floors at 120Hz). */
const RUN_PX_S = 268;
const GRAVITY_PX_S2 = 1980;
const JUMP_VEL_PX_S = -640;
const MAX_FALL_PX_S = 900;
const COYOTE_MS = 150;
const JUMP_BUFFER_MS = 130;
const LAND_SNAP = 10;

/**
 * Hand-built causeway — long y=0 floor strips read as solid ground;
 * gaps are clear pits. Floating decks are bonus height.
 */
const PLATFORM_PLATS: Plat[] = [
  { x: -120, y: 0, w: 720, h: 52 },
  { x: 760, y: 0, w: 280, h: 52 },
  { x: 1120, y: 0, w: 360, h: 52 },
  { x: 1560, y: -52, w: 200, h: 36 },
  { x: 1840, y: 0, w: 300, h: 52 },
  { x: 2220, y: 0, w: 220, h: 52 },
  { x: 2520, y: -56, w: 170, h: 36 },
  { x: 2760, y: -108, w: 150, h: 36 },
  { x: 2980, y: -56, w: 190, h: 36 },
  { x: 3260, y: 0, w: 280, h: 52 },
  { x: 3620, y: 0, w: 520, h: 52 },
];

const PLATFORM_PICKUPS: Pickup[] = [
  { x: 220, y: -48, kind: "coin" },
  { x: 300, y: -48, kind: "coin" },
  { x: 380, y: -48, kind: "coin" },
  { x: 880, y: -48, kind: "coin" },
  { x: 1260, y: -48, kind: "blade" },
  { x: 1640, y: -96, kind: "coin" },
  { x: 1720, y: -96, kind: "coin" },
  { x: 1980, y: -48, kind: "blade" },
  { x: 2320, y: -48, kind: "coin" },
  { x: 2580, y: -100, kind: "coin" },
  { x: 2820, y: -152, kind: "blade" },
  { x: 3060, y: -100, kind: "coin" },
  { x: 3400, y: -48, kind: "coin" },
  { x: 3800, y: -48, kind: "blade" },
  { x: 3920, y: -48, kind: "coin" },
];

const GOAL_X = 3980;
const WARRIOR_HUD_H = 44;

/** Sargaano charter causeway — parallax props (no collision). */
type SargaanoProp = { x: number; y: number; kind: "banner" | "torch" | "pillar" | "well" | "swords" };
const SARGAANO_PROPS: SargaanoProp[] = [
  { x: 140, y: 0, kind: "banner" },
  { x: 420, y: 0, kind: "torch" },
  { x: 880, y: 0, kind: "pillar" },
  { x: 1280, y: 0, kind: "swords" },
  { x: 1640, y: -52, kind: "banner" },
  { x: 1980, y: 0, kind: "well" },
  { x: 2360, y: 0, kind: "torch" },
  { x: 2600, y: -108, kind: "pillar" },
  { x: 3060, y: -56, kind: "banner" },
  { x: 3400, y: 0, kind: "swords" },
  { x: 3800, y: 0, kind: "torch" },
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
  const tileW = 28;
  const tiles = Math.max(1, Math.ceil(plat.w / tileW));
  const isFloor = plat.y === 0;

  // Deep earth under solid floors so the ground never "vanishes" into a thin top edge
  if (isFloor) {
    ctx.fillStyle = "#1a1018";
    ctx.fillRect(sx, py + plat.h - 4, plat.w, 36);
    ctx.fillStyle = "#2a1828";
    for (let d = 0; d < plat.w; d += 22) {
      ctx.fillRect(sx + d, py + plat.h + 8, 14, 18);
    }
  }

  for (let t = 0; t < tiles; t++) {
    const tx = sx + t * tileW;
    const tw = Math.min(tileW, plat.w - t * tileW);
    if (tw <= 0) continue;
    const shade = (t + platIndex) % 2 === 0;

    ctx.fillStyle = SARGAANO.stoneDark;
    ctx.fillRect(tx, py + 6, tw, plat.h - 4);
    ctx.fillStyle = shade ? SARGAANO.stone : SARGAANO.stoneCap;
    ctx.fillRect(tx + 1, py + 5, Math.max(1, tw - 2), plat.h - 10);
    ctx.fillStyle = SARGAANO.mortar;
    ctx.fillRect(tx, py + plat.h - 6, tw, 3);

    // Mario-style bright top cap
    ctx.fillStyle = "#5a4868";
    ctx.fillRect(tx, py, tw, 6);
    ctx.fillStyle = SARGAANO.gold;
    ctx.fillRect(tx, py, tw, 3);
    ctx.fillStyle = "#f0d878";
    ctx.fillRect(tx + 2, py + 1, Math.max(1, tw - 4), 1);

    if (t === 0) {
      ctx.fillStyle = SARGAANO.charter;
      ctx.fillRect(tx, py - 8, 10, 8);
      ctx.fillStyle = SARGAANO.gold;
      ctx.fillRect(tx + 2, py - 6, 6, 2);
    }
    if (t === tiles - 1) {
      ctx.fillStyle = SARGAANO.charter;
      ctx.fillRect(tx + tw - 10, py - 8, 10, 8);
      ctx.fillStyle = SARGAANO.gold;
      ctx.fillRect(tx + tw - 8, py - 6, 6, 2);
    }
  }

  if (platIndex % 3 === 1 && plat.w > 90) {
    ctx.font = '9px "VT323", monospace';
    ctx.fillStyle = SARGAANO.gold;
    ctx.textAlign = "center";
    ctx.fillText("⚔", sx + plat.w / 2, py - 2);
    ctx.textAlign = "left";
  }

  ctx.strokeStyle = "rgba(232, 176, 80, 0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 0.5, py + 0.5, plat.w - 1, plat.h - 1);
}

/** Draw danger lips / void markers between ground segments so pits read clearly. */
function drawPitLips(
  ctx: CanvasRenderingContext2D,
  plats: Plat[],
  cam: number,
  groundY: number,
  w: number,
  tick: number,
) {
  const floors = plats.filter((p) => p.y === 0).sort((a, b) => a.x - b.x);
  for (let i = 0; i < floors.length - 1; i++) {
    const left = floors[i]!;
    const right = floors[i + 1]!;
    const gapStart = left.x + left.w;
    const gapEnd = right.x;
    if (gapEnd - gapStart < 28) continue;
    const sx0 = gapStart - cam;
    const sx1 = gapEnd - cam;
    if (sx1 < -40 || sx0 > w + 40) continue;

    const pulse = 0.35 + Math.sin(tick * 0.005 + i) * 0.15;
    ctx.fillStyle = `rgba(200, 80, 90, ${pulse})`;
    ctx.fillRect(sx0 - 4, groundY - 6, 8, 12);
    ctx.fillRect(sx1 - 4, groundY - 6, 8, 12);

    const mist = ctx.createLinearGradient(0, groundY + 8, 0, groundY + 70);
    mist.addColorStop(0, "rgba(120, 40, 60, 0.35)");
    mist.addColorStop(1, "rgba(20, 8, 16, 0)");
    ctx.fillStyle = mist;
    ctx.fillRect(sx0, groundY + 8, sx1 - sx0, 70);

    ctx.font = '10px "VT323", monospace';
    ctx.fillStyle = `rgba(248, 180, 160, ${0.45 + pulse})`;
    ctx.textAlign = "center";
    ctx.fillText("▼ PIT ▼", (sx0 + sx1) / 2, groundY + 22);
    ctx.textAlign = "left";
  }
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
  ctx.fillText("FINISH", gx + 8, groundY - 98);
  ctx.fillText("GATE", gx + 8, groundY - 86);
  ctx.textAlign = "left";
}

export class DemplarWarrior {
  stage: DemplarStage = "brief";
  stageStarted = 0;
  banner = "TAVERN ARCADE";
  subBanner = warriorTrialNames.platform;
  done = false;

  private jumpHeld = false;
  private coyoteUntil = 0;
  private jumpBufferUntil = 0;
  private dust: Dust[] = [];
  private wasOnGround = true;

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

  tetris = new KnightTetris();
  drMario = new KnightDrMario();

  /** Mobile: double-tap center within this window = hard drop. */
  private lastCenterTapMs = 0;
  private softDropTouch = false;
  private steerHeld: -1 | 0 | 1 = 0;
  private steerDasMs = 0;
  private dropHeld = false;
  private dropRepeatMs = 0;
  private respawnUntil = 0;
  readonly mobileEase: boolean;

  /** Full-screen trial handoff — impossible to miss Tetris → Dr Mario. */
  private stageBreak: { title: string; subtitle: string; until: number } | null = null;
  /** After Tetris ends, freeze + overlay before Dr Mario. */
  private tetrisHandoffAt = 0;
  /** Wall-clock ms when Tetris MUST end — set when play actually starts. */
  private tetrisDeadline = 0;

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

  constructor(opts?: { mobileEase?: boolean }) {
    this.mobileEase = !!opts?.mobileEase;
    if (this.mobileEase) {
      this.tetris.mobileEase = true;
      this.drMario.mobileEase = true;
    }
    this.resetPlatform();
    this.tetris.reset();
    this.drMario.reset();
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
      x: 80,
      y: 0,
      vy: 0,
      cam: 0,
      score: 0,
      onGround: true,
      deaths: 0,
      pickups: PLATFORM_PICKUPS.map((p) => ({ ...p })),
      plats: PLATFORM_PLATS.map((p) => ({ ...p })),
    };
    this.jumpHeld = false;
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.dust = [];
    this.wasOnGround = true;
  }

  private stageElapsed(now: number): number {
    return now - this.stageStarted;
  }

  private clearPuzzleInput() {
    this.softDropTouch = false;
    this.steerHeld = 0;
    this.steerDasMs = 0;
    this.dropHeld = false;
    this.dropRepeatMs = 0;
    this.tetris.setSoftDrop(false);
    this.drMario.setSoftDrop(false);
  }

  advanceStage(now: number, next: DemplarStage) {
    if (next === "tetris") {
      this.result.platform = Math.max(0, this.platform.score);
      this.subBanner = warriorTrialNames.race;
      this.tetrisHandoffAt = 0;
      this.tetrisDeadline = 0;
      this.tetris.reset();
      this.stageBreak = {
        title: "TRIAL II",
        subtitle: "STACK ATTACK · TETRIS",
        until: now + STAGE_BREAK_MS,
      };
      this.banner = "STACK ATTACK";
    } else if (next === "drmario") {
      this.result.race = Math.max(0, this.tetris.score);
      this.subBanner = warriorTrialNames.asteroids;
      this.drMario.reset();
      this.stageBreak = {
        title: "TRIAL III",
        subtitle: "VEIL CURE · DR MARIO",
        until: now + STAGE_BREAK_MS,
      };
      this.banner = "VEIL CURE";
    } else if (next === "done") {
      this.result.asteroids = Math.max(0, this.drMario.score);
      this.result.race = Math.max(0, this.result.race);
      this.result.platform = Math.max(0, this.result.platform);
      this.result.total = this.result.platform + this.result.race + this.result.asteroids;
      this.done = true;
      this.banner = "ARCADE CLEARED";
      this.subBanner = `Total ${this.result.total}`;
      this.stageBreak = null;
    }
    this.stage = next;
    this.stageStarted = now;
    this.clearPuzzleInput();
  }

  private inStageBreak(now = performance.now()): boolean {
    return !!this.stageBreak && now < this.stageBreak.until;
  }

  /** Hard cut — Tetris ALWAYS exits here before Dr Mario. */
  private endTetrisTrial(now: number) {
    if (this.stage !== "tetris" || this.tetrisHandoffAt > 0) return;
    this.tetris.finished = true;
    this.tetris.freeze();
    this.result.race = Math.max(0, this.tetris.score);
    this.tetrisHandoffAt = now + TETRIS_HANDOFF_MS;
    this.tetrisDeadline = 0;
    this.stageBreak = {
      title: "TRIAL II — COMPLETE",
      subtitle: `STACK ${this.result.race} · DR MARIO NEXT`,
      until: now + TETRIS_HANDOFF_MS,
    };
    this.banner = "TRIAL II SEALED";
    this.subBanner = "Veil Cure loading…";
    this.clearPuzzleInput();
    playWarriorImpact(1.15);
  }

  private skipTetrisIntro(now: number) {
    if (this.stage !== "tetris" || !this.stageBreak) return;
    this.stageBreak = null;
    if (this.tetrisDeadline === 0) this.tetrisDeadline = now + STAGE_MS.tetris;
  }

  private armTetrisDeadline(now: number) {
    if (this.stage !== "tetris" || this.tetrisDeadline > 0 || this.inStageBreak(now)) return;
    this.tetrisDeadline = now + STAGE_MS.tetris;
  }

  /** Checked every frame before anything can block the handoff. */
  private mustEndTetris(now: number): boolean {
    if (this.stage !== "tetris" || this.tetrisHandoffAt > 0) return false;
    if (this.inStageBreak(now)) return false;
    this.armTetrisDeadline(now);
    if (this.tetrisDeadline > 0 && now >= this.tetrisDeadline) return true;
    if (this.tetris.finished || this.tetris.gameOver) return true;
    if (this.tetris.lines >= TETRIS_WIN_LINES) return true;
    if (this.tetris.piecesLocked >= TETRIS_MAX_PIECES) return true;
    return false;
  }

  tetrisSecondsLeft(now: number): number {
    if (this.tetrisDeadline <= 0) return STAGE_MS.tetris / 1000;
    return Math.max(0, (this.tetrisDeadline - now) / 1000);
  }

  jump() {
    const now = performance.now();
    if (this.stage === "tetris" && this.inStageBreak(now)) {
      this.skipTetrisIntro(now);
      return;
    }
    if (this.tetrisHandoffAt > 0 || this.inStageBreak(now)) return;
    if (this.stage === "platform") {
      this.jumpHeld = true;
      this.jumpBufferUntil = now + JUMP_BUFFER_MS;
      this.tryPlatformJump(now);
      return;
    }
    if (this.stage === "tetris") {
      this.tetris.rotate();
      return;
    }
    if (this.stage === "drmario") {
      this.drMario.rotate();
    }
  }

  private tryPlatformJump(now: number): boolean {
    if (!(this.platform.onGround || now < this.coyoteUntil)) return false;
    this.platform.vy = JUMP_VEL_PX_S;
    this.platform.onGround = false;
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.wasOnGround = false;
    playPlatformJump();
    this.spawnDust(this.platform.x, this.platform.y, 5);
    return true;
  }

  releaseJump() {
    this.jumpHeld = false;
    if (this.stage === "platform" && this.platform.vy < JUMP_VEL_PX_S * 0.45) {
      this.platform.vy *= 0.48;
    }
  }

  private spawnDust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      this.dust.push({
        x: x + (Math.random() - 0.5) * 18,
        y,
        vx: (Math.random() - 0.5) * 90,
        vy: -40 - Math.random() * 80,
        life: 0.22 + Math.random() * 0.18,
        max: 0.4,
      });
    }
  }

  steer(dir: -1 | 1, hold = true) {
    if (this.tetrisHandoffAt > 0 || this.inStageBreak()) return;
    if (this.stage !== "tetris" && this.stage !== "drmario") return;
    if (hold) {
      const changed = this.steerHeld !== dir;
      this.steerHeld = dir;
      if (changed) this.steerDasMs = 0;
    }
    if (this.stage === "tetris") this.tetris.move(dir);
    if (this.stage === "drmario") this.drMario.move(dir);
  }

  releaseSteer() {
    this.steerHeld = 0;
    this.steerDasMs = 0;
  }

  private tickSteerRepeat(dt: number) {
    if (this.steerHeld === 0) return;
    if (this.tetrisHandoffAt > 0 || this.inStageBreak()) return;
    if (this.stage !== "tetris" && this.stage !== "drmario") return;
    this.steerDasMs += dt;
    if (this.steerDasMs < 130) return;
    this.steerDasMs -= 68;
    if (this.stage === "tetris") this.tetris.move(this.steerHeld);
    if (this.stage === "drmario") this.drMario.move(this.steerHeld);
  }

  private tickDropRepeat(dt: number) {
    if (!this.dropHeld || this.stage !== "drmario") return;
    if (this.drMario.finished || this.tetrisHandoffAt > 0 || this.inStageBreak()) return;
    this.dropRepeatMs += dt;
    if (this.dropRepeatMs < 260) return;
    this.dropRepeatMs -= 230;
    this.drMario.stepDown();
  }

  boost(on: boolean) {
    if (this.tetrisHandoffAt > 0 || this.inStageBreak()) return;
    if (this.stage === "drmario") {
      if (this.drMario.finished) return;
      if (on) {
        this.dropHeld = true;
        this.dropRepeatMs = 0;
        this.drMario.stepDown();
      } else {
        this.dropHeld = false;
        this.dropRepeatMs = 0;
      }
      return;
    }
    if (this.stage === "tetris") this.tetris.setSoftDrop(on);
  }

  hardDrop() {
    if (this.tetrisHandoffAt > 0 || this.inStageBreak()) return;
    if (this.stage === "drmario" && this.drMario.finished) return;
    if (this.stage === "tetris") this.tetris.hardDrop();
    if (this.stage === "drmario") this.drMario.hardDrop();
  }

  pointerDown(nx: number, ny: number, w: number, h: number) {
    const now = performance.now();
    if (this.mobileEase && (this.stage === "tetris" || this.stage === "drmario")) return;
    if (this.stage === "tetris" && this.inStageBreak(now)) {
      this.skipTetrisIntro(now);
      return;
    }
    if (this.tetrisHandoffAt > 0 || this.inStageBreak(now)) return;
    if (this.stage === "platform") {
      this.jump();
      return;
    }
    if (this.stage === "tetris" || this.stage === "drmario") {
      if (this.stage === "tetris" && ny >= h * 0.72) {
        this.softDropTouch = true;
        this.boost(true);
        return;
      }
      if (this.stage === "drmario" && ny >= h * 0.72) {
        this.boost(true);
        return;
      }
      if (nx < w * 0.33) {
        this.steer(-1);
        return;
      }
      if (nx > w * 0.66) {
        this.steer(1);
        return;
      }
      const now = performance.now();
      if (now - this.lastCenterTapMs < 340) {
        this.hardDrop();
        this.lastCenterTapMs = 0;
      } else {
        this.lastCenterTapMs = now;
        this.jump();
      }
    }
  }

  pointerUp() {
    this.releaseJump();
    this.releaseSteer();
    if (this.softDropTouch) {
      this.softDropTouch = false;
      this.boost(false);
    }
  }

  pointerMove(_nx: number, ny: number, _w: number, h: number) {
    if (this.mobileEase && (this.stage === "tetris" || this.stage === "drmario")) return;
    if (this.stage !== "tetris") return;
    const inDropZone = ny >= h * 0.72;
    if (inDropZone && !this.softDropTouch) {
      this.softDropTouch = true;
      this.boost(true);
    } else if (!inDropZone && this.softDropTouch) {
      this.softDropTouch = false;
      this.boost(false);
    }
  }

  update(dt: number, now: number) {
    dt = Math.min(Math.max(dt, 0), 48);

    if (this.tetrisHandoffAt > 0) {
      if (now >= this.tetrisHandoffAt) {
        this.tetrisHandoffAt = 0;
        this.stageBreak = null;
        this.advanceStage(now, "drmario");
      }
      return;
    }

    if (this.mustEndTetris(now)) {
      this.endTetrisTrial(now);
      return;
    }

    const elapsed = this.stageElapsed(now);

    if (this.stageBreak && now < this.stageBreak.until) return;
    if (this.stageBreak && now >= this.stageBreak.until) {
      this.stageBreak = null;
      if (this.stage === "tetris") this.armTetrisDeadline(now);
    }

    if (this.stage === "brief") {
      this.tickBriefImpacts(elapsed, this.briefDisplayLines);
      if (elapsed > this.briefDurationMs()) {
        this.advanceStage(now, "platform");
        return;
      }
      return;
    }

    this.tickSteerRepeat(dt);
    this.tickDropRepeat(dt);

    if (this.stage === "platform") this.tickPlatform(dt, elapsed, now);
    if (this.stage === "tetris") this.tickTetris(dt, elapsed, now);
    if (this.stage === "drmario") this.tickDrMario(dt, elapsed, now);
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

  private findRespawnPlatform(px: number): Plat {
    for (const plat of this.platform.plats) {
      if (px + 12 >= plat.x && px - 12 <= plat.x + plat.w) return plat;
    }
    let fallback = this.platform.plats[0]!;
    for (const plat of this.platform.plats) {
      if (plat.x + plat.w * 0.5 <= px) fallback = plat;
    }
    return fallback;
  }

  private respawnPlatform(now: number) {
    const p = this.platform;
    p.deaths += 1;
    p.score = Math.max(0, p.score - 40);
    const plat = this.findRespawnPlatform(p.x);
    p.x = Math.max(plat.x + 28, Math.min(p.x, plat.x + plat.w - 28));
    p.y = plat.y;
    p.vy = 0;
    p.onGround = true;
    this.wasOnGround = true;
    this.coyoteUntil = now + COYOTE_MS;
    this.respawnUntil = now + 900;
    this.spawnDust(p.x, p.y, 8);
    playPlatformLand();
  }

  private tickPlatform(dt: number, elapsed: number, now: number) {
    const p = this.platform;
    const t = Math.min(0.05, Math.max(0.001, dt / 1000));

    if (now < this.jumpBufferUntil) this.tryPlatformJump(now);

    p.x += RUN_PX_S * t;
    p.vy = Math.min(MAX_FALL_PX_S, p.vy + GRAVITY_PX_S2 * t);
    // Variable jump height — release cuts ascent
    if (!this.jumpHeld && p.vy < 0) p.vy += GRAVITY_PX_S2 * 0.55 * t;

    const prevY = p.y;
    p.y += p.vy * t;

    const wasGround = this.wasOnGround;
    p.onGround = false;
    const halfW = 14;
    for (const plat of p.plats) {
      if (p.x + halfW <= plat.x || p.x - halfW >= plat.x + plat.w) continue;
      // Swept landing — catches high-refresh tunneling through thin floors
      if (p.vy >= 0 && prevY <= plat.y + LAND_SNAP && p.y >= plat.y - 2) {
        p.y = plat.y;
        p.vy = 0;
        p.onGround = true;
        this.coyoteUntil = now + COYOTE_MS;
      }
    }

    if (p.onGround && !wasGround) {
      playPlatformLand();
      this.spawnDust(p.x, p.y, 6);
    }
    this.wasOnGround = p.onGround;

    if (p.y > 140 && now > this.respawnUntil) {
      this.respawnPlatform(now);
    }

    const targetCam = Math.max(0, p.x - PLAYER_SCREEN_X);
    p.cam += (targetCam - p.cam) * Math.min(1, 12 * t);

    for (const pick of p.pickups) {
      if (pick.taken) continue;
      if (Math.abs(p.x - pick.x) < 24 && Math.abs(p.y - pick.y) < 44) {
        pick.taken = true;
        p.score += pick.kind === "coin" ? 70 : 150;
        playPlatformPickup(pick.kind);
        this.spawnDust(pick.x, pick.y, 4);
      }
    }

    p.score += Math.floor(dt * 0.045);

    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i]!;
      d.life -= t;
      d.x += d.vx * t;
      d.y += d.vy * t;
      d.vy += 420 * t;
      if (d.life <= 0) this.dust.splice(i, 1);
    }

    const timeLeft = Math.max(0, STAGE_MS.platform - elapsed);
    if (p.x >= GOAL_X) {
      p.score += 480 + Math.floor(timeLeft / 90);
      this.platform.score = p.score;
      this.advanceStage(now, "tetris");
    } else if (elapsed >= STAGE_MS.platform) {
      p.score += Math.floor(timeLeft / 200);
      this.platform.score = p.score;
      this.advanceStage(now, "tetris");
    }
  }

  private tickTetris(dt: number, elapsed: number, now: number) {
    if (this.tetrisHandoffAt > 0 || this.mustEndTetris(now)) return;
    this.tetris.update(dt, elapsed, STAGE_MS.tetris);
  }

  private tickDrMario(dt: number, elapsed: number, now: number) {
    if (this.stage !== "drmario") return;
    if (this.drMario.finished || this.drMario.update(dt, elapsed, STAGE_MS.drmario)) {
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
    const touchPad = this.mobileEase && (this.stage === "tetris" || this.stage === "drmario");
    const footReserve = touchPad ? 96 : 28;
    if (this.stage === "platform") this.drawPlatform(ctx, w, h, now);
    else if (this.stage === "tetris") {
      const timerBand =
        this.tetrisHandoffAt === 0 && !this.inStageBreak(now) ? 36 : 0;
      this.tetris.draw(ctx, w, h, WARRIOR_HUD_H + timerBand, footReserve, touchPad);
      this.drawTetrisTimer(ctx, w, h, now);
    } else if (this.stage === "drmario") {
      const elapsed = this.stageElapsed(now);
      const left = Math.max(0, (STAGE_MS.drmario - elapsed) / 1000);
      this.drMario.draw(ctx, w, h, WARRIOR_HUD_H, footReserve, touchPad, left, STAGE_MS.drmario / 1000);
    } else this.drawDone(ctx, w, h);

    if (this.stageBreak && now < this.stageBreak.until) {
      this.drawStageBreak(ctx, w, h, now);
    }
  }

  private drawTetrisTimer(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    if (this.tetrisHandoffAt > 0 || this.inStageBreak(now)) return;
    const left = this.tetrisSecondsLeft(now);
    const pct = Math.max(0, Math.min(1, left / (STAGE_MS.tetris / 1000)));
    const barY = WARRIOR_HUD_H + 4;
    const barW = w - 24;
    ctx.fillStyle = "#1a1420";
    ctx.fillRect(12, barY, barW, 10);
    ctx.fillStyle = left <= 5 ? "#e87850" : "#68e8a8";
    ctx.fillRect(12, barY, barW * pct, 10);
    ctx.strokeStyle = "#e8b050";
    ctx.strokeRect(12, barY, barW, 10);
    ctx.fillStyle = left <= 5 ? "#ffb898" : "#f8f0ff";
    ctx.font = `${Math.max(14, Math.floor(w * 0.036))}px "VT323", monospace`;
    ctx.textAlign = "center";
    ctx.fillText(
      this.mobileEase
        ? `TRIAL II · ${left.toFixed(0)}s · ${this.tetris.lines}/${TETRIS_WIN_LINES} lines`
        : `TRIAL II · ${left.toFixed(0)}s · ${this.tetris.lines}/${TETRIS_WIN_LINES} lines · then VEIL CURE`,
      w / 2,
      barY + 24,
    );
    ctx.textAlign = "left";
  }

  private drawStageBreak(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const br = this.stageBreak!;
    const left = br.until - now;
    const pulse = 0.85 + Math.sin(now * 0.008) * 0.15;
    ctx.fillStyle = "rgba(6, 10, 20, 0.88)";
    ctx.fillRect(0, WARRIOR_HUD_H, w, h - WARRIOR_HUD_H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const titlePx = Math.max(28, Math.min(42, Math.floor(w * 0.1)));
    const subPx = Math.max(20, Math.min(30, Math.floor(w * 0.062)));
    ctx.fillStyle = `rgba(232, 176, 80, ${pulse})`;
    ctx.font = `${titlePx}px "VT323", monospace`;
    ctx.fillText(br.title, w / 2, h * 0.38);
    ctx.fillStyle = "#f8f0ff";
    ctx.font = `${subPx}px "VT323", monospace`;
    ctx.fillText(br.subtitle, w / 2, h * 0.48);
    ctx.fillStyle = "#98b8e8";
    ctx.font = `${Math.max(16, subPx - 4)}px "VT323", monospace`;
    ctx.fillText("GET READY…", w / 2, h * 0.58);
    ctx.fillStyle = "#68b8a8";
    ctx.font = `${Math.max(18, subPx - 2)}px "VT323", monospace`;
    ctx.fillText(`${(left / 1000).toFixed(1)}s`, w / 2, h * 0.66);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  private drawHud(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const elapsed = this.stageElapsed(now);
    let timeMax = STAGE_MS.platform;
    if (this.stage === "tetris") timeMax = STAGE_MS.tetris;
    if (this.stage === "drmario") timeMax = STAGE_MS.drmario;
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

    if (this.stage === "tetris") {
      ctx.fillStyle = "#f8f0ff";
      ctx.font = `${statPx}px "VT323", monospace`;
      ctx.fillText(this.tetris.hudLine(), w * 0.34, 16);
    }

    if (this.stage === "drmario") {
      ctx.fillStyle = "#f8f0ff";
      ctx.font = `${statPx}px "VT323", monospace`;
      ctx.fillText(this.drMario.hudLine(), w * 0.34, 16);
      if (this.drMario.combo > 1) {
        ctx.fillStyle = "#e87850";
        ctx.fillText(`x${this.drMario.combo}`, w * 0.58, 16);
      }
    }

    if (timeLeft > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = timeLeft <= 5 && this.stage === "tetris" ? "#e87850" : "#68b8a8";
      ctx.font = `${timePx}px "VT323", monospace`;
      const label =
        timeLeft <= 5 && this.stage === "tetris" ? `⏱ ${timeLeft.toFixed(1)}s` : `${timeLeft.toFixed(1)}s`;
      ctx.fillText(label, w - 10, 20);
      ctx.textAlign = "left";
    }

    const live =
      (this.stage === "platform" ? this.platform.score : 0) +
      (this.stage !== "platform" && this.stage !== "brief" ? this.result.platform : 0) +
      (this.stage === "tetris" ? Math.max(0, this.tetris.score) : 0) +
      (this.stage === "drmario" || this.stage === "done" ? this.result.race : 0) +
      (this.stage === "drmario" ? Math.max(0, this.drMario.score) : 0);
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
    const invuln = now < this.respawnUntil;

    drawSargaanoSky(ctx, w, h, groundY, cam, tick);

    for (const prop of SARGAANO_PROPS) {
      const sx = prop.x - cam;
      if (sx < -60 || sx > w + 60) continue;
      drawSargaanoProp(ctx, prop, sx, groundY, tick);
    }

    // Far abyss — keeps depth but floors above it look thick/solid
    const abyssGrad = ctx.createLinearGradient(0, groundY + 24, 0, h);
    abyssGrad.addColorStop(0, "#1a0c18");
    abyssGrad.addColorStop(1, "#06040c");
    ctx.fillStyle = abyssGrad;
    ctx.fillRect(0, groundY + 24, w, h - groundY - 24);

    for (let i = 0; i < 28; i++) {
      const px = ((i * 72 - cam * 0.22) % (w + 90)) - 45;
      ctx.fillStyle = i % 2 ? "rgba(58, 40, 72, 0.4)" : "rgba(34, 24, 48, 0.5)";
      ctx.fillRect(px, groundY + 36, 40, h);
    }

    drawPitLips(ctx, p.plats, cam, groundY, w, tick);

    for (let pi = 0; pi < p.plats.length; pi++) {
      const plat = p.plats[pi]!;
      const sx = plat.x - cam;
      if (sx < -140 || sx > w + 140) continue;
      drawCharterPlat(ctx, sx, groundY, plat, pi);
    }

    for (const pick of p.pickups) {
      if (pick.taken) continue;
      const sx = pick.x - cam;
      if (sx < -24 || sx > w + 24) continue;
      drawCharterPickup(ctx, sx, groundY, pick, tick);
    }

    for (const d of this.dust) {
      const a = Math.max(0, d.life / d.max);
      ctx.fillStyle = `rgba(232, 176, 80, ${a * 0.7})`;
      ctx.fillRect(d.x - cam - 2, groundY + d.y - 2, 4, 4);
    }

    const px = p.x - cam;
    const py = groundY + p.y;
    const pose = !p.onGround ? (p.vy < -80 ? "jump" : "fall") : "run";
    const frame = Math.floor(p.x / 16) % 2;
    const scale = Math.max(2.1, Math.min(3.0, h / 230));

    // Soft shadow under boots when grounded — reads as standing on solid floor
    if (p.onGround) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(px, py + 2, 14 * (scale / 2), 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    if (invuln && Math.floor(now / 80) % 2 === 0) ctx.globalAlpha = 0.45;
    drawKnightPlatformer(ctx, px, py, { pose, frame, facing: 1, scale });
    ctx.restore();

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

    ctx.fillStyle = "rgba(248, 240, 255, 0.8)";
    ctx.font = warriorHintFont(w);
    ctx.textAlign = "center";
    ctx.fillText("SARGAANO CAUSEWAY — JUMP THE PITS · HOLD HIGHER", w / 2, h - 28);
    ctx.textAlign = "left";
  }

  private drawDone(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const titlePx = Math.max(22, Math.min(32, Math.floor(w * 0.062)));
    const linePx = Math.max(18, Math.min(26, Math.floor(w * 0.048)));
    const totalPx = Math.max(20, Math.min(28, Math.floor(w * 0.052)));
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8b050";
    ctx.font = `${titlePx}px "VT323", monospace`;
    ctx.fillText("ARCADE RUN COMPLETE", w / 2, h * 0.34);
    ctx.fillStyle = "#f8f0ff";
    ctx.font = `${linePx}px "VT323", monospace`;
    ctx.fillText(`SPRINT ${this.result.platform}`, w / 2, h * 0.44);
    ctx.fillText(`TETRIS ${this.result.race}`, w / 2, h * 0.5);
    ctx.fillText(`DR MARIO ${this.result.asteroids}`, w / 2, h * 0.56);
    ctx.fillStyle = "#68e8a8";
    ctx.font = `${totalPx}px "VT323", monospace`;
    ctx.fillText(`TOTAL ${this.result.total}`, w / 2, h * 0.64);
    ctx.textAlign = "left";
  }

  hint(): string {
    if (this.stage === "brief") return "";
    if (this.stage === "platform") return "Sprint the causeway — jump clear pits, hold for higher hops";
    if (this.stage === "tetris") {
      return `70s max · ${TETRIS_WIN_LINES} lines · ${TETRIS_MAX_PIECES} pieces — then Veil Cure`;
    }
    if (this.stage === "drmario") {
      return `${this.drMario.virusesLeft} viruses · ${Math.ceil(STAGE_MS.drmario / 1000)}s · match 4 to clear`;
    }
    return "Tavern arcade — three back-room trials";
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
