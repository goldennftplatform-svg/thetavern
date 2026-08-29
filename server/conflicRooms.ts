import { randomUUID } from "node:crypto";
import {
  CONFLIC_CELL_STATES,
  CONFLIC_GRID_SIZE,
  CONFLIC_SHIP_SPECS,
  CONFLIC_SHIP_TYPES,
  CONFLIC_TABLE_IDS,
  CONFLIC_TABLE_LABELS,
  type ConflicCell,
  type ConflicCellState,
  type ConflicCommandResult,
  type ConflicEnemyShip,
  type ConflicJoinResult,
  type ConflicLastShot,
  type ConflicOwnShip,
  type ConflicPhase,
  type ConflicPlacement,
  type ConflicPlayerMetadata,
  type ConflicPrivateRoomView,
  type ConflicRoomStatus,
  type ConflicRoomSummary,
  type ConflicSeat,
  type ConflicSeatStats,
  type ConflicShipType,
  type ConflicTableId,
} from "../src/net/conflicProtocol";

type InternalShip = ConflicPlacement & { hits: boolean[]; sunk: boolean };

type InternalPlayer = {
  playerId: string;
  name: string;
  avatarId?: string;
  resumeToken: string;
  clientIds: Set<string>;
  ships: InternalShip[];
  shots: Set<string>;
  actionIds: Set<string>;
  stats: ConflicSeatStats;
  lastSeen: number;
};

type Room = {
  tableId: ConflicTableId;
  seats: [InternalPlayer | null, InternalPlayer | null];
  turn: ConflicSeat | null;
  winner: ConflicSeat | null;
  revision: number;
  matchId: string;
  lastShot: ConflicLastShot | null;
};

type StoredPlayer = Omit<InternalPlayer, "clientIds" | "shots" | "actionIds"> & {
  clientIds: string[];
  shots: string[];
  actionIds: string[];
};

type StoredRoom = Omit<Room, "seats"> & {
  seats: [StoredPlayer | null, StoredPlayer | null];
};

export type ConflicRoomsSnapshot = {
  version: 1;
  rooms: StoredRoom[];
};

type JoinInput = {
  tableId: ConflicTableId;
  playerId?: string;
  name: string;
  avatarId?: string;
  resumeToken?: string;
  clientId: string;
};

const emptyStats = (): ConflicSeatStats => ({ shots: 0, hits: 0, misses: 0, shipsSunk: 0 });
const failure = (error: Parameters<typeof makeFailure>[0], message: string) => makeFailure(error, message);

