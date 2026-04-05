/** UTC calendar day — same deck for everyone that day (resets midnight UTC). */
export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Deterministic index from date string + optional salt (e.g. player id later). */
export function pickDailyPlatformIndex(platformCount: number, dateKey: string, salt = ""): number {
  if (platformCount <= 0) return 0;
  const s = `${dateKey}|${salt}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % platformCount;
}
