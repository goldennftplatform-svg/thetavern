/** Corsus desert circuit — closed waypoint track (normalized 0–1). */

export type TrackSeg = { x0: number; y0: number; x1: number; y1: number; len: number };
export type Track = { segments: TrackSeg[]; total: number };

export const TRACK_POINTS: Array<[number, number]> = [
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