function makeFailure(
  error: import("../src/net/conflicProtocol").ConflicErrorCode,
  message: string,
): { ok: false; error: import("../src/net/conflicProtocol").ConflicErrorCode; message: string } {
  return { ok: false, error, message };
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function emptyGrid(): ConflicCellState[][] {
  return Array.from({ length: CONFLIC_GRID_SIZE }, () =>
    Array<ConflicCellState>(CONFLIC_GRID_SIZE).fill(CONFLIC_CELL_STATES.empty),
  );
}

function seatOf(index: number): ConflicSeat {
  return index as ConflicSeat;
}

function metadata(player: InternalPlayer, seat: ConflicSeat): ConflicPlayerMetadata {
  return {
    seat,
    name: player.name,
    ...(player.avatarId ? { avatarId: player.avatarId } : {}),
    connected: Date.now() - player.lastSeen < 30_000,
    deployed: player.ships.length > 0,
  };
}

function roomPhase(room: Room): ConflicPhase {
  if (room.winner !== null) return "finished";
  if (!room.seats[0] || !room.seats[1]) return "waiting";
  if (!room.seats[0].ships.length || !room.seats[1].ships.length) return "placing";
  return "playing";
}

function roomStatus(room: Room): ConflicRoomStatus {
  if (!room.seats[0] && !room.seats[1]) return "empty";
  return roomPhase(room);
}

function validateFleet(placements: ConflicPlacement[]): string | null {
  if (!Array.isArray(placements) || placements.length !== CONFLIC_SHIP_TYPES.length) {
    return "Fleet must contain exactly five ships";
  }

  const occupied = new Map<string, ConflicShipType>();
  const seenTypes = new Set<ConflicShipType>();
  for (const placement of placements) {
    if (!placement || !CONFLIC_SHIP_TYPES.includes(placement.type) || seenTypes.has(placement.type)) {
      return "Fleet must contain each ship type exactly once";
    }
    seenTypes.add(placement.type);
    if (!Array.isArray(placement.cells) || placement.cells.length !== CONFLIC_SHIP_SPECS[placement.type].size) {
      return `${placement.type} has the wrong length`;
    }

    const cells: ConflicCell[] = [];
    const ownCells = new Set<string>();
    for (const cell of placement.cells) {
      if (
        !Array.isArray(cell) ||
        cell.length !== 2 ||
        !Number.isInteger(cell[0]) ||
        !Number.isInteger(cell[1]) ||
        cell[0] < 0 ||
        cell[0] >= CONFLIC_GRID_SIZE ||
        cell[1] < 0 ||
        cell[1] >= CONFLIC_GRID_SIZE
      ) {
        return `${placement.type} contains an out-of-bounds cell`;
      }
      const cellKey = key(cell[0], cell[1]);
      if (ownCells.has(cellKey) || occupied.has(cellKey)) return "Ships cannot overlap";
      ownCells.add(cellKey);
      cells.push([cell[0], cell[1]]);
    }

    const xs = cells.map(([x]) => x).sort((a, b) => a - b);
    const ys = cells.map(([, y]) => y).sort((a, b) => a - b);
    const horizontal = ys.every((y) => y === ys[0]) && xs.every((x, i) => i === 0 || x === xs[i - 1] + 1);
    const vertical = xs.every((x) => x === xs[0]) && ys.every((y, i) => i === 0 || y === ys[i - 1] + 1);
    if (!horizontal && !vertical) return `${placement.type} must be straight and contiguous`;

    for (const [x, y] of cells) occupied.set(key(x, y), placement.type);
  }

  for (const [cellKey, type] of occupied) {
    const [x, y] = cellKey.split(",").map(Number);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const neighbor = occupied.get(key(x + dx, y + dy));
        if (neighbor && neighbor !== type) return "Ships cannot touch, including diagonally";
      }
    }
  }
  return null;
}

function cloneShips(placements: ConflicPlacement[]): InternalShip[] {
  return placements.map((ship) => ({
    type: ship.type,
    cells: ship.cells.map(([x, y]) => [x, y]),
    hits: ship.cells.map(() => false),
    sunk: false,
  }));
}

export class ConflicRoomManager {
  private readonly rooms = new Map<ConflicTableId, Room>();

  constructor(snapshot?: ConflicRoomsSnapshot | null) {
    for (const tableId of CONFLIC_TABLE_IDS) {
      const stored = snapshot?.version === 1 ? snapshot.rooms.find((room) => room.tableId === tableId) : undefined;
      this.rooms.set(tableId, stored ? this.restoreRoom(stored) : this.newRoom(tableId));
    }
  }

  snapshot(): ConflicRoomsSnapshot {
    return {
      version: 1,
      rooms: [...this.rooms.values()].map((room) => ({
        ...room,
        lastShot: room.lastShot ? { ...room.lastShot } : null,
        seats: room.seats.map((player) => player ? {
          ...player,
          ships: player.ships.map((ship) => ({
            ...ship,
            cells: ship.cells.map(([x, y]) => [x, y]),
            hits: [...ship.hits],
          })),
          clientIds: [...player.clientIds],
          shots: [...player.shots],
          actionIds: [...player.actionIds],
          stats: { ...player.stats },
        } : null) as [StoredPlayer | null, StoredPlayer | null],
      })),
    };
  }

  isTableId(value: unknown): value is ConflicTableId {
    return typeof value === "string" && CONFLIC_TABLE_IDS.some((id) => id === value);
  }

