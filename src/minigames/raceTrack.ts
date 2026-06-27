/** Corsus desert circuit — closed waypoint track (normalized 0–1). */

export type TrackSeg = { x0: number; y0: number; x1: number; y1: number; len: number };
export type Track = { segments: TrackSeg[]; total: number };

export const TRACK_POINTS: Array<[number, number]> = [
  [0.5, 0.84],
  [0.74, 0.8],
  [0.9, 0.66],
  [0.94, 0.44],
  [0.82, 0.2],
  [0.56, 0.12],
  [0.3, 0.18],
  [0.14, 0.38],
  [0.12, 0.58],
  [0.26, 0.74],
  [0.4, 0.82],
];

/** Ideal lateral offset for a corner — negative = inside line on left-hand bend. */
export function racingLineOffset(track: Track, t: number, look = 0.028): number {
  const wrapped = ((t % 1) + 1) % 1;
  const eps = 0.01;
  const a = trackAt(((wrapped - eps) % 1 + 1) % 1, track).angle;
  const b = trackAt(((wrapped + eps) % 1 + 1) % 1, track).angle;
  let da = b - a;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const turnSign = Math.sign(da) || 1;
  const curv = Math.abs(da) / (eps * 2);
  const ahead = trackAt((wrapped + look) % 1, track);
  const ahead2 = trackAt((wrapped + look * 2) % 1, track);
  const bendAhead = Math.abs(Math.atan2(ahead2.y - ahead.y, ahead2.x - ahead.x));
  const line = -turnSign * Math.min(0.48, (curv * 14 + bendAhead * 2.2));
  return line;
}

export function buildTrack(pts: Array<[number, number]> = TRACK_POINTS): Track {
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

export function trackAt(t: number, track: Track): { x: number; y: number; angle: number } {
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
