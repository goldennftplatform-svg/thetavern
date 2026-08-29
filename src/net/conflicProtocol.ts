export const CONFLIC_TABLE_IDS = ["charter", "odyssey", "abyssal", "corsair", "voidwalker"] as const;

export type ConflicTableId = (typeof CONFLIC_TABLE_IDS)[number];

export const CONFLIC_TABLE_LABELS: Record<ConflicTableId, string> = {
  charter: "CHARTER NAVY",
  odyssey: "ODYSSEY PROTOCOL",
  abyssal: "ABYSSAL DEPTHS",
  corsair: "CORSAIR'S GAMBIT",
  voidwalker: "VOIDWALKER",
};

export const CONFLIC_SHIP_TYPES = [
  "carrier",
  "battleship",
  "cruiser",
  "submarine",
  "destroyer",
] as const;

export type ConflicShipType = (typeof CONFLIC_SHIP_TYPES)[number];

export type ConflicShipSpec = { size: number; label: string; short: string };

export const CONFLIC_SHIP_SPECS: Record<ConflicShipType, ConflicShipSpec> = {
  carrier: { size: 5, label: "CARRIER", short: "CV" },
  battleship: { size: 4, label: "BATTLESHIP", short: "BB" },
  cruiser: { size: 3, label: "CRUISER", short: "CA" },
  submarine: { size: 3, label: "SUBMARINE", short: "SS" },
  destroyer: { size: 2, label: "DESTROYER", short: "DD" },
};

export const CONFLIC_GRID_SIZE = 10;
export const CONFLIC_CELL_STATES = { empty: 0, ship: 1, hit: 2, miss: 3, sunk: 4 } as const;

export type ConflicCellState = 0 | 1 | 2 | 3 | 4;
export type ConflicSeat = 0 | 1;
export type ConflicPhase = "waiting" | "placing" | "playing" | "finished";
export type ConflicRoomStatus = "empty" | ConflicPhase;
export type ConflicCell = [number, number];

export type ConflicPlacement = {
  type: ConflicShipType;
  cells: ConflicCell[];
};

export type ConflicPlayerMetadata = {
  seat: ConflicSeat;
  name: string;
  avatarId?: string;
  connected: boolean;
  deployed: boolean;
};

export type ConflicRoomSummary = {
  tableId: ConflicTableId;
  label: string;
  status: ConflicRoomStatus;
  occupants: ConflicPlayerMetadata[];
};

export type ConflicOwnShip = ConflicPlacement & {
  hits: boolean[];
  sunk: boolean;
};

export type ConflicEnemyShip = {
  type: ConflicShipType;
  hits: number;
  sunk: boolean;
};

export type ConflicSeatStats = {
  shots: number;
  hits: number;
  misses: number;
  shipsSunk: number;
};

export type ConflicLastShot = {
  seat: ConflicSeat;
  x: number;
  y: number;
  actionId: string;
  result: "hit" | "miss" | "sunk";
  shipType?: ConflicShipType;
};

export type ConflicPrivateRoomView = {
  tableId: ConflicTableId;
  phase: ConflicPhase;
  yourSeat: ConflicSeat;
  turn: ConflicSeat | null;
  winner: ConflicSeat | null;
  players: [ConflicPlayerMetadata | null, ConflicPlayerMetadata | null];
  ownShips: ConflicOwnShip[];
  ownGrid: ConflicCellState[][];
  targetGrid: ConflicCellState[][];
  enemyShips: ConflicEnemyShip[];
  stats: [ConflicSeatStats, ConflicSeatStats];
  revision: number;
  matchId: string;
  lastShot: ConflicLastShot | null;
};

export type ConflicErrorCode =
  | "INVALID_PAYLOAD"
  | "INVALID_TABLE"
  | "TABLE_FULL"
  | "ALREADY_SEATED"
  | "INVALID_RESUME_TOKEN"
  | "NOT_SEATED"
  | "INVALID_FLEET"
  | "WRONG_PHASE"
  | "OUT_OF_TURN"
  | "ALREADY_TARGETED"
  | "ACTION_REPLAY";

export type ConflicFailure = { ok: false; error: ConflicErrorCode; message: string };

export type ConflicJoinResult =
  | {
      ok: true;
      tableId: ConflicTableId;
      playerId: string;
      yourSeat: ConflicSeat;
      resumeToken: string;
      state: ConflicPrivateRoomView;
    }
  | ConflicFailure;

export type ConflicCommandResult =
  | { ok: true; revision: number; shot?: ConflicLastShot }
  | ConflicFailure;
