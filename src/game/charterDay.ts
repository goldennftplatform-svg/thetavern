/** Charter night rolls at 4:00am Pacific — scores archive, ledger resets. */

const CHARTER_TZ = "America/Los_Angeles";
const ROLLOVER_HOUR = 4;

export function charterDayId(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHARTER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  let y = Number(get("year"));
  let m = Number(get("month"));
  let d = Number(get("day"));
  const h = Number(get("hour"));
  if (h < ROLLOVER_HOUR) {
    const t = Date.UTC(y, m - 1, d - 1);
    const prev = new Date(t);
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth() + 1;
    d = prev.getUTCDate();
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatCharterDayLabel(dayId: string): string {
  const [ys, ms, ds] = dayId.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return dayId;
  const stamp = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(stamp);
}

export const CHARTER_RESET_BLURB =
  "Scores seal at 4am Pacific — prior charter nights live in the archive ledger.";