  lobby(): ConflicRoomSummary[] {
    return CONFLIC_TABLE_IDS.map((tableId) => {
      const room = this.rooms.get(tableId)!;
      return {
        tableId,
        label: CONFLIC_TABLE_LABELS[tableId],
        status: roomStatus(room),
        occupants: room.seats.flatMap((player, index) =>
          player ? [metadata(player, seatOf(index))] : [],
        ),
      };
    });
  }

  join(input: JoinInput): ConflicJoinResult {
    this.expireStale();
    const room = this.rooms.get(input.tableId);
    if (!room) return failure("INVALID_TABLE", "Unknown Conflic table");

    if (input.resumeToken) {
      const index = room.seats.findIndex((player) => player?.resumeToken === input.resumeToken);
      if (index < 0) return failure("INVALID_RESUME_TOKEN", "Resume token does not match this table");
      const player = room.seats[index]!;
      player.clientIds.add(input.clientId);
      player.name = input.name;
      player.avatarId = input.avatarId;
      player.lastSeen = Date.now();
      room.revision += 1;
      const yourSeat = seatOf(index);
      return {
        ok: true,
        tableId: room.tableId,
        playerId: player.playerId,
        yourSeat,
        resumeToken: player.resumeToken,
        state: this.view(room.tableId, yourSeat)!,
      };
    }

    for (const candidate of this.rooms.values()) {
      for (const player of candidate.seats) {
        if (player?.clientIds.has(input.clientId)) {
          return failure("ALREADY_SEATED", "This browser is already seated at a Conflic table");
        }
      }
    }
    if (room.seats.some((player) => player?.playerId === input.playerId)) {
      return failure("INVALID_RESUME_TOKEN", "Use the existing resume token to reclaim this seat");
    }

    const index = room.seats.findIndex((player) => player === null);
    if (index < 0) return failure("TABLE_FULL", "This table already has two captains");
    const player: InternalPlayer = {
      playerId: input.playerId || randomUUID(),
      name: input.name,
      ...(input.avatarId ? { avatarId: input.avatarId } : {}),
      resumeToken: randomUUID(),
      clientIds: new Set([input.clientId]),
      ships: [],
      shots: new Set(),
      actionIds: new Set(),
      stats: emptyStats(),
      lastSeen: Date.now(),
    };
    room.seats[index] = player;
    room.revision += 1;
    const yourSeat = seatOf(index);
    return {
      ok: true,
      tableId: room.tableId,
      playerId: player.playerId,
      yourSeat,
      resumeToken: player.resumeToken,
      state: this.view(room.tableId, yourSeat)!,
    };
  }

  leave(tableId: ConflicTableId, resumeToken: string): ConflicCommandResult {
    const room = this.rooms.get(tableId);
    if (!room) return failure("INVALID_TABLE", "Unknown Conflic table");
    const index = room.seats.findIndex((player) => player?.resumeToken === resumeToken);
    if (index < 0) return failure("NOT_SEATED", "Resume token does not match a seat at this table");
    room.seats[index] = null;
    if (!room.seats[0] && !room.seats[1]) {
      this.rooms.set(tableId, this.newRoom(tableId));
      return { ok: true, revision: 0 };
    }
    const survivor = room.seats[0] ?? room.seats[1]!;
    survivor.ships = [];
    survivor.shots.clear();
    survivor.actionIds.clear();
    survivor.stats = emptyStats();
    room.turn = null;
    room.winner = null;
    room.lastShot = null;
    room.matchId = randomUUID();
    room.revision += 1;
    return { ok: true, revision: room.revision };
  }

  heartbeat(tableId: ConflicTableId, resumeToken: string): ConflicCommandResult {
    const found = this.findPlayer(tableId, resumeToken);
    if (!found) return failure("NOT_SEATED", "Resume token does not match a seat at this table");
    found.player.lastSeen = Date.now();
    found.room.revision += 1;
    return { ok: true, revision: found.room.revision };
  }

