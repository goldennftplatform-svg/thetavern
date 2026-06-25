import { charterDayId, formatCharterDayLabel } from "../game/charterDay";

export type HallTally = {
  catches: number;
  gambles: number;
  wins: number;
  feasts: number;
  mythics: number;
  renown: number;
  wisdom: number;
  milestones: number;
};

export type HallNightArchive = {
  dayId: string;
  closedAt: number;
  tally: HallTally;
};

type HallCharterStore = {
  v: 1;
  dayId: string;
  tally: HallTally;
  archive: HallNightArchive[];
};

const KEY = "moonwell_hall_charter";
const ARCHIVE_MAX = 30;

const EMPTY_TALLY = (): HallTally => ({
  catches: 0,
  gambles: 0,
  wins: 0,
  feasts: 0,
  mythics: 0,
  renown: 0,
  wisdom: 0,
  milestones: 0,
});

function readStore(): HallCharterStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return { v: 1, dayId: charterDayId(), tally: EMPTY_TALLY(), archive: [] };
    }
    const parsed = JSON.parse(raw) as HallCharterStore;
    if (!parsed || parsed.v !== 1) {
      return { v: 1, dayId: charterDayId(), tally: EMPTY_TALLY(), archive: [] };
    }
    return {
      v: 1,
      dayId: parsed.dayId ?? charterDayId(),
      tally: { ...EMPTY_TALLY(), ...parsed.tally },
      archive: Array.isArray(parsed.archive) ? parsed.archive : [],
    };
  } catch {
    return { v: 1, dayId: charterDayId(), tally: EMPTY_TALLY(), archive: [] };
  }
}

function writeStore(store: HallCharterStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function tallyHadActivity(t: HallTally): boolean {
  return (
    t.catches + t.gambles + t.feasts + t.wisdom + t.milestones > 0 || t.renown > 0
  );
}

export function initHallCharter(): { tally: HallTally; archive: HallNightArchive[]; dayId: string } {
  const today = charterDayId();
  let store = readStore();
  if (store.dayId !== today) {
    const archive = [...store.archive];
    if (tallyHadActivity(store.tally)) {
      archive.unshift({
        dayId: store.dayId,
        closedAt: Date.now(),
        tally: { ...store.tally },
      });
      if (archive.length > ARCHIVE_MAX) archive.length = ARCHIVE_MAX;
    }
    store = { v: 1, dayId: today, tally: EMPTY_TALLY(), archive };
    writeStore(store);
  }
  return { tally: store.tally, archive: store.archive, dayId: store.dayId };
}

export function persistHallTally(tally: HallTally, dayId: string, archive: HallNightArchive[]): void {
  writeStore({ v: 1, dayId, tally, archive });
}

export function formatHallArchiveLine(entry: HallNightArchive): string {
  const t = entry.tally;
  return `${formatCharterDayLabel(entry.dayId)}: ${t.catches} fish · ${t.gambles} wagers · ★${t.renown}`;
}
