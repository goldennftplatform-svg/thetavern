/** Corsus Circuit — compact touch / mouse steering wheel + boost pad. */

export type RaceWheelLayout = {
  wheelCx: number;
  wheelCy: number;
  wheelR: number;
  boostCx: number;
  boostCy: number;
  boostR: number;
};

const MAX_TURN = 0.82;

export function raceWheelLayout(w: number, h: number): RaceWheelLayout {
  const wheelR = Math.min(34, Math.max(26, w * 0.078));
  const boostR = Math.min(28, Math.max(22, wheelR * 0.82));
  const pad = wheelR + 14;
  return {
    wheelCx: pad,
    wheelCy: h - pad,
    wheelR,
    boostCx: w - pad,
    boostCy: h - pad,
    boostR,
  };
}

export function hitRaceWheel(nx: number, ny: number, layout: RaceWheelLayout): boolean {
  const dx = nx - layout.wheelCx;
  const dy = ny - layout.wheelCy;
  const hit = layout.wheelR + 14;
  return dx * dx + dy * dy <= hit * hit;
}

export function hitRaceBoost(nx: number, ny: number, layout: RaceWheelLayout): boolean {
  const dx = nx - layout.boostCx;
  const dy = ny - layout.boostCy;
  const hit = layout.boostR + 10;
  return dx * dx + dy * dy <= hit * hit;
}

/** Map pointer position to steer -1…1 (horizontal drag on wheel). */
export function steerFromWheelPointer(
  nx: number,
  ny: number,
  layout: RaceWheelLayout,
): number {
  const dx = nx - layout.wheelCx;
  const dy = ny - layout.wheelCy;
  const dist = Math.hypot(dx, dy) || 1;
  const horiz = dx / (layout.wheelR * 0.92);
  const rim = Math.max(0.35, Math.min(1, dist / layout.wheelR));
  return Math.max(-1, Math.min(1, horiz * rim));
}

export function drawRaceSteeringWheel(
  ctx: CanvasRenderingContext2D,
  layout: RaceWheelLayout,
  wheelAngle: number,
  active: boolean,
) {
  const { wheelCx: cx, wheelCy: cy, wheelR: r } = layout;

  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.92;

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = active ? "#e8b050" : "rgba(232, 176, 80, 0.55)";
  ctx.lineWidth = active ? 4 : 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#2a1810";
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, cy);
  ctx.rotate(wheelAngle);

  ctx.strokeStyle = "#9890c8";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8));
    ctx.stroke();
  }

  ctx.fillStyle = "#483058";
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e8b050";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#e8b050";
  ctx.beginPath();
  ctx.arc(0, -(r - 10), 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.fillStyle = "rgba(248, 240, 255, 0.55)";
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillText("STEER", cx, cy + r + 14);
  ctx.textAlign = "left";
}

export function drawRaceBoostPad(
  ctx: CanvasRenderingContext2D,
  layout: RaceWheelLayout,
  held: boolean,
) {
  const { boostCx: cx, boostCy: cy, boostR: r } = layout;

  ctx.fillStyle = held ? "rgba(232, 120, 80, 0.35)" : "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = held ? "#e87850" : "#4a3020";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = held ? "#f8f0c0" : "#e8b050";
  ctx.lineWidth = held ? 3 : 2;
  ctx.stroke();

  ctx.fillStyle = held ? "#f8f0ff" : "#e8b050";
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillText("⚡", cx, cy + 4);

  ctx.fillStyle = "rgba(248, 240, 255, 0.55)";
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.fillText("BOOST", cx, cy + r + 12);
  ctx.textAlign = "left";
}

export { MAX_TURN };
