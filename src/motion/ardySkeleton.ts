/**
 * Draw ARDY poses as a taverny charter angler — clothed figure, not stick bones.
 */

import { houseAvatarById, type HouseAvatarId } from "../content/houseAvatars";
import { ARDY_BONES, type ArdyPose, type ArdyVec2 } from "./ardyLite";

export type SkeletonDrawOpts = {
  /** Pixel origin of feet. */
  ox: number;
  oy: number;
  /** Pixels per unit pose. */
  scale: number;
  ink?: string;
  glow?: string;
  line?: number;
  /** Highlight wrist that holds the rod. */
  rodWrist?: "L" | "R";
  avatarId?: HouseAvatarId | string;
  avatarCustom?: string;
  /** Pole / season accent for cloak + tip glow. */
  accent?: string;
  cloak?: string;
};

function px(p: ArdyVec2, ox: number, oy: number, scale: number): ArdyVec2 {
  return { x: ox + p.x * scale, y: oy + p.y * scale };
}

export function wristWorld(
  pose: ArdyPose,
  which: "L" | "R",
  ox: number,
  oy: number,
  scale: number,
): ArdyVec2 {
  const j = which === "L" ? pose.wristL : pose.wristR;
  return px(j, ox, oy, scale);
}

function limb(
  ctx: CanvasRenderingContext2D,
  a: ArdyVec2,
  b: ArdyVec2,
  width: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: ArdyVec2[], color: string) {
  if (pts.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
  ctx.fill();
}

/** Thick charter angler — tabard, cloak, boots, house face. Keeps ARDY joint motion. */
export function drawArdySkeleton(
  ctx: CanvasRenderingContext2D,
  pose: ArdyPose,
  opts: SkeletonDrawOpts,
) {
  const { ox, oy, scale } = opts;
  const accent = opts.accent ?? "#e8b050";
  const cloak = opts.cloak ?? "#583868";
  const armor = "#9890c8";
  const armorDark = "#483058";
  const boot = "#2a1810";
  const skin = "#c8a888";
  const line = opts.line ?? Math.max(3, Math.floor(scale * 0.04));

  const J = (k: keyof ArdyPose) => px(pose[k], ox, oy, scale);
  const ankleL = J("ankleL");
  const ankleR = J("ankleR");
  const kneeL = J("kneeL");
  const kneeR = J("kneeR");
  const hip = J("hip");
  const spine = J("spine");
  const chest = J("chest");
  const neck = J("neck");
  const head = J("head");
  const shoulderL = J("shoulderL");
  const shoulderR = J("shoulderR");
  const elbowL = J("elbowL");
  const elbowR = J("elbowR");
  const wristL = J("wristL");
  const wristR = J("wristR");

  ctx.save();
  ctx.lineJoin = "round";

  // Soft foot halo
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse((ankleL.x + ankleR.x) / 2, (ankleL.y + ankleR.y) / 2 + 2, scale * 0.16, scale * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cloak — silhouette behind the body
  fillPoly(
    ctx,
    [
      { x: shoulderL.x - scale * 0.04, y: shoulderL.y },
      { x: shoulderR.x + scale * 0.02, y: shoulderR.y + scale * 0.02 },
      { x: hip.x + scale * 0.06, y: hip.y + scale * 0.08 },
      { x: hip.x - scale * 0.22, y: hip.y + scale * 0.18 },
      { x: spine.x - scale * 0.2, y: spine.y },
    ],
    cloak,
  );
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(shoulderL.x - scale * 0.02, shoulderL.y + scale * 0.04);
  ctx.quadraticCurveTo(hip.x - scale * 0.18, (spine.y + hip.y) / 2, hip.x - scale * 0.14, hip.y + scale * 0.12);
  ctx.stroke();

  // Legs / boots
  const legW = Math.max(5, scale * 0.07);
  limb(ctx, hip, kneeL, legW, armorDark);
  limb(ctx, kneeL, ankleL, legW * 0.9, armorDark);
  limb(ctx, hip, kneeR, legW, armorDark);
  limb(ctx, kneeR, ankleR, legW * 0.9, armorDark);
  limb(ctx, { x: ankleL.x - 2, y: ankleL.y }, { x: ankleL.x + 6, y: ankleL.y + 2 }, legW * 0.85, boot);
  limb(ctx, { x: ankleR.x - 2, y: ankleR.y }, { x: ankleR.x + 6, y: ankleR.y + 2 }, legW * 0.85, boot);

  // Torso tabard
  fillPoly(
    ctx,
    [
      { x: shoulderL.x, y: shoulderL.y },
      { x: shoulderR.x, y: shoulderR.y },
      { x: hip.x + scale * 0.1, y: hip.y },
      { x: hip.x - scale * 0.1, y: hip.y },
    ],
    "#583868",
  );
  fillPoly(
    ctx,
    [
      { x: shoulderL.x + scale * 0.02, y: shoulderL.y + scale * 0.02 },
      { x: shoulderR.x - scale * 0.02, y: shoulderR.y + scale * 0.02 },
      { x: chest.x + scale * 0.06, y: chest.y + scale * 0.08 },
      { x: chest.x - scale * 0.06, y: chest.y + scale * 0.08 },
    ],
    armor,
  );
  // Gold belt
  ctx.fillStyle = accent;
  ctx.fillRect(hip.x - scale * 0.09, hip.y - scale * 0.04, scale * 0.18, Math.max(2, scale * 0.03));
  ctx.fillStyle = "#f0d878";
  ctx.fillRect(hip.x - scale * 0.02, hip.y - scale * 0.05, scale * 0.04, Math.max(3, scale * 0.045));

  // Arms
  const armW = Math.max(4, scale * 0.055);
  limb(ctx, shoulderL, elbowL, armW, armor);
  limb(ctx, elbowL, wristL, armW * 0.9, armorDark);
  limb(ctx, shoulderR, elbowR, armW, armor);
  limb(ctx, elbowR, wristR, armW * 0.9, armorDark);
  // Hands
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(wristL.x, wristL.y, Math.max(2.5, scale * 0.035), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(wristR.x, wristR.y, Math.max(2.5, scale * 0.035), 0, Math.PI * 2);
  ctx.fill();

  // Soft glow under bones for readability in dark
  if (opts.glow) {
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = opts.glow;
    ctx.lineWidth = line + 3;
    for (const [a, b] of ARDY_BONES) {
      const A = px(pose[a], ox, oy, scale);
      const B = px(pose[b], ox, oy, scale);
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Head disc + house face
  const headR = Math.max(7, scale * 0.1);
  ctx.fillStyle = armorDark;
  ctx.beginPath();
  ctx.arc(head.x, head.y, headR + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  const face = houseAvatarById(opts.avatarId);
  const custom = opts.avatarCustom;
  if (custom && custom.startsWith("data:image/")) {
    const img = customImage(custom);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, head.x - headR, head.y - headR, headR * 2, headR * 2);
      ctx.restore();
    } else {
      drawGlyphHead(ctx, head, headR, face.ink, face.glow, face.glyph);
    }
  } else {
    drawGlyphHead(ctx, head, headR, face.ink, face.glow, face.glyph);
  }

  // Tiny neck / helm brim
  ctx.fillStyle = accent;
  ctx.fillRect(neck.x - scale * 0.05, neck.y - scale * 0.02, scale * 0.1, Math.max(2, scale * 0.025));

  const which = opts.rodWrist ?? "R";
  const wrist = which === "R" ? wristR : wristL;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(wrist.x, wrist.y, Math.max(3, scale * 0.04), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f8f0c0";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
  return wrist;
}

function drawGlyphHead(
  ctx: CanvasRenderingContext2D,
  head: ArdyVec2,
  r: number,
  ink: string,
  glow: string,
  glyph: string,
) {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = glow;
  ctx.font = `${Math.max(10, Math.floor(r * 1.35))}px "VT323", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, head.x, head.y + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

const customImgCache = new Map<string, HTMLImageElement>();

function customImage(dataUrl: string): HTMLImageElement | null {
  let img = customImgCache.get(dataUrl);
  if (img) return img;
  if (customImgCache.size > 8) customImgCache.clear();
  img = new Image();
  img.decoding = "async";
  img.src = dataUrl;
  customImgCache.set(dataUrl, img);
  return img;
}