  expireStale(now = Date.now()): number {
    const expired: Array<{ tableId: ConflicTableId; resumeToken: string }> = [];
    for (const room of this.rooms.values()) {
      const maxAgeMs = roomPhase(room) === "playing" ? 30 * 60_000 : 5 * 60_000;
      for (const player of room.seats) {
        if (player && now - player.lastSeen > maxAgeMs) {
          expired.push({ tableId: room.tableId, resumeToken: player.resumeToken });
        }
      }
    }
    for (const player of expired) this.leave(player.tableId, player.resumeToken);
    return expired.length;
  }

  submitFleet(tableId: ConflicTableId, resumeToken: string, ships: ConflicPlacement[]): ConflicCommandResult {
    const found = this.findPlayer(tableId, resumeToken);
    if (!found) return failure("NOT_SEATED", "Resume token does not match a seat at this table");
    const { room, player } = found;
    if (roomPhase(room) === "playing" || roomPhase(room) === "finished" || player.ships.length) {
      return failure("WRONG_PHASE", "Fleet placement is closed");
    }
    const fleetError = validateFleet(ships);
    if (fleetError) return failure("INVALID_FLEET", fleetError);
    player.ships = cloneShips(ships);
    room.revision += 1;
    if (room.seats[0]?.ships.length && room.seats[1]?.ships.length) room.turn = 0;
    return { ok: true, revision: room.revision };
  }

  fire(
    tableId: ConflicTableId,
    resumeToken: string,
    x: number,
    y: number,
    actionId: string,
  ): ConflicCommandResult {
    const found = this.findPlayer(tableId, resumeToken);
    if (!found) return failure("NOT_SEATED", "Resume token does not match a seat at this table");
    const { room, player, seat } = found;
    if (roomPhase(room) !== "playing") return failure("WRONG_PHASE", "Match is not accepting shots");
    if (player.actionIds.has(actionId)) return failure("ACTION_REPLAY", "This actionId was already accepted");
    if (room.turn !== seat) return failure("OUT_OF_TURN", "It is the other captain's turn");
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= CONFLIC_GRID_SIZE || y < 0 || y >= CONFLIC_GRID_SIZE) {
      return failure("INVALID_PAYLOAD", "Shot coordinates must be integers from 0 through 9");
    }
    const shotKey = key(x, y);
    if (player.shots.has(shotKey)) return failure("ALREADY_TARGETED", "That coordinate was already targeted");

    const enemySeat: ConflicSeat = seat === 0 ? 1 : 0;
    const enemy = room.seats[enemySeat]!;
    const ship = enemy.ships.find((candidate) => candidate.cells.some(([cx, cy]) => cx === x && cy === y));
    player.actionIds.add(actionId);
    player.shots.add(shotKey);
    player.stats.shots += 1;

    let result: ConflicLastShot["result"] = "miss";
    if (ship) {
      const hitIndex = ship.cells.findIndex(([cx, cy]) => cx === x && cy === y);
      ship.hits[hitIndex] = true;
      player.stats.hits += 1;
      if (ship.hits.every(Boolean)) {
        ship.sunk = true;
        player.stats.shipsSunk += 1;
        result = "sunk";
      } else {
        result = "hit";
      }
    } else {
      player.stats.misses += 1;
    }

