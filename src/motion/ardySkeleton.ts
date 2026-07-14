/**
 * Draw ARDY-lite / CUDA-baked poses as a taverny 2D angler.
 */

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

export function drawArdySkeleton(
  ctx: CanvasRenderingContext2D,
  pose: ArdyPose,
  opts: SkeletonDrawOpts,
) {
  const { ox, oy, scale } = opts;
  const ink = opts.ink ?? "#d8c8a0";
  const glow = opts.glow ?? "rgba(232, 176, 80, 0.28)";
  const line = opts.line ?? 3;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Soft presence glow
  ctx.strokeStyle = glow;
  ctx.lineWidth = line + 4;
  for (const [a, b] of ARDY_BONES) {
    const A = px(pose[a], ox, oy, scale);
    const B = px(pose[b], ox, oy, scale);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  }

  ctx.strokeStyle = ink;
  ctx.lineWidth = line;
  for (const [a, b] of ARDY_BONES) {
    const A = px(pose[a], ox, oy, scale);
    const B = px(pose[b], ox, oy, scale);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  }

  // Head
  const head = px(pose.head, ox, oy, scale);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(head.x, head.y, Math.max(4, scale * 0.08), 0, Math.PI * 2);
  ctx.fill();

  // Cloak slash — tavern silhouette
  const chest = px(pose.chest, ox, oy, scale);
  const hip = px(pose.hip, ox, oy, scale);
  ctx.strokeStyle = "rgba(104, 160, 140, 0.45)";
  ctx.lineWidth = line + 1;
  ctx.beginPath();
  ctx.moveTo(chest.x - scale * 0.08, chest.y);
  ctx.quadraticCurveTo(hip.x - scale * 0.2, (chest.y + hip.y) / 2, hip.x - scale * 0.12, hip.y + scale * 0.05);
  ctx.stroke();

  const which = opts.rodWrist ?? "R";
  const wrist = wristWorld(pose, which, ox, oy, scale);
  ctx.fillStyle = "#e8b050";
  ctx.beginPath();
  ctx.arc(wrist.x, wrist.y, Math.max(2, scale * 0.035), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  return wrist;
}
