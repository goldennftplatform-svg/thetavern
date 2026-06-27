/**
 * Demplar Knight — procedural pixel sprites (charter purple / gold palette).
 * Platformer hero, racer mount, and veil-shard flyer.
 */

const K = {
  armor: "#9890c8",
  armorDark: "#483058",
  gold: "#e8b050",
  goldDim: "#a87830",
  tabard: "#583868",
  cape: "#684878",
  visor: "#1a1420",
  steel: "#c8d8e8",
  boot: "#2a1810",
  skin: "#c8a888",
} as const;

export type KnightPose = "run" | "jump" | "fall";

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Side-view charter knight — Mario-scale platformer hero. */
export function drawKnightPlatformer(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  opts: { pose: KnightPose; frame?: number; facing?: 1 | -1; scale?: number },
) {
  const flip = opts.facing ?? 1;
  const scale = opts.scale ?? 2;
  const frame = (opts.frame ?? 0) % 2;
  const pose = opts.pose;

  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(flip * scale, scale);

  const ox = -8;

  if (pose === "jump" || pose === "fall") {
    px(ctx, ox + 2, -6, 4, 4, K.boot);
    px(ctx, ox + 10, -6, 4, 4, K.boot);
  } else if (frame === 0) {
    px(ctx, ox + 1, -5, 4, 5, K.boot);
    px(ctx, ox + 10, -4, 4, 4, K.boot);
  } else {
    px(ctx, ox + 2, -4, 4, 4, K.boot);
    px(ctx, ox + 9, -5, 4, 5, K.boot);
  }

  px(ctx, ox + 3, -14, 10, 10, K.tabard);
  px(ctx, ox + 2, -15, 12, 4, K.armor);
  px(ctx, ox + 1, -13, 2, 8, K.armorDark);
  px(ctx, ox + 13, -13, 2, 8, K.armorDark);
  px(ctx, ox + 4, -12, 8, 2, K.gold);

  if (pose === "jump") {
    px(ctx, ox - 5, -20, 6, 14, K.cape);
  } else if (pose === "fall") {
    px(ctx, ox - 4, -16, 5, 12, K.cape);
  } else {
    px(ctx, ox - 4, -18, 5, frame === 0 ? 14 : 12, K.cape);
  }

  px(ctx, ox + 3, -22, 10, 9, K.armor);
  px(ctx, ox + 4, -21, 8, 3, K.armorDark);
  px(ctx, ox + 5, -19, 6, 2, K.visor);
  px(ctx, ox + 4, -23, 8, 2, K.gold);
  px(ctx, ox + 7, -25, 2, 3, K.gold);

  if (pose === "jump") {
    px(ctx, ox + 12, -24, 2, 12, K.steel);
    px(ctx, ox + 11, -24, 4, 3, K.gold);
    px(ctx, ox + 13, -14, 2, 4, K.skin);
  } else {
    px(ctx, ox + 13, -20, 2, 10, K.steel);
    px(ctx, ox + 12, -20, 4, 2, K.goldDim);
    px(ctx, ox + 14, -12, 2, 4, K.skin);
  }

  if (pose === "run") {
    px(ctx, ox + 0, -10, 3, 2, K.goldDim);
  }

  ctx.restore();
}

/** Side-view knight on charter cart & steed — hold-to-gallop trial. */
export function drawKnightCart(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  opts: { pose: KnightPose; frame?: number; scale?: number },
) {
  const scale = opts.scale ?? 2;
  const frame = (opts.frame ?? 0) % 2;
  const pose = opts.pose;

  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(scale, scale);

  const ox = -18;

  px(ctx, ox + 2, -4, 28, 5, K.boot);
  px(ctx, ox + 0, -3, 4, 4, "#4a3020");
  px(ctx, ox + 26, -3, 4, 4, "#4a3020");

  if (frame === 0) {
    px(ctx, ox + 6, -10, 5, 7, "#6a5040");
    px(ctx, ox + 20, -9, 5, 6, "#6a5040");
  } else {
    px(ctx, ox + 7, -9, 5, 6, "#6a5040");
    px(ctx, ox + 19, -10, 5, 7, "#6a5040");
  }

  px(ctx, ox + 4, -14, 22, 6, "#5a4030");
  px(ctx, ox + 2, -16, 26, 3, K.goldDim);

  px(ctx, ox + 10, -24, 10, 10, K.tabard);
  px(ctx, ox + 9, -25, 12, 4, K.armor);
  px(ctx, ox + 10, -23, 8, 2, K.gold);
  px(ctx, ox + 10, -32, 10, 9, K.armor);
  px(ctx, ox + 11, -31, 8, 3, K.armorDark);
  px(ctx, ox + 12, -29, 6, 2, K.visor);
  px(ctx, ox + 11, -33, 8, 2, K.gold);

  if (pose === "jump") {
    px(ctx, ox + 6, -28, 4, 10, K.steel);
  } else {
    px(ctx, ox + 22, -22, 2, 8, K.steel);
  }

  ctx.restore();
}

/** Classic vector-style knight lance — Veil Shards trial ship. */
export function drawKnightAsteroidShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.strokeStyle = "#68e8a8";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = "#9890c8";
  ctx.fillRect(-8, -4, 8, 8);
  ctx.fillStyle = "#e8b050";
  ctx.fillRect(-6, -6, 4, 2);

  ctx.strokeStyle = "#e8b050";
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-14, 0);
  ctx.stroke();

  ctx.restore();
}

/** Top-down racer — knight on a charter steed. */
export function drawKnightRacer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  isPlayer: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const body = isPlayer ? K.armor : "#6a5048";
  const trim = isPlayer ? K.gold : "#988878";

  px(ctx, -14, -6, 28, 12, body);
  px(ctx, -10, -8, 20, 4, trim);
  px(ctx, 6, -5, 10, 10, K.armorDark);
  px(ctx, 8, -3, 6, 4, K.visor);
  px(ctx, -16, -2, 6, 4, trim);

  ctx.restore();
}

/** Veil-shard trial — knight on a glider-shield. */
export function drawKnightFlyer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = K.armorDark;
  ctx.beginPath();
  ctx.moveTo(-16, 4);
  ctx.lineTo(0, -20);
  ctx.lineTo(16, 4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = K.gold;
  ctx.lineWidth = 2;
  ctx.stroke();

  px(ctx, -6, -10, 12, 10, K.armor);
  px(ctx, -5, -16, 10, 7, K.armorDark);
  px(ctx, -3, -14, 6, 2, K.visor);
  px(ctx, -4, -17, 8, 2, K.gold);
  px(ctx, 8, -12, 2, 8, K.steel);

  ctx.restore();
}

/** Brief / title preview — larger idle knight. */
export function drawKnightPortrait(
  ctx: CanvasRenderingContext2D,
  cx: number,
  footY: number,
  tick: number,
  scale = 3,
) {
  drawKnightPlatformer(ctx, cx, footY, {
    pose: "run",
    frame: Math.floor(tick * 0.12) % 2,
    facing: 1,
    scale,
  });
}