    room.lastShot = {
      seat,
      x,
      y,
      actionId,
      result,
      ...(ship ? { shipType: ship.type } : {}),
    };
    room.revision += 1;
    if (enemy.ships.every((candidate) => candidate.sunk)) {
      room.winner = seat;
      room.turn = null;
    } else {
      room.turn = enemySeat;
    }
    return { ok: true, revision: room.revision, shot: room.lastShot };
  }

  view(tableId: ConflicTableId, seat: ConflicSeat): ConflicPrivateRoomView | null {
    const room = this.rooms.get(tableId);
    const player = room?.seats[seat];
    if (!room || !player) return null;
    const enemySeat: ConflicSeat = seat === 0 ? 1 : 0;
    const enemy = room.seats[enemySeat];
    const ownGrid = emptyGrid();
    for (const ship of player.ships) {
      ship.cells.forEach(([x, y], index) => {
        ownGrid[y][x] = ship.sunk
          ? CONFLIC_CELL_STATES.sunk
          : ship.hits[index]
            ? CONFLIC_CELL_STATES.hit
            : CONFLIC_CELL_STATES.ship;
      });
    }
    if (enemy) {
      for (const shotKey of enemy.shots) {
        const [x, y] = shotKey.split(",").map(Number);
        if (ownGrid[y][x] === CONFLIC_CELL_STATES.empty) ownGrid[y][x] = CONFLIC_CELL_STATES.miss;
      }
    }

    const targetGrid = emptyGrid();
    for (const shotKey of player.shots) {
      const [x, y] = shotKey.split(",").map(Number);
      const targetShip = enemy?.ships.find((ship) => ship.cells.some(([cx, cy]) => cx === x && cy === y));
      targetGrid[y][x] = targetShip
        ? targetShip.sunk
          ? CONFLIC_CELL_STATES.sunk
          : CONFLIC_CELL_STATES.hit
        : CONFLIC_CELL_STATES.miss;
    }

    const ownShips: ConflicOwnShip[] = player.ships.map((ship) => ({
      type: ship.type,
      cells: ship.cells.map(([x, y]) => [x, y]),
      hits: [...ship.hits],
      sunk: ship.sunk,
    }));
    const enemyShips: ConflicEnemyShip[] = (enemy?.ships ?? []).map((ship) => ({
      type: ship.type,
      hits: ship.hits.filter(Boolean).length,
      sunk: ship.sunk,
    }));

    return {
      tableId,
      phase: roomPhase(room),
      yourSeat: seat,
      turn: room.turn,
      winner: room.winner,
      players: room.seats.map((candidate, index) =>
        candidate ? metadata(candidate, seatOf(index)) : null,
      ) as [ConflicPlayerMetadata | null, ConflicPlayerMetadata | null],
      ownShips,
      ownGrid,
      targetGrid,
      enemyShips,
      stats: room.seats.map((candidate) => ({ ...(candidate?.stats ?? emptyStats()) })) as [
        ConflicSeatStats,
        ConflicSeatStats,
      ],
      revision: room.revision,
      matchId: room.matchId,
      lastShot: room.lastShot ? { ...room.lastShot } : null,
    };
  }

  viewForToken(tableId: ConflicTableId, resumeToken: string): ConflicPrivateRoomView | null {
    const room = this.rooms.get(tableId);
    const seat = room?.seats.findIndex((player) => player?.resumeToken === resumeToken) ?? -1;
    return seat < 0 ? null : this.view(tableId, seatOf(seat));
  }

  private newRoom(tableId: ConflicTableId): Room {
    return {
      tableId,
      seats: [null, null],
      turn: null,
      winner: null,
      revision: 0,
      matchId: randomUUID(),
      lastShot: null,
    };
  }

  private restoreRoom(stored: StoredRoom): Room {
    return {
      ...stored,
      lastShot: stored.lastShot ? { ...stored.lastShot } : null,
      seats: stored.seats.map((player) => player ? {
        ...player,
        ships: player.ships.map((ship) => ({
          ...ship,
          cells: ship.cells.map(([x, y]) => [x, y]),
          hits: [...ship.hits],
        })),
        clientIds: new Set(player.clientIds.length ? player.clientIds : [player.playerId]),
        shots: new Set(player.shots),
        actionIds: new Set(player.actionIds),
        stats: { ...player.stats },
        lastSeen: player.lastSeen || Date.now(),
      } : null) as [InternalPlayer | null, InternalPlayer | null],
    };
  }

  private findPlayer(tableId: ConflicTableId, resumeToken: string) {
    const room = this.rooms.get(tableId);
    if (!room) return null;
    const index = room.seats.findIndex((player) => player?.resumeToken === resumeToken);
    if (index < 0) return null;
    return { room, player: room.seats[index]!, seat: seatOf(index) };
  }
}
