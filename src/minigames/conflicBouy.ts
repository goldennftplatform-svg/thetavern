/**
 * Conflic Bouy — Charter Battleship.
 * 10×10 grid, standard fleet, turn-based vs Agent or 1v1 hot-seat.
 * Now with: fleet status, parity AI, auto-randomize, ship health bars, hotseat placement for both players.
 */

import { playPlatformLand, playPlatformPickup, playWarriorImpact } from "../audio/warriorSfx";
import { playJackIntro, playJackOutro, playJackTaunt } from "../audio/jackSparrow";
import { BouyTheme, getTheme, BouyThemeId } from "./conflicBouyThemes";
import { getContextualSparrowLine, getVariantLine } from "./conflicBouyPersonality";
import type { ConflicPlacement, ConflicPrivateRoomView } from "../net/conflicProtocol";
import {
  DEFAULT_MINE_CONFIG,
  drill,
  newMineStats,
  seedMineNodes,
  settleMine,
  touchStreak,
  type MineConfig,
  type MineNode,
  type MineStats,
  type MineSettlement,
} from "./mine";

export type BouyMode = "agent" | "hotseat" | "online";
export type BouyPhase = "setup" | "play" | "over";
export type SetupSubPhase = "player1" | "player2" | "done";

export type ShipType = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

export type ShipAbility = {
  id: string;
  name: string;
  description: string;
  cooldown: number; // turns
  lastUsed: number; // turn number when last used, -1 if never
};

export const SHIP_ABILITIES: Record<ShipType, ShipAbility> = {
  carrier: {
    id: "air_strike",
    name: "AIR STRIKE",
    description: "Reveal a 3x3 area on enemy grid",
    cooldown: 3,
    lastUsed: -1,
  },
  battleship: {
    id: "broadside",
    name: "BROADSIDE",
    description: "Fire 3 shots in a horizontal line",
    cooldown: 4,
    lastUsed: -1,
  },
  cruiser: {
    id: "radar_ping",
    name: "RADAR PING",
    description: "Reveal all ships in a cross pattern (+)",
    cooldown: 3,
    lastUsed: -1,
  },
  submarine: {
    id: "silent_run",
    name: "SILENT RUN",
    description: "Next 2 enemy shots against this ship miss (evasion)",
    cooldown: 4,
    lastUsed: -1,
  },
  destroyer: {
    id: "depth_charge",
    name: "DEPTH CHARGE",
    description: "Auto-hit a random enemy ship cell (if any remain)",
    cooldown: 5,
    lastUsed: -1,
  },
};

export const SHIP_SPECS: Record<ShipType, { size: number; label: string; short: string }> = {
  carrier: { size: 5, label: "CARRIER", short: "CV" },
  battleship: { size: 4, label: "BATTLESHIP", short: "BB" },
  cruiser: { size: 3, label: "CRUISER", short: "CA" },
  submarine: { size: 3, label: "SUBMARINE", short: "SS" },
  destroyer: { size: 2, label: "DESTROYER", short: "DD" },
};

export const FLEET: ShipType[] = ["carrier", "battleship", "cruiser", "submarine", "destroyer"];
export const GRID_SIZE = 10;
export const CELL_STATES = { empty: 0, ship: 1, hit: 2, miss: 3, sunk: 4 } as const;
export type CellState = 0 | 1 | 2 | 3 | 4;

export type Ship = {
  type: ShipType;
  cells: [number, number][];
  hits: boolean[];
  sunk: boolean;
  abilityUsed: number; // -1 if never used, otherwise turn number
  abilityActive: boolean; // for passive abilities like silent run
  evasionCharges: number; // for silent run evasion charges
};

export type Board = {
  grid: CellState[][];
  ships: Ship[];
  shipMap: Map<string, Ship>;
};

export type BouyResult = {
  winner: "player" | "agent" | "player1" | "player2" | null;
  playerHits: number;
  playerMisses: number;
  agentHits: number;
  agentMisses: number;
  turns: number;
  /** Mining 201 settlement, present when a mine round was played. */
  mine?: MineSettlement;
};

function emptyGrid(): CellState[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(CELL_STATES.empty));
}

function createBoard(): Board {
  return { grid: emptyGrid(), ships: [], shipMap: new Map() };
}

function canPlace(grid: CellState[][], cells: [number, number][]): boolean {
  for (const [x, y] of cells) {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
    if (grid[y][x] !== CELL_STATES.empty) return false;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          if (grid[ny][nx] === CELL_STATES.ship) return false;
        }
      }
    }
  }
  return true;
}

function placeShip(board: Board, type: ShipType, origin: [number, number], horizontal: boolean): boolean {
  const size = SHIP_SPECS[type].size;
  const cells: [number, number][] = [];
  for (let i = 0; i < size; i++) {
    cells.push(horizontal ? [origin[0] + i, origin[1]] : [origin[0], origin[1] + i]);
  }
  if (!canPlace(board.grid, cells)) return false;
  for (const [x, y] of cells) board.grid[y][x] = CELL_STATES.ship;
  const ship: Ship = { type, cells, hits: Array(size).fill(false), sunk: false, abilityUsed: -1, abilityActive: false, evasionCharges: 0 };
  board.ships.push(ship);
  for (const [x, y] of cells) board.shipMap.set(`${x},${y}`, ship);
  return true;
}

function randomBoard(): Board {
  const board = createBoard();
  for (const type of FLEET) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 100) {
      const horizontal = Math.random() < 0.5;
      const size = SHIP_SPECS[type].size;
      const maxX = horizontal ? GRID_SIZE - size : GRID_SIZE - 1;
      const maxY = horizontal ? GRID_SIZE - 1 : GRID_SIZE - size;
      const x = Math.floor(Math.random() * (maxX + 1));
      const y = Math.floor(Math.random() * (maxY + 1));
      placed = placeShip(board, type, [x, y], horizontal);
      attempts++;
    }
  }
  return board;
}

function checkSunk(board: Board, ship: Ship): boolean {
  if (ship.sunk) return true;
  if (ship.hits.every((h) => h)) {
    ship.sunk = true;
    for (const [x, y] of ship.cells) board.grid[y][x] = CELL_STATES.sunk;
    return true;
  }
  return false;
}

export class ConflicBouy {
  mode: BouyMode = "agent";
  phase: BouyPhase = "setup";
  setupSubPhase: SetupSubPhase = "player1";
  playerBoard = createBoard();
  opponentBoard = createBoard();
  player1Board = createBoard();
  player2Board = createBoard();
  private concealedBoard = createBoard();
  playerTargetGrid: CellState[][] = emptyGrid();
  opponentTargetGrid: CellState[][] = emptyGrid();
  currentTurn: "player" | "agent" | "player1" | "player2" = "player";
  handoffPending = false;
  private handoffReason: "setup" | "turn" = "setup";
  private onlineCallbacks?: {
    deploy: (ships: ConflicPlacement[]) => void;
    fire: (x: number, y: number) => void;
  };
  private onlineView: ConflicPrivateRoomView | null = null;
  private onlineStatus = "";
  private onlineFleetSubmitted = false;
  private lastOnlineActionId = "";
  playerPlacing = 0;
  horizontal = true;
  hoverCell: [number, number] | null = null;
  result: BouyResult = {
    winner: null,
    playerHits: 0,
    playerMisses: 0,
    agentHits: 0,
    agentMisses: 0,
    turns: 0,
  };
  lastHit: [number, number] | null = null;
  huntMode = false;
  huntQueue: [number, number][] = [];
  private flashCells: Array<{ x: number; y: number; board: "player" | "opponent" | "player1" | "player2"; type: "hit" | "miss" | "sink"; timer: number }> = [];
  private message = "";
  private messageTimer = 0;
  private messageQueue: string[] = [];
  private agentThinking = false;
  private agentTurnTimeout: number | null = null;
  private agentDifficulty: "easy" | "normal" | "hard" = "normal";
  private lastHitDirection: [number, number] | null = null;
  /** Visible agent aiming reticle before the shot lands on the player's board. */
  private agentAim: { x: number; y: number; t: number; dur: number } | null = null;
  themeId: BouyThemeId = "charter";
  stake = 0;
  private lastW = 0;
  private lastH = 0;
  private _gameOverTime = 0;

  /** Mining 201 — MINE THE BLOCK layer. */
  mineEnabled = true;
  mineConfig: MineConfig = DEFAULT_MINE_CONFIG;
  mineStats: MineStats = newMineStats(DEFAULT_MINE_CONFIG);
  mineNodes: Map<string, MineNode> = new Map();
  mineSettlement: MineSettlement | null = null;
  mineExhausted = false;

  // Visual effects
  private screenShake = 0;
  private screenShakeX = 0;
  private screenShakeY = 0;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; type: "debris" | "smoke" | "ember" | "spark" }> = [];
  private hitPause = 0;

  // Popup system (floating text on canvas)
  private popups: Array<{ text: string; x: number; y: number; life: number; maxLife: number; color: string; size: number; type: "hit" | "miss" | "sink" | "combo" | "ability" | "firstblood" }> = [];
  // Combo tracker
  private combo = 0;
  private comboTimer = 0;
  private firstBlood = false;
  // Cannon fire projectile
  private cannonFire: { sx: number; sy: number; tx: number; ty: number; t: number; duration: number; color: string } | null = null;
  // Sink sequence (bow-to-stern flash)
  private sinkSequence: { cells: [number, number][]; board: "player" | "opponent"; timer: number; cellIndex: number } | null = null;
  // Smooth health bar interpolation
  private smoothHealth: Map<string, number> = new Map();
  // Turn transition wipe
  private turnWipe = 0;
  private turnWipeColor = "";

  constructor(opts?: {
    mode?: BouyMode;
    theme?: BouyThemeId;
    stake?: number;
    onlineCallbacks?: {
      deploy: (ships: ConflicPlacement[]) => void;
      fire: (x: number, y: number) => void;
    };
  }) {
    this.mode = opts?.mode ?? "agent";
    this.themeId = opts?.theme ?? "charter";
    this.stake = opts?.stake ?? 0;
    this.onlineCallbacks = opts?.onlineCallbacks;
    this.reset();
  }

  get theme(): BouyTheme {
    return getTheme(this.themeId);
  }

  private getSparrowLine(event: string): string {
    // Try theme variant first
    const variantLine = getVariantLine(this.themeId, event as any, {
      mode: this.mode,
      phase: this.phase,
      currentTurn: this.currentTurn,
      playerBoard: this.getOwnGrid(),
      opponentBoard: this.getOpponentBoard(),
      result: this.result,
    });
    if (variantLine) return variantLine;

    // Fall back to main Sparrow system
    return getContextualSparrowLine(event, {
      mode: this.mode === "online" ? "agent" : this.mode,
      phase: this.phase,
      currentTurn: this.currentTurn,
      playerBoard: this.mode === "hotseat" ? (this.currentTurn === "player1" ? this.player1Board : this.player2Board) : this.playerBoard,
      opponentBoard: this.getOpponentBoard(),
      result: this.result,
    });
  }

  setTheme(themeId: BouyThemeId) {
    this.themeId = themeId;
  }

  reset() {
    if (this.agentTurnTimeout !== null) {
      window.clearTimeout(this.agentTurnTimeout);
      this.agentTurnTimeout = null;
    }
    this.playerBoard = createBoard();
    this.opponentBoard = this.mode === "agent" ? randomBoard() : createBoard();
    this.player1Board = createBoard();
    this.player2Board = createBoard();
    this.playerTargetGrid = emptyGrid();
    this.opponentTargetGrid = emptyGrid();
    this.currentTurn = "player";
    this.handoffPending = false;
    this.handoffReason = "setup";
    this.onlineView = null;
    this.onlineStatus = this.mode === "online" ? "WAITING FOR A RIVAL" : "";
    this.onlineFleetSubmitted = false;
    this.lastOnlineActionId = "";
    this.playerPlacing = 0;
    this.horizontal = true;
    this.hoverCell = null;
    this.result = { winner: null, playerHits: 0, playerMisses: 0, agentHits: 0, agentMisses: 0, turns: 0 };
    // Mining 201 — reseed the claim with ore/pay nodes.
    this.mineEnabled = this.mode !== "online";
    this.mineConfig = DEFAULT_MINE_CONFIG;
    this.mineStats = newMineStats(this.mineConfig);
    this.mineNodes = seedMineNodes(
      (x, y) => this.opponentBoard.grid[y][x] === CELL_STATES.ship,
      this.mineConfig,
    );
    this.mineSettlement = null;
    this.mineExhausted = false;
    this.lastHit = null;
    this.huntMode = false;
    this.huntQueue = [];
    this.flashCells = [];
    this.message = "";
    this.messageTimer = 0;
    this.messageQueue = [];
    this.phase = "setup";
    this.setupSubPhase = this.mode === "hotseat" ? "player1" : "done";
    this.agentThinking = false;
    this.agentDifficulty = "normal";
    this.lastHitDirection = null;
    // Reset animation state
    this.popups = [];
    this.combo = 0;
    this.comboTimer = 0;
    this.firstBlood = false;
    this.cannonFire = null;
    this.sinkSequence = null;
    this.smoothHealth.clear();
    this.turnWipe = 0;
  }

  setMode(mode: BouyMode) {
    this.mode = mode;
    this.reset();
  }

  setDifficulty(difficulty: "easy" | "normal" | "hard") {
    this.agentDifficulty = difficulty;
  }

  getCurrentShipType(): ShipType {
    return FLEET[this.playerPlacing] ?? FLEET[FLEET.length - 1];
  }

  getCurrentShipSize(): number {
    return SHIP_SPECS[this.getCurrentShipType()].size;
  }

  getCurrentBoard(): Board {
    if (this.mode === "hotseat") {
      return this.setupSubPhase === "player1" ? this.player1Board : this.player2Board;
    }
    return this.playerBoard;
  }

  getOpponentBoard(): Board {
    if (this.mode === "hotseat") {
      return this.currentTurn === "player1" ? this.player2Board : this.player1Board;
    }
    return this.opponentBoard;
  }

  getTargetGrid(): CellState[][] {
    if (this.mode === "hotseat") {
      return this.currentTurn === "player1" ? this.playerTargetGrid : this.opponentTargetGrid;
    }
    return this.opponentTargetGrid;
  }

  getOwnGrid(): CellState[][] {
    if (this.mode === "hotseat") {
      if (this.phase === "setup") return this.getCurrentBoard().grid;
      return this.currentTurn === "player1" ? this.player1Board.grid : this.player2Board.grid;
    }
    return this.playerBoard.grid;
  }

  getOnlineFleet(): ConflicPlacement[] {
    return this.playerBoard.ships.map((ship) => ({
      type: ship.type,
      cells: ship.cells.map(([x, y]) => [x, y]),
    }));
  }

  applyOnlineView(view: ConflicPrivateRoomView) {
    if (this.mode !== "online") return;
    const previousAction = this.lastOnlineActionId;
    this.onlineView = view;
    this.onlineFleetSubmitted = view.ownShips.length > 0;
    this.playerPlacing = this.onlineFleetSubmitted ? FLEET.length : 0;

    this.playerBoard = createBoard();
    this.playerBoard.grid = view.ownGrid.map((row) => [...row]) as CellState[][];
    for (const source of view.ownShips) {
      const ship: Ship = {
        type: source.type,
        cells: source.cells.map(([x, y]) => [x, y]),
        hits: [...source.hits],
        sunk: source.sunk,
        abilityUsed: -1,
        abilityActive: false,
        evasionCharges: 0,
      };
      this.playerBoard.ships.push(ship);
      for (const [x, y] of ship.cells) this.playerBoard.shipMap.set(`${x},${y}`, ship);
    }

    this.opponentBoard = createBoard();
    for (const source of view.enemyShips) {
      this.opponentBoard.ships.push({
        type: source.type,
        cells: [],
        hits: Array.from({ length: SHIP_SPECS[source.type].size }, (_, index) => index < source.hits),
        sunk: source.sunk,
        abilityUsed: -1,
        abilityActive: false,
        evasionCharges: 0,
      });
    }
    this.opponentTargetGrid = view.targetGrid.map((row) => [...row]) as CellState[][];
    this.currentTurn = view.turn === view.yourSeat ? "player" : "agent";
    this.result.playerHits = view.stats[view.yourSeat].hits;
    this.result.playerMisses = view.stats[view.yourSeat].misses;
    const enemySeat = view.yourSeat === 0 ? 1 : 0;
    this.result.agentHits = view.stats[enemySeat].hits;
    this.result.agentMisses = view.stats[enemySeat].misses;
    this.result.turns = view.stats[0].shots + view.stats[1].shots;

    if (view.phase === "waiting") {
      this.phase = "setup";
      this.onlineStatus = "WAITING FOR A RIVAL";
    } else if (view.phase === "placing") {
      this.phase = "setup";
      this.onlineStatus = this.onlineFleetSubmitted ? "FLEET LOCKED — WAITING FOR RIVAL" : "";
    } else if (view.phase === "playing") {
      this.phase = "play";
      const enemy = view.players[enemySeat];
      this.onlineStatus = enemy && !enemy.connected ? "RIVAL RECONNECTING" : "";
    } else {
      this.phase = "over";
      this.onlineStatus = "";
      this.result.winner = view.winner === view.yourSeat ? "player" : "agent";
      this._gameOverTime = performance.now();
    }

    if (view.lastShot && view.lastShot.actionId !== previousAction) {
      this.lastOnlineActionId = view.lastShot.actionId;
      const shotByLocal = view.lastShot.seat === view.yourSeat;
      this.flashCells.push({
        x: view.lastShot.x,
        y: view.lastShot.y,
        board: shotByLocal ? "opponent" : "player",
        type: view.lastShot.result === "sunk" ? "sink" : view.lastShot.result,
        timer: view.lastShot.result === "sunk" ? 800 : 300,
      });
      this.setMessage(
        shotByLocal
          ? `YOUR SHOT: ${view.lastShot.result.toUpperCase()}`
          : `INCOMING: ${view.lastShot.result.toUpperCase()}`,
        1800,
      );
      playWarriorImpact();
    }
  }

  canPlaceAt(x: number, y: number): boolean {
    const size = this.getCurrentShipSize();
    const cells: [number, number][] = [];
    for (let i = 0; i < size; i++) {
      cells.push(this.horizontal ? [x + i, y] : [x, y + i]);
    }
    return canPlace(this.getCurrentBoard().grid, cells);
  }

  placeCurrentShip(x: number, y: number): boolean {
    if (this.mode === "online" && this.onlineFleetSubmitted) return false;
    const board = this.getCurrentBoard();
    const type = this.getCurrentShipType();
    const cells: [number, number][] = [];
    for (let i = 0; i < this.getCurrentShipSize(); i++) {
      cells.push(this.horizontal ? [x + i, y] : [x, y + i]);
    }
    if (!canPlace(board.grid, cells)) return false;
    for (const [cx, cy] of cells) board.grid[cy][cx] = CELL_STATES.ship;
    const ship: Ship = { type, cells, hits: Array(this.getCurrentShipSize()).fill(false), sunk: false, abilityUsed: -1, abilityActive: false, evasionCharges: 0 };
    board.ships.push(ship);
    for (const [cx, cy] of cells) board.shipMap.set(`${cx},${cy}`, ship);
    this.playerPlacing++;
    playPlatformPickup("coin");
    if (this.playerPlacing === 1 && this.mode !== "hotseat") {
      this.setMessage(this.getSparrowLine("setup_deploy"), 3000);
    }
    if (this.playerPlacing >= FLEET.length) {
      if (this.mode === "online") {
        this.onlineFleetSubmitted = true;
        this.onlineStatus = "FLEET LOCKED — WAITING FOR RIVAL";
        this.onlineCallbacks?.deploy(this.getOnlineFleet());
        return true;
      }
      if (this.mode === "hotseat" && this.setupSubPhase === "player1") {
        this.setupSubPhase = "player2";
        this.playerPlacing = 0;
        this.horizontal = true;
        this.hoverCell = null;
        this.beginHandoff("setup");
      } else {
        this.phase = "play";
        this.setupSubPhase = "done";
        this.currentTurn = this.mode === "hotseat" ? "player1" : "player";
        this.opponentBoard = this.mode === "agent" ? randomBoard() : this.player2Board;
        this.beginHandoff("setup");
        this.setMessage(this.getSparrowLine("game_start"), 2500);
        if (this.mode === "agent") {
          playJackIntro();
        }
      }
    }
    return true;
  }

  randomizeCurrentBoard() {
    if (this.mode === "online" && this.onlineFleetSubmitted) return;
    const board = this.getCurrentBoard();
    board.grid = emptyGrid();
    board.ships = [];
    board.shipMap.clear();
    for (const type of FLEET) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 100) {
        const horizontal = Math.random() < 0.5;
        const size = SHIP_SPECS[type].size;
        const maxX = horizontal ? GRID_SIZE - size : GRID_SIZE - 1;
        const maxY = horizontal ? GRID_SIZE - 1 : GRID_SIZE - size;
        const x = Math.floor(Math.random() * (maxX + 1));
        const y = Math.floor(Math.random() * (maxY + 1));
        placed = placeShip(board, type, [x, y], horizontal);
        attempts++;
      }
    }
    this.playerPlacing = FLEET.length;
    playPlatformPickup("blade");
    // Transition to play phase if all ships placed
    if (this.phase === "setup") {
      if (this.mode === "online") {
        this.onlineFleetSubmitted = true;
        this.onlineStatus = "FLEET LOCKED — WAITING FOR RIVAL";
        this.onlineCallbacks?.deploy(this.getOnlineFleet());
        return;
      }
      if (this.mode === "hotseat" && this.setupSubPhase === "player1") {
        this.setupSubPhase = "player2";
        this.playerPlacing = 0;
        this.horizontal = true;
        this.hoverCell = null;
        this.beginHandoff("setup");
      } else {
        this.phase = "play";
        this.setupSubPhase = "done";
        this.currentTurn = this.mode === "hotseat" ? "player1" : "player";
        this.opponentBoard = this.mode === "agent" ? randomBoard() : this.player2Board;
        this.beginHandoff("setup");
        this.setMessage(this.getSparrowLine("game_start"), 2500);
        if (this.mode === "agent") {
          playJackIntro();
        }
      }
    }
  }

  setMessage(text: string, duration = 2800) {
    if (this.messageTimer <= 0) {
      this.message = text;
      this.messageTimer = duration;
    } else {
      this.messageQueue.push(text);
    }
  }

  private processMessageQueue() {
    if (this.messageTimer <= 0 && this.messageQueue.length > 0) {
      this.message = this.messageQueue.shift()!;
      this.messageTimer = 2800;
    }
  }

fireAt(board: Board, targetGrid: CellState[][], x: number, y: number, byPlayer: boolean): "hit" | "miss" | "sink" | "already" {
    if (targetGrid[y][x] !== CELL_STATES.empty) return "already";
    const ship = board.shipMap.get(`${x},${y}`);
    if (ship) {
      // Check for Silent Run evasion
      if (ship.type === "submarine" && ship.abilityActive && ship.evasionCharges > 0) {
        ship.evasionCharges--;
        if (ship.evasionCharges === 0) ship.abilityActive = false;
        targetGrid[y][x] = CELL_STATES.miss;
        this.flashCells.push({ x, y, board: byPlayer ? "opponent" : "player", type: "miss", timer: 250 });
        this.triggerMissEffects(x, y, byPlayer, this.lastW, this.lastH);
        playPlatformLand();
        this.setMessage(`SILENT RUN — SHOT EVaded! (${ship.evasionCharges} charges left)`);
        return "miss";
      }
      const idx = ship.cells.findIndex(([cx, cy]) => cx === x && cy === y);
      if (idx >= 0) ship.hits[idx] = true;
      targetGrid[y][x] = CELL_STATES.hit;
      board.grid[y][x] = CELL_STATES.hit;
      const sunk = checkSunk(board, ship);
      if (sunk) {
        targetGrid[y][x] = CELL_STATES.sunk;
        this.flashCells.push({ x, y, board: byPlayer ? "opponent" : "player", type: "sink", timer: 800 });
        this.triggerSunkEffects(x, y, byPlayer, this.lastW, this.lastH);
        playWarriorImpact(1.2);
        return "sink";
      }
      this.flashCells.push({ x, y, board: byPlayer ? "opponent" : "player", type: "hit", timer: 300 });
      this.triggerHitEffects(x, y, byPlayer, this.lastW, this.lastH);
      playPlatformPickup("blade");
      return "hit";
    } else {
      targetGrid[y][x] = CELL_STATES.miss;
      this.flashCells.push({ x, y, board: byPlayer ? "opponent" : "player", type: "miss", timer: 250 });
      this.triggerMissEffects(x, y, byPlayer, this.lastW, this.lastH);
      playPlatformLand();
      return "miss";
    }
  }

  private triggerHitEffects(x: number, y: number, byPlayer: boolean, w: number, h: number) {
    this.screenShake = 8;
    this.hitPause = 60;
    // Calculate screen position from grid coordinates
    const { cell, startX, startY, opponentX, opponentY, boardSize } = this.getBoardLayout(w, h);
    const targetX = byPlayer ? opponentX : startX;
    const targetY = byPlayer ? opponentY : startY;
    const screenX = targetX + x * cell + cell / 2;
    const screenY = targetY + y * cell + cell / 2;
    // Spawn hit particles
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 600,
        maxLife: 600,
        color: this.theme.hitColor,
        size: 3 + Math.random() * 3,
        type: "spark",
      });
    }
    // Popup
    if (byPlayer) {
      this.combo++;
      this.comboTimer = 3000;
      const comboText = this.combo > 1 ? ` ×${this.combo}` : "";
      this.popups.push({ text: `HIT!${comboText}`, x: screenX, y: screenY - 10, life: 800, maxLife: 800, color: this.theme.hitGlow, size: this.combo > 2 ? 14 : 10, type: "hit" });
      if (this.combo > 2) {
        this.popups.push({ text: `${this.combo} COMBO!`, x: w / 2, y: 70, life: 1200, maxLife: 1200, color: "#ffd040", size: 16, type: "combo" });
      }
      // First blood
      if (!this.firstBlood && this.result.playerHits === 0) {
        this.firstBlood = true;
        this.popups.push({ text: "FIRST BLOOD!", x: w / 2, y: h * 0.35, life: 1500, maxLife: 1500, color: "#ff6040", size: 18, type: "firstblood" });
      }
    }
    // Cannon fire projectile
    this.cannonFire = {
      sx: (byPlayer ? startX : opponentX) + boardSize / 2,
      sy: (byPlayer ? startY : opponentY) + boardSize,
      tx: screenX,
      ty: screenY,
      t: 0,
      duration: 120,
      color: this.theme.hitColor,
    };
  }

  private triggerMissEffects(x: number, y: number, byPlayer: boolean, w: number, h: number) {
    this.screenShake = 3;
    this.combo = 0;
    const { cell, startX, startY, opponentX, opponentY, boardSize } = this.getBoardLayout(w, h);
    const targetX = byPlayer ? opponentX : startX;
    const targetY = byPlayer ? opponentY : startY;
    const screenX = targetX + x * cell + cell / 2;
    const screenY = targetY + y * cell + cell / 2;
    // Splash particles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 40 + Math.random() * 60;
      this.particles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 400,
        maxLife: 400,
        color: this.theme.missColor,
        size: 2 + Math.random() * 2,
        type: "smoke",
      });
    }
    // Popup
    if (byPlayer) {
      this.popups.push({ text: "MISS", x: screenX, y: screenY - 10, life: 600, maxLife: 600, color: this.theme.textMuted, size: 9, type: "miss" });
    }
    // Cannon fire projectile
    this.cannonFire = {
      sx: (byPlayer ? startX : opponentX) + boardSize / 2,
      sy: (byPlayer ? startY : opponentY) + boardSize,
      tx: screenX,
      ty: screenY,
      t: 0,
      duration: 150,
      color: this.theme.missColor,
    };
  }

  private triggerSunkEffects(x: number, y: number, byPlayer: boolean, w: number, h: number) {
    this.screenShake = 20;
    this.hitPause = 120;
    const { cell, startX, startY, opponentX, opponentY, boardSize } = this.getBoardLayout(w, h);
    const targetX = byPlayer ? opponentX : startX;
    const targetY = byPlayer ? opponentY : startY;
    const screenX = targetX + x * cell + cell / 2;
    const screenY = targetY + y * cell + cell / 2;
    // Explosion particles
    const shipColor = this.theme.sunkGlow;
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      this.particles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1200,
        maxLife: 1200,
        color: i % 3 === 0 ? shipColor : (i % 3 === 1 ? "#ffaa00" : "#ff4444"),
        size: 4 + Math.random() * 5,
        type: i % 3 === 0 ? "ember" : "debris",
      });
    }
    // Smoke ring
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 60 + Math.random() * 40;
      this.particles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1000,
        maxLife: 1000,
        color: "rgba(100, 80, 60, 0.6)",
        size: 8 + Math.random() * 6,
        type: "smoke",
      });
    }
    // Sunk popup
    if (byPlayer) {
      this.combo = 0;
      this.popups.push({ text: "SUNK!", x: screenX, y: screenY - 15, life: 1000, maxLife: 1000, color: this.theme.sunkGlow, size: 16, type: "sink" });
    }
    // Cannon fire for sunk
    this.cannonFire = {
      sx: (byPlayer ? startX : opponentX) + boardSize / 2,
      sy: (byPlayer ? startY : opponentY) + boardSize,
      tx: screenX,
      ty: screenY,
      t: 0,
      duration: 100,
      color: this.theme.sunkGlow,
    };
  }

  private getBoardLayout(w: number, h: number) {
    const headerH = 116;
    const footerH = 48;
    const statusH = 66;
    const messageH = 38;
    const outerPad = 30;
    const gap = 48;
    const stacked = w < 560 && h > w * 1.25;
    if (stacked) {
      const heightLimit = (h - headerH - footerH - statusH * 2 - messageH - 108) / 2;
      const cell = Math.max(8, Math.floor(Math.min(w - outerPad * 2, heightLimit) / GRID_SIZE));
      const boardSize = cell * GRID_SIZE;
      const startX = Math.floor((w - boardSize) / 2) + 8;
      const startY = headerH + 42;
      const playerFleetY = startY + boardSize + 8;
      const opponentX = startX;
      const opponentY = playerFleetY + statusH + 44;
      const opponentFleetY = opponentY + boardSize + 8;
      const messageY = opponentFleetY + statusH + 6;
      return {
        cell, startX, startY, opponentX, opponentY, boardSize, gap: 10, headerH, footerH,
        statusH, messageH, playerFleetY, opponentFleetY, messageY, stacked,
      };
    }
    const widthLimit = (w - outerPad * 2 - gap) / 2;
    const heightLimit = h - headerH - footerH - statusH - messageH - 64;
    const cell = Math.max(8, Math.floor(Math.min(widthLimit, heightLimit) / GRID_SIZE));
    const boardSize = cell * GRID_SIZE;
    const startX = Math.floor((w - boardSize * 2 - gap) / 2) + 8;
    const startY = headerH + 42;
    const opponentX = startX + boardSize + gap;
    const opponentY = startY;
    const playerFleetY = startY + boardSize + 7;
    const opponentFleetY = playerFleetY;
    const messageY = playerFleetY + statusH + 4;
    return {
      cell, startX, startY, opponentX, opponentY, boardSize, gap, headerH, footerH,
      statusH, messageH, playerFleetY, opponentFleetY, messageY, stacked,
    };
  }

  private getRotateButtonRect(w: number, h: number) {
    void h;
    const width = Math.min(170, Math.floor((w - 36) / 2));
    return { x: Math.floor(w / 2) + 4, y: 66, w: width, h: 44 };
  }

  private getAutoButtonRect(w: number, h: number) {
    const rb = this.getRotateButtonRect(w, h);
    return { x: rb.x - rb.w - 8, y: rb.y, w: rb.w, h: rb.h };
  }

  playerFire(x: number, y: number): boolean {
    if (this.mode === "online") {
      if (this.phase !== "play" || this.currentTurn !== "player" || this.opponentTargetGrid[y]?.[x] !== CELL_STATES.empty) return false;
      this.onlineCallbacks?.fire(x, y);
      return true;
    }
    if (this.phase !== "play" || this.handoffPending) return false;
    const isPlayerTurn = this.currentTurn === "player" || this.currentTurn === "player1" || this.currentTurn === "player2";
    if (!isPlayerTurn) return false;
    const targetGrid = this.getTargetGrid();
    if (targetGrid[y][x] !== CELL_STATES.empty) return false;
    const opponentBoard = this.getOpponentBoard();
    const res = this.fireAt(opponentBoard, targetGrid, x, y, true);
    this.recordMineShot(x, y, res === "sink");
    if (res === "hit") {
      this.result.playerHits++;
      this.setMessage(this.getSparrowLine("player_hit"));
      this.jackTaunt();
    } else if (res === "sink") {
      this.result.playerHits++;
      this.jackTaunt(true);
      const shipType = opponentBoard.shipMap.get(`${x},${y}`)?.type.toUpperCase() ?? "SHIP";
      this.setMessage(this.getSparrowLine("player_sink") + ` — ${shipType} SUNK!`);
    } else if (res === "miss") {
      this.result.playerMisses++;
      this.setMessage(this.getSparrowLine("player_miss"));
    }
    this.result.turns++;
    this.checkWin();
    if (this.phase === "play") this.endTurn();
    return true;
  }

  /** Jack Sparrow voice-over — play a pre-recorded pirate taunt clip on a hit (~1-in-5; sinks always). */
  private jackTaunt(force = false) {
    if (!force && Math.random() > 0.2) return;
    if (this.mode !== "agent") return;
    playJackTaunt();
  }

  /**
   * Mining 201 — a player scan at (x,y). Consumes one scan from the budget,
   * feeds the community pool, and awards ore / pay / block drill dust.
   * Only the human player's selected shot spends a scan.
   */
  private recordMineShot(x: number, y: number, sunk: boolean) {
    if (this.currentTurn === "agent") return;
    if (!this.mineEnabled || this.mineExhausted) return;
    const node = this.mineNodes.get(`${x},${y}`);
    const { drill: kind, exhausted } = drill(this.mineStats, node, sunk ? "sinkAtNode" : "none", this.mineConfig);
    if (kind !== "none") {
      if (kind === "pay") this.setMessage(this.getSparrowLine("mine_pay") || "PAYDAY — 25x ORE BLOCK MINTED!");
      else if (kind === "ore") this.setMessage(this.getSparrowLine("mine_ore") || "ORE SEAM — dust banked.");
      else this.setMessage(this.getSparrowLine("mine_block") || "BLOCK MINED — ore seam saturated.");
    }
    if (exhausted) {
      this.mineExhausted = true;
      this.settleMineRound();
      const p = this.mineSettlement?.payout ?? 0;
      this.setMessage(
        `⛏ MINE EXHAUSTED — ${this.mineStats.oreFound} ore, ${this.mineStats.blocksMined} blocks banked. ${p > 0 ? `+${p} ◎ MINED!` : "No payout this claim."}`,
        4200,
      );
    }
  }

  /**
   * Settle the mining round: touch the burn-to-earn streak, compute the 95%-back
   * payout, and attach settlement to the result for the UI + vault.
   */
  settleMineRound() {
    if (this.mineSettlement || !this.mineEnabled) return;
    touchStreak();
    this.mineSettlement = settleMine(this.mineStats, this.mineConfig);
    if (this.result) {
      this.result.mine = this.mineSettlement;
    }
  }

  endTurn(scheduleNext = true) {
    if (this.phase !== "play") return;
    // Turn transition wipe
    this.turnWipe = 1;
    this.turnWipeColor = this.theme.accent;
    if (this.mode === "agent") {
      // Whoever is currently playing hands the turn to the other side.
      // The player → agent after a miss/ability; the agent → player after it finishes.
      this.currentTurn = this.currentTurn === "player" ? "agent" : "player";
    } else {
      this.currentTurn = this.currentTurn === "player1" ? "player2" : "player1";
      this.beginHandoff("turn");
    }
    if (this.mode === "agent" && this.currentTurn === "player") {
      this.messageQueue.push("YOUR TURN");
    }
    // Reset ability active flags at end of turn
    this.resetAbilityFlags();
    if (scheduleNext && this.mode === "agent" && this.currentTurn === "agent") {
      this.scheduleAgentTurn();
    }
  }

  private resetAbilityFlags() {
    const board = this.getCurrentBoard();
    for (const ship of board.ships) {
      // Don't reset Silent Run evasion - it persists until charges exhausted
      if (ship.type !== "submarine" || ship.evasionCharges === 0) {
        ship.abilityActive = false;
      }
    }
  }

  canUseAbility(type: ShipType): boolean {
    void type;
    return false;
  }

  private beginHandoff(reason: "setup" | "turn") {
    if (this.mode !== "hotseat" || this.phase === "over") return;
    this.handoffPending = true;
    this.handoffReason = reason;
    this.hoverCell = null;
  }

  acknowledgeHandoff(): boolean {
    if (!this.handoffPending || this.mode !== "hotseat") return false;
    this.handoffPending = false;
    const player = this.phase === "setup"
      ? (this.setupSubPhase === "player1" ? 1 : 2)
      : (this.currentTurn === "player1" ? 1 : 2);
    this.message = this.phase === "setup"
      ? `PLAYER ${player} — DEPLOY YOUR FLEET`
      : `PLAYER ${player} — CHOOSE ONE TARGET`;
    this.messageTimer = 1800;
    this.messageQueue = [];
    return true;
  }

  useAbility(type: ShipType, targetX?: number, targetY?: number): boolean {
    void type; void targetX; void targetY;
    return false;
  }

  scheduleAgentTurn() {
    if (this.agentTurnTimeout !== null) {
      window.clearTimeout(this.agentTurnTimeout);
      this.agentTurnTimeout = null;
    }
    this.agentThinking = true;
    this.agentTurnTimeout = window.setTimeout(() => {
      this.agentTurnTimeout = null;
      this.agentThinking = false;
      this.setMessage(this.getSparrowLine("agent_turn_start"));
      this.agentTurn();
    }, 650 + Math.random() * 350);
  }

  agentTurn() {
    if (this.phase !== "play" || this.currentTurn !== "agent") return;

    let x: number, y: number;

    // Difficulty-based behavior
    const useParity = this.agentDifficulty !== "easy";
    const smartHunt = this.agentDifficulty === "hard";

    if (this.huntMode && this.huntQueue.length > 0) {
      // Smart hunt: prioritize direction of last hit if we have a direction
      if (smartHunt && this.lastHitDirection) {
        const [dx, dy] = this.lastHitDirection;
        const lastX = this.lastHit?.[0] ?? 0;
        const lastY = this.lastHit?.[1] ?? 0;
        const nextX = lastX + dx;
        const nextY = lastY + dy;
        if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE &&
            this.playerTargetGrid[nextY][nextX] === CELL_STATES.empty) {
          [x, y] = [nextX, nextY];
        } else {
          // Direction blocked, try perpendicular
          this.lastHitDirection = null;
          this.scheduleAgentTurn();
          return;
        }
      } else {
        [x, y] = this.huntQueue.shift()!;
        if (this.playerTargetGrid[y][x] !== CELL_STATES.empty) {
          this.scheduleAgentTurn();
          return;
        }
      }
    } else {
      // Search mode: parity targeting for efficiency
      const candidates: [number, number][] = [];
      for (let yy = 0; yy < GRID_SIZE; yy++) {
        for (let xx = 0; xx < GRID_SIZE; xx++) {
          if (this.playerTargetGrid[yy][xx] === CELL_STATES.empty) {
            if (!useParity || (xx + yy) % 2 === 0) {
              candidates.push([xx, yy]);
            }
          }
        }
      }
      if (candidates.length === 0) { this.checkWin(); return; }
      [x, y] = candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Reveal an aiming reticle on the player's board, then fire after a short beat
    this.agentAim = { x, y, t: 0, dur: 780 };
    setTimeout(() => this.agentFinishShot(x, y), 800);
  }

  private agentFinishShot(x: number, y: number) {
    this.agentAim = null;
    if (this.phase !== "play" || this.currentTurn !== "agent") return;

    const smartHunt = this.agentDifficulty === "hard";
    const res = this.fireAt(this.playerBoard, this.playerTargetGrid, x, y, false);
    if (res === "hit") {
      this.result.agentHits++;
      this.setMessage(this.getSparrowLine("agent_hit"));
      // Track direction for smart hunting
      if (smartHunt && this.lastHit) {
        this.lastHitDirection = [x - this.lastHit[0], y - this.lastHit[1]];
      }
      this.lastHit = [x, y];
      this.huntMode = true;
      this.addHuntTargets(x, y);
    } else if (res === "sink") {
      this.result.agentHits++;
      this.setMessage(this.getSparrowLine("agent_sink"));
      this.huntMode = false;
      this.huntQueue = [];
      this.lastHit = null;
      this.lastHitDirection = null;
    } else if (res === "miss") {
      this.result.agentMisses++;
      this.setMessage(this.getSparrowLine("agent_miss"));
      // If we were hunting in a direction and missed, reverse direction
      if (smartHunt && this.lastHitDirection && this.lastHit) {
        this.lastHitDirection = [-this.lastHitDirection[0], -this.lastHitDirection[1]];
        // Re-add the reverse direction to hunt queue
        const revX = this.lastHit[0] + this.lastHitDirection[0];
        const revY = this.lastHit[1] + this.lastHitDirection[1];
        if (revX >= 0 && revX < GRID_SIZE && revY >= 0 && revY < GRID_SIZE &&
            this.playerTargetGrid[revY][revX] === CELL_STATES.empty) {
          this.huntQueue.unshift([revX, revY]);
        }
      }
    }
    this.result.turns++;
    this.checkWin();
    if (this.phase === "play") this.endTurn();
  }

  addHuntTargets(x: number, y: number) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Shuffle for variety
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j]!, dirs[i]!];
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && this.playerTargetGrid[ny][nx] === CELL_STATES.empty) {
        this.huntQueue.push([nx, ny]);
      }
    }
  }

  checkWin() {
    let playerDead = false, opponentDead = false;
    if (this.mode === "agent") {
      playerDead = this.playerBoard.ships.every((s) => s.sunk);
      opponentDead = this.opponentBoard.ships.every((s) => s.sunk);
    } else {
      playerDead = this.player1Board.ships.every((s) => s.sunk);
      opponentDead = this.player2Board.ships.every((s) => s.sunk);
    }
    if (playerDead || opponentDead) {
      this.phase = "over";
      this._gameOverTime = performance.now();
      this.settleMineRound();
      if (this.mode === "agent") {
        this.result.winner = opponentDead ? "player" : "agent";
        this.setMessage(this.getSparrowLine(this.result.winner === "player" ? "victory" : "defeat"), 4000);
        playJackOutro();
      } else {
        this.result.winner = playerDead ? "player2" : "player1";
        this.setMessage(this.getSparrowLine(this.result.winner === "player1" ? "victory" : "defeat"), 4000);
      }
      this.currentTurn = "player";
    }
  }

  update(dt: number) {
    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 0.015);
      this.screenShakeX = (Math.random() - 0.5) * this.screenShake;
      this.screenShakeY = (Math.random() - 0.5) * this.screenShake;
    }

    // Hit pause (brief freeze on impact)
    if (this.hitPause > 0) {
      this.hitPause = Math.max(0, this.hitPause - dt);
      return; // Freeze everything during hit pause
    }

    // Popup system
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Cannon fire projectile
    if (this.cannonFire) {
      this.cannonFire.t += dt / this.cannonFire.duration;
      if (this.cannonFire.t >= 1) this.cannonFire = null;
    }

    // Sink sequence (bow-to-stern flash)
    if (this.sinkSequence) {
      this.sinkSequence.timer -= dt;
      if (this.sinkSequence.timer <= 0) {
        this.sinkSequence.cellIndex++;
        if (this.sinkSequence.cellIndex >= this.sinkSequence.cells.length) {
          this.sinkSequence = null;
        } else {
          this.sinkSequence.timer = 80;
        }
      }
    }

    // Turn transition wipe
    if (this.turnWipe > 0) {
      this.turnWipe = Math.max(0, this.turnWipe - dt * 0.005);
    }

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt * 0.001;
      p.y += p.vy * dt * 0.001;
      p.vy += 0.08 * dt * 0.001; // gravity
      p.vx *= 0.995; // drag
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.messageTimer > 0) {
      this.messageTimer = Math.max(0, this.messageTimer - dt);
    } else {
      this.processMessageQueue();
    }
    for (let i = this.flashCells.length - 1; i >= 0; i--) {
      const f = this.flashCells[i];
      f.timer -= dt;
      if (f.timer <= 0) this.flashCells.splice(i, 1);
    }
  }

  // =============================================
  // SHIP SILHOUETTE DRAWING
  // =============================================
  private drawShipSilhouette(
    ctx: CanvasRenderingContext2D,
    cells: [number, number][],
    cellSize: number,
    originX: number,
    originY: number,
    fillColor: string,
    strokeColor: string,
    alpha: number = 1,
    sunk: boolean = false,
    hitCells: boolean[] = [],
    type: ShipType = "carrier",
  ) {
    if (cells.length === 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.themeId === "charter") {
      const inset = Math.max(3, Math.floor(cellSize / 5));
      const horizontal = cells.length < 2 || cells[0][1] === cells[1][1];
      for (let i = 0; i < cells.length; i++) {
        const [x, y] = cells[i];
        if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
        const px = originX + x * cellSize;
        const py = originY + y * cellSize;
        const bow = i === 0 ? 4 : 0;
        const stern = i === cells.length - 1 ? 3 : 0;
        ctx.fillStyle = sunk ? this.theme.sunkColor : fillColor;
        if (horizontal) {
          ctx.fillRect(px + bow, py + inset, cellSize - bow - stern, cellSize - inset * 2);
          if (bow) ctx.fillRect(px + 2, py + inset + 3, 2, Math.max(2, cellSize - inset * 2 - 6));
        } else {
          ctx.fillRect(px + inset, py + bow, cellSize - inset * 2, cellSize - bow - stern);
          if (bow) ctx.fillRect(px + inset + 3, py + 2, Math.max(2, cellSize - inset * 2 - 6), 2);
        }
        ctx.fillStyle = sunk ? this.theme.sunkGlow : this.theme.playerColor;
        if (horizontal) ctx.fillRect(px + bow, py + inset, cellSize - bow - stern, 2);
        else ctx.fillRect(px + inset, py + bow, 2, cellSize - bow - stern);
        ctx.fillStyle = strokeColor;
        const turret = Math.max(3, Math.floor(cellSize / 4));
        ctx.fillRect(px + Math.floor((cellSize - turret) / 2), py + Math.floor((cellSize - turret) / 2), turret, turret);
        if (hitCells[i]) {
          ctx.fillStyle = this.theme.hitColor;
          ctx.fillRect(px + inset, py + inset, cellSize - inset * 2, cellSize - inset * 2);
          ctx.fillStyle = this.theme.hitGlow;
          ctx.fillRect(px + Math.floor(cellSize / 2) - 1, py + inset, 2, cellSize - inset * 2);
        }
      }
      ctx.restore();
      return;
    }

    const horizontal = cells.length > 1 ? cells[1][0] !== cells[0][0] : true;
    const pad = cellSize * 0.06;
    const r = cellSize * 0.18;

    const x0 = originX + cells[0][0] * cellSize + pad;
    const y0 = originY + cells[0][1] * cellSize + pad;
    const totalW = horizontal ? cells.length * cellSize - pad * 2 : cellSize - pad * 2;
    const totalH = horizontal ? cellSize - pad * 2 : cells.length * cellSize - pad * 2;

    // Glow under ship
    ctx.shadowColor = sunk ? "#ff2020" : strokeColor;
    ctx.shadowBlur = sunk ? 4 : 8;

    // Ship body path — sharper bow for all types
    ctx.beginPath();
    if (horizontal) {
      const bowR = type === "carrier" ? r * 0.4 : type === "submarine" ? r * 1.1 : type === "battleship" ? r * 0.5 : r * 0.7;
      ctx.moveTo(x0 + bowR, y0);
      ctx.lineTo(x0 + totalW - r, y0);
      ctx.quadraticCurveTo(x0 + totalW, y0, x0 + totalW, y0 + r);
      ctx.lineTo(x0 + totalW, y0 + totalH - r);
      ctx.quadraticCurveTo(x0 + totalW, y0 + totalH, x0 + totalW - r, y0 + totalH);
      ctx.lineTo(x0 + bowR, y0 + totalH);
      ctx.quadraticCurveTo(x0, y0 + totalH, x0, y0 + totalH - r);
      ctx.lineTo(x0, y0 + r);
      ctx.quadraticCurveTo(x0, y0, x0 + bowR, y0);
    } else {
      const bowR = type === "carrier" ? r * 0.4 : type === "submarine" ? r * 1.1 : type === "battleship" ? r * 0.5 : r * 0.7;
      ctx.moveTo(x0, y0 + bowR);
      ctx.lineTo(x0, y0 + totalH - r);
      ctx.quadraticCurveTo(x0, y0 + totalH, x0 + r, y0 + totalH);
      ctx.lineTo(x0 + totalW - r, y0 + totalH);
      ctx.quadraticCurveTo(x0 + totalW, y0 + totalH, x0 + totalW, y0 + totalH - bowR);
      ctx.lineTo(x0 + totalW, y0 + r);
      ctx.quadraticCurveTo(x0 + totalW, y0, x0 + totalW - r, y0);
      ctx.lineTo(x0 + r, y0);
      ctx.quadraticCurveTo(x0, y0, x0, y0 + bowR);
    }
    ctx.closePath();

    // Gradient fill for depth
    const grad = ctx.createLinearGradient(
      horizontal ? x0 : x0,
      horizontal ? y0 : y0,
      horizontal ? x0 + totalW : x0 + totalW,
      horizontal ? y0 + totalH : y0 + totalH,
    );
    if (sunk) {
      grad.addColorStop(0, "#2a1010");
      grad.addColorStop(0.5, "#3a1818");
      grad.addColorStop(1, "#1a0808");
    } else {
      grad.addColorStop(0, fillColor);
      grad.addColorStop(0.4, fillColor);
      grad.addColorStop(1, strokeColor);
    }
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = sunk ? "#803030" : strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Deck detail lines (cell separators)
    ctx.strokeStyle = sunk ? "#502020" : strokeColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = alpha * 0.35;
    for (let i = 1; i < cells.length; i++) {
      ctx.beginPath();
      if (horizontal) {
        const lx = x0 + i * cellSize - pad;
        ctx.moveTo(lx, y0 + 2);
        ctx.lineTo(lx, y0 + totalH - 2);
      } else {
        const ly = y0 + i * cellSize - pad;
        ctx.moveTo(x0 + 2, ly);
        ctx.lineTo(x0 + totalW - 2, ly);
      }
      ctx.stroke();
    }

    // Type-specific details
    ctx.globalAlpha = alpha * 0.7;
    if (type === "carrier") {
      if (horizontal) {
        // Flight deck runway
        ctx.strokeStyle = sunk ? "#502020" : strokeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + totalW * 0.1, y0 + totalH * 0.35);
        ctx.lineTo(x0 + totalW * 0.88, y0 + totalH * 0.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0 + totalW * 0.1, y0 + totalH * 0.65);
        ctx.lineTo(x0 + totalW * 0.88, y0 + totalH * 0.65);
        ctx.stroke();
        // Island
        ctx.fillStyle = sunk ? "#502020" : strokeColor;
        ctx.fillRect(x0 + totalW * 0.62, y0 + 1, totalW * 0.08, totalH * 0.28);
      }
    } else if (type === "battleship") {
      // Turret barbettes
      ctx.fillStyle = sunk ? "#502020" : strokeColor;
      const ts = Math.max(3, cellSize * 0.18);
      if (horizontal) {
        ctx.fillRect(x0 + totalW * 0.22 - ts / 2, y0 + totalH * 0.25, ts, ts);
        ctx.fillRect(x0 + totalW * 0.50 - ts / 2, y0 + totalH * 0.25, ts, ts);
        ctx.fillRect(x0 + totalW * 0.78 - ts / 2, y0 + totalH * 0.25, ts, ts);
        ctx.fillRect(x0 + totalW * 0.36 - ts / 2, y0 + totalH * 0.60, ts, ts);
        ctx.fillRect(x0 + totalW * 0.64 - ts / 2, y0 + totalH * 0.60, ts, ts);
      }
    } else if (type === "submarine") {
      // Conning tower
      ctx.fillStyle = sunk ? "#502020" : strokeColor;
      if (horizontal) {
        ctx.fillRect(x0 + totalW * 0.42, y0 - 2, totalW * 0.12, totalH * 0.35);
        ctx.fillRect(x0 + totalW * 0.44, y0 - 4, totalW * 0.08, 3);
      }
    } else if (type === "cruiser") {
      // Bridge superstructure
      ctx.fillStyle = sunk ? "#502020" : strokeColor;
      if (horizontal) {
        ctx.fillRect(x0 + totalW * 0.35, y0 + 2, totalW * 0.15, totalH * 0.2);
      }
    } else if (type === "destroyer") {
      // Gun mount
      ctx.fillStyle = sunk ? "#502020" : strokeColor;
      const gs = Math.max(2, cellSize * 0.14);
      if (horizontal) {
        ctx.fillRect(x0 + totalW * 0.3, y0 + totalH * 0.3, gs, gs);
      }
    }

    // Hit damage marks — X marks with glow
    ctx.globalAlpha = alpha;
    for (let i = 0; i < cells.length; i++) {
      if (hitCells[i]) {
        const hx = originX + cells[i][0] * cellSize;
        const hy = originY + cells[i][1] * cellSize;
        // Hit glow
        ctx.fillStyle = sunk ? "rgba(200, 30, 10, 0.4)" : "rgba(255, 100, 40, 0.3)";
        ctx.fillRect(hx + 1, hy + 1, cellSize - 2, cellSize - 2);
        // X mark
        ctx.strokeStyle = sunk ? "#ff4020" : "#ff6040";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx + cellSize * 0.2, hy + cellSize * 0.2);
        ctx.lineTo(hx + cellSize * 0.8, hy + cellSize * 0.8);
        ctx.moveTo(hx + cellSize * 0.8, hy + cellSize * 0.2);
        ctx.lineTo(hx + cellSize * 0.2, hy + cellSize * 0.8);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Draw a mini ship icon for fleet status panel
  private drawMiniShip(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    size: number,
    type: ShipType,
    color: string,
    sunk: boolean,
  ) {
    ctx.save();
    const s = size;
    const r = s * 0.2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + s - r, y);
    ctx.quadraticCurveTo(x + s, y, x + s, y + r);
    ctx.lineTo(x + s, y + s - r);
    ctx.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
    ctx.lineTo(x + r, y + s);
    ctx.quadraticCurveTo(x, y + s, x, y + s - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = sunk ? "#3a1018" : color;
    ctx.fill();
    ctx.strokeStyle = sunk ? "#803030" : color;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (type === "carrier") {
      ctx.strokeStyle = sunk ? "#603020" : color;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.15, y + s / 2);
      ctx.lineTo(x + s * 0.85, y + s / 2);
      ctx.stroke();
    }
    if (sunk) {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = "#ff4040";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 1);
      ctx.lineTo(x + s - 1, y + s - 1);
      ctx.moveTo(x + s - 1, y + 1);
      ctx.lineTo(x + 1, y + s - 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // =============================================
  // ANIMATED WATER BACKGROUND
  // =============================================
  private drawWater(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    t: BouyTheme,
  ) {
    const now = performance.now();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // Deep water gradient — stronger contrast
    const waterGrad = ctx.createLinearGradient(x, y, x, y + h);
    waterGrad.addColorStop(0, t.water.base);
    waterGrad.addColorStop(0.3, t.water.wave1);
    waterGrad.addColorStop(0.6, t.water.wave2);
    waterGrad.addColorStop(1, t.water.deep);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(x, y, w, h);

    // Wave line 1 — thicker, more visible
    ctx.strokeStyle = t.water.wave1;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let wx = x; wx <= x + w; wx += 2) {
      const wy = y + h * 0.25 + Math.sin((wx + now * 0.02) * 0.03) * 5 + Math.sin((wx + now * 0.01) * 0.05) * 3;
      wx === x ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
    }
    ctx.stroke();

    // Wave line 2
    ctx.strokeStyle = t.water.wave2;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    for (let wx = x; wx <= x + w; wx += 2) {
      const wy = y + h * 0.55 + Math.sin((wx + now * 0.015 + 50) * 0.025) * 4 + Math.cos((wx + now * 0.008) * 0.04) * 3;
      wx === x ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
    }
    ctx.stroke();

    // Wave line 3 — extra depth
    ctx.strokeStyle = t.water.foam;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    for (let wx = x; wx <= x + w; wx += 2) {
      const wy = y + h * 0.78 + Math.sin((wx + now * 0.012 + 120) * 0.035) * 3;
      wx === x ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
    }
    ctx.stroke();

    // Foam / sparkle dots — more of them, brighter
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = t.water.foam;
    for (let i = 0; i < 18; i++) {
      const fx = x + ((i * 37 + now * 0.008 * (i % 3 + 1)) % w);
      const fy = y + ((i * 53 + Math.sin(now * 0.001 + i) * 12) % h);
      const fs = 1.5 + Math.sin(now * 0.003 + i * 2) * 0.8;
      ctx.beginPath();
      ctx.arc(fx, fy, fs, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // =============================================
  // EXPLOSION EFFECT
  // =============================================
  private drawExplosionAt(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    radius: number,
    t: BouyTheme,
    progress: number, // 0→1 over lifetime
  ) {
    ctx.save();
    const alpha = 1 - progress;
    const r = radius * (0.4 + progress * 1.0);

    // Outer smoke ring
    const smokeGrad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
    smokeGrad.addColorStop(0, "transparent");
    smokeGrad.addColorStop(0.6, `${t.explosion.smoke}${Math.floor(alpha * 80).toString(16).padStart(2, "0")}`);
    smokeGrad.addColorStop(1, "transparent");
    ctx.fillStyle = smokeGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Main fireball gradient
    const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    outerGrad.addColorStop(0, `${t.explosion.core}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`);
    outerGrad.addColorStop(0.25, `${t.explosion.mid}${Math.floor(alpha * 220).toString(16).padStart(2, "0")}`);
    outerGrad.addColorStop(0.6, `${t.explosion.outer}${Math.floor(alpha * 160).toString(16).padStart(2, "0")}`);
    outerGrad.addColorStop(1, "transparent");
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Core flash — bright white center
    if (progress < 0.35) {
      const coreAlpha = (1 - progress / 0.35);
      ctx.globalAlpha = coreAlpha * 0.9;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = t.explosion.core;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35 * (1 - progress / 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // Water splash effect for misses
  private drawSplashAt(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    cellSize: number,
    t: BouyTheme,
    progress: number,
  ) {
    ctx.save();
    const alpha = 1 - progress;
    const maxH = cellSize * 1.0;
    const h = maxH * (1 - Math.abs(progress * 2 - 1));
    const w = cellSize * 0.18 + progress * cellSize * 0.25;

    // Water column
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = t.explosion.splash;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy + cellSize * 0.2);
    ctx.quadraticCurveTo(cx - w * 0.5, cy - h, cx, cy - h);
    ctx.quadraticCurveTo(cx + w * 0.5, cy - h, cx + w, cy + cellSize * 0.2);
    ctx.fill();

    // Second column for depth
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = t.water.foam;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.6, cy + cellSize * 0.15);
    ctx.quadraticCurveTo(cx - w * 0.3, cy - h * 0.7, cx, cy - h * 0.7);
    ctx.quadraticCurveTo(cx + w * 0.3, cy - h * 0.7, cx + w * 0.6, cy + cellSize * 0.15);
    ctx.fill();

    // Ripple ring
    const rippleR = cellSize * 0.45 * (0.5 + progress * 0.5);
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = t.explosion.splash;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy + cellSize * 0.2, rippleR, rippleR * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Droplets
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = t.water.foam;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + 0.3;
      const dist = cellSize * 0.35 * progress;
      const dx = cx + Math.cos(angle) * dist;
      const dy = cy - h * 0.5 + Math.sin(angle) * dist * 0.5;
      ctx.beginPath();
      ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    this.lastW = w;
    this.lastH = h;
    const t = this.theme;
    ctx.imageSmoothingEnabled = false;

    // Screen shake transform
    ctx.save();
    if (this.screenShake > 0 && this.themeId !== "charter") {
      ctx.translate(this.screenShakeX, this.screenShakeY);
    }

    // Background with vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
    grad.addColorStop(0, t.bg);
    grad.addColorStop(1, t.bgDeep);
    ctx.fillStyle = this.themeId === "charter" ? t.bg : grad;
    ctx.fillRect(0, 0, w, h);

    // Vignette overlay
    if (t.effects.vignette > 0) {
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, `rgba(0,0,0,${t.effects.vignette})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    const {
      cell, startX, startY, opponentX, opponentY, boardSize, headerH, footerH,
      statusH, messageH, playerFleetY, opponentFleetY, messageY,
    } = this.getBoardLayout(w, h);

    // Header
    ctx.fillStyle = t.bgDeep;
    ctx.fillRect(0, 0, w, headerH);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, headerH - 2, w, 2);

    // Title line — truncated to fit
    ctx.textAlign = "center";
    ctx.fillStyle = t.accent;
    const titleSize = w < 520 ? 14 : 20;
    ctx.font = `bold ${titleSize}px ${t.fonts.title}`;
    const titleMaxW = w - 32;
    let titleText = t.terms.gameTitle;
    if (ctx.measureText(titleText).width > titleMaxW) {
      while (titleText.length > 4 && ctx.measureText(titleText + "...").width > titleMaxW) titleText = titleText.slice(0, -1);
      titleText += "...";
    }
    ctx.fillText(titleText, w / 2, 28);

    // Subtitle line — mode + turn info, truncated to fit
    ctx.fillStyle = t.textSecondary;
    const subSize = w < 520 ? 11 : 14;
    ctx.font = `${subSize}px ${t.fonts.body}`;
    const modeText = this.mode === "agent" ? "vs AGENT" : this.mode === "online" ? "ONLINE TABLE" : "1v1 HOTSEAT";
    let turnText = "";
    if (this.phase === "setup") {
      const placer = this.mode === "hotseat" ? `P${this.setupSubPhase === "player1" ? 1 : 2}` : "YOU";
      turnText = `${placer} ${t.terms.deploy} ${this.getCurrentShipType().toUpperCase()} (${this.getCurrentShipSize()})`;
    } else if (this.phase === "over") {
      const isVictory = this.result.winner === "player" || this.result.winner === "player1";
      turnText = `${isVictory ? "VICTORY" : "DEFEAT"} · ${this.result.turns} turns`;
    } else {
      const turnLabel = this.mode === "hotseat"
        ? `PLAYER ${this.currentTurn === "player1" ? 1 : 2} TURN`
        : this.mode === "online"
          ? (this.currentTurn === "player" ? "YOUR TURN" : "RIVAL'S TURN")
        : this.currentTurn === "player" ? t.terms.turnYou : t.terms.turnEnemy;
      const thinking = this.agentThinking ? " · THINKING" : "";
      turnText = `${turnLabel}${thinking}`;
    }
    let subLine = `${modeText} · ${turnText}`;
    const subMaxW = w - 32;
    if (ctx.measureText(subLine).width > subMaxW) {
      while (subLine.length > 4 && ctx.measureText(subLine + "...").width > subMaxW) subLine = subLine.slice(0, -1);
      subLine += "...";
    }
    ctx.fillText(subLine, w / 2, 46);

    // A dedicated command lane never overlaps board titles or coordinates.
    if (this.phase !== "setup") {
      const ready = this.phase === "play" && (this.mode === "hotseat" || this.currentTurn === "player");
      ctx.fillStyle = ready ? t.accent : t.enemyColor;
      ctx.fillRect(16, 64, w - 32, 44);
      ctx.fillStyle = t.bgDeep;
      ctx.font = `bold ${w < 520 ? 12 : 16}px ${t.fonts.body}`;
      const coordinate = this.hoverCell ? ` ${String.fromCharCode(65 + this.hoverCell[0])}${this.hoverCell[1] + 1}` : "";
      ctx.fillText(this.phase === "over" ? "BATTLE COMPLETE" : ready ? `FIRE${coordinate} / TAP TARGET GRID` : "HOLD FIRE / RIVAL'S TURN", w / 2, 91);
    }

    // Stationary boards keep pointer hitboxes aligned from the first frame.
    this.drawBoard(ctx, startX, startY, cell, "player", t);
    this.drawBoard(ctx, opponentX, opponentY, cell, "opponent", t);

    // Fleet status panels
    this.drawFleetStatus(ctx, startX, playerFleetY, boardSize, statusH, "player", t);
    this.drawFleetStatus(ctx, opponentX, opponentFleetY, boardSize, statusH, "opponent", t);

    // On-screen setup controls — mouse AND touch friendly
    if (this.phase === "setup" && !this.onlineFleetSubmitted) {
      const rot = this.getRotateButtonRect(w, h);
      const auto = this.getAutoButtonRect(w, h);
      const drawBtn = (r: { x: number; y: number; w: number; h: number }, glyph: string, label: string) => {
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = t.panel;
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = t.accent;
        ctx.font = `bold 12px ${t.fonts.body}`;
        ctx.fillText(glyph, r.x + r.w / 2, r.y + 17);
        ctx.font = `11px ${t.fonts.body}`;
        ctx.fillStyle = t.textSecondary;
        ctx.fillText(label, r.x + r.w / 2, r.y + 34);
        ctx.restore();
      };
      drawBtn(rot, "[R] ROTATE", this.horizontal ? "HORIZONTAL >" : "VERTICAL v");
      drawBtn(auto, "[A] AUTO", "DEPLOY ALL 5");
    }

    // Aiming reticle — sweeps to the cell the agent is about to strike on the player's board
    if (this.agentAim && this.mode === "agent") {
      const aim = this.agentAim;
      aim.t = Math.min(1, aim.t + 0.016 / (aim.dur / 1000));
      const cx = startX + aim.x * cell + cell / 2;
      const cy = startY + aim.y * cell + cell / 2;
      const sweep = 1 - Math.pow(1 - aim.t, 3);
      const ringR = cell * (0.45 + sweep * 0.35);
      const crossLen = cell * (0.3 + sweep * 0.25);
      ctx.save();
      ctx.strokeStyle = t.enemyColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + sweep * 0.5;
      // Rotating outer reticle
      ctx.translate(cx, cy);
      ctx.rotate(performance.now() * 0.002);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.moveTo(crossLen, 0); ctx.lineTo(crossLen * 1.45, 0);
      ctx.moveTo(-crossLen, 0); ctx.lineTo(-crossLen * 1.45, 0);
      ctx.moveTo(0, crossLen); ctx.lineTo(0, crossLen * 1.45);
      ctx.moveTo(0, -crossLen); ctx.lineTo(0, -crossLen * 1.45);
      ctx.stroke();
      ctx.restore();
      // Center pulse dot
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(performance.now() * 0.02) * 0.2;
      ctx.fillStyle = t.enemyColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Cannon fire projectile
    if (this.cannonFire && this.themeId !== "charter") {
      const cf = this.cannonFire;
      const px = cf.sx + (cf.tx - cf.sx) * this.easeOutCubic(cf.t);
      const py = cf.sy + (cf.ty - cf.sy) * this.easeOutCubic(cf.t);
      const alpha = 1 - cf.t * 0.3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = cf.color;
      ctx.shadowColor = cf.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      // Trail
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath();
      ctx.arc(px - (cf.tx - cf.sx) * 0.02, py - (cf.ty - cf.sy) * 0.02, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Sink sequence (bow-to-stern flash)
    if (this.sinkSequence) {
      const ss = this.sinkSequence;
      const boardX = ss.board === "player" ? startX : opponentX;
      const boardY = ss.board === "player" ? startY : opponentY;
      for (let i = 0; i <= ss.cellIndex && i < ss.cells.length; i++) {
        const [cx, cy] = ss.cells[i];
        const flashAlpha = i === ss.cellIndex ? 0.8 : 0.3;
        ctx.fillStyle = `${t.sunkGlow}${Math.floor(flashAlpha * 255).toString(16).padStart(2, '0')}`;
        ctx.fillRect(boardX + cx * cell, boardY + cy * cell, cell, cell);
      }
    }

    // Bounded radio strip, with a rules reminder when the radio is quiet.
    {
      const bubbleX = 12;
      const bubbleY = messageY;
      const msgFontSize = w < 520 ? 11 : 14;
      ctx.font = `${msgFontSize}px ${t.fonts.body}`;
      const bubbleW = w - 24;
      const bubbleH = messageH;
      ctx.globalAlpha = 1;
      ctx.fillStyle = t.bgDeep;
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(bubbleX, bubbleY, bubbleW, bubbleH);
      ctx.fill();
      ctx.stroke();
      // Message text stays in its own command strip below both fleet panels.
      ctx.fillStyle = t.textPrimary;
      ctx.textAlign = "left";
      let messageText = this.messageTimer > 0 && this.message ? this.message : this.phase === "setup" ? "PLACE 5 SHIPS. LEAVE A 1-CELL GAP." : "+ HIT   . MISS   X SUNK / ONE SHOT PER TURN";
      const messageMaxW = bubbleW - 20;
      while (messageText.length > 4 && ctx.measureText(messageText).width > messageMaxW) messageText = `${messageText.slice(0, -4)}...`;
      ctx.fillText(messageText, bubbleX + 10, bubbleY + bubbleH / 2 + msgFontSize * 0.34);
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
    }

    // Mining claim ledger and controls stay visible without competing with the boards.
    ctx.fillStyle = t.bgDeep;
    ctx.fillRect(0, h - footerH, w, footerH);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, h - footerH, w, 1);

    ctx.fillStyle = t.accent;
    ctx.font = `bold 11px ${t.fonts.body}`;
    ctx.textAlign = "center";
    const mineLine = this.mode === "online"
      ? "ONLINE / PRIVATE FLEETS"
      : `SCANS ${this.mineStats.scansUsed}/${this.mineConfig.scanBudget}  ORE ${this.mineStats.oreFound}  BLOCKS ${this.mineStats.blocksMined}`;
    ctx.fillText(mineLine, w / 2, h - 25);

    ctx.fillStyle = t.textMuted;
    ctx.font = `11px ${t.fonts.body}`;
    let hint = "";
    if (this.phase === "setup") {
      hint = "TAP TO PLACE / R ROTATE / A AUTO";
    } else if (this.phase === "over") {
      hint = "TAP for NEW GAME · ESC tavern";
    } else {
      hint = this.mode === "hotseat" ? "TAP enemy grid to fire" : "TAP enemy grid · ESC quit";
    }
    ctx.fillText(hint, w / 2, h - 8);
    ctx.textAlign = "left";

    // Turn transition wipe (subtle top-edge wipe on turn change)
    if (this.turnWipe > 0 && this.themeId !== "charter") {
      const wipeAlpha = this.turnWipe * 0.35;
      ctx.fillStyle = `${this.turnWipeColor}${Math.floor(wipeAlpha * 255).toString(16).padStart(2, '0')}`;
      ctx.fillRect(0, 0, w, headerH + 4);
    }

    // Theme scanlines effect
    if (t.effects.scanlines) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      for (let y = 0; y < h; y += 3) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, y, w, 1);
      }
      ctx.restore();
    }

    // Theme CRT barrel distortion (simulated with gradient)
    if (t.effects.crt) {
      ctx.save();
      const crtGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      crtGrad.addColorStop(0, "rgba(0,0,0,0)");
      crtGrad.addColorStop(1, "rgba(0,0,0,0.2)");
      ctx.fillStyle = crtGrad;
      ctx.fillRect(0, 0, w, h);
      // CRT scanline shimmer
      const scanY = (performance.now() * 0.08) % h;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(0, scanY, w, 2);
      ctx.restore();
    }

    // Theme glitch effect (random horizontal offset lines)
    if (t.effects.glitch && Math.random() < 0.04) {
      ctx.save();
      const glitchY = Math.random() * h;
      const glitchH = 2 + Math.random() * 6;
      const glitchShift = (Math.random() - 0.5) * 8;
      ctx.drawImage(ctx.canvas, 0, glitchY, w, glitchH, glitchShift, glitchY, w, glitchH);
      ctx.restore();
    }

    // Theme-specific animated background overlays
    const now = performance.now();
    if (this.themeId === "abyssal") {
      // Bioluminescence pulsing circles
      ctx.save();
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 8; i++) {
        const bx = w * (0.1 + 0.11 * i + Math.sin(now * 0.0005 + i * 1.8) * 0.05);
        const by = h * (0.3 + Math.cos(now * 0.0004 + i * 2.1) * 0.25);
        const br = 15 + Math.sin(now * 0.001 + i) * 8;
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0, t.accent);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(bx - br, by - br, br * 2, br * 2);
      }
      ctx.restore();
    } else if (this.themeId === "odyssey") {
      // Rotating scan ring
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 1;
      const cx = w / 2, cy = h / 2;
      const scanRadius = Math.min(w, h) * 0.45;
      const scanAngle = (now * 0.001) % (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(cx, cy, scanRadius, scanAngle, scanAngle + 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, scanRadius * 0.7, scanAngle + Math.PI, scanAngle + Math.PI + 0.3);
      ctx.stroke();
      // Crosshair lines
      ctx.globalAlpha = 0.04;
      ctx.beginPath();
      ctx.moveTo(cx - scanRadius, cy); ctx.lineTo(cx + scanRadius, cy);
      ctx.moveTo(cx, cy - scanRadius); ctx.lineTo(cx, cy + scanRadius);
      ctx.stroke();
      ctx.restore();
    } else if (this.themeId === "corsair") {
      // Compass rose in corner
      ctx.save();
      const compX = w - 60, compY = 90;
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 1;
      const points = 8;
      for (let i = 0; i < points; i++) {
        const angle = (Math.PI * 2 * i) / points + now * 0.0002;
        const len = i % 2 === 0 ? 35 : 20;
        ctx.beginPath();
        ctx.moveTo(compX, compY);
        ctx.lineTo(compX + Math.cos(angle) * len, compY + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(compX, compY, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.themeId === "voidwalker") {
      // Hex grid background pattern
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 0.5;
      const hexR = 24;
      const hexH = hexR * Math.sqrt(3);
      for (let row = -1; row < h / hexH + 1; row++) {
        for (let col = -1; col < w / (hexR * 1.5) + 1; col++) {
          const hx = col * hexR * 1.5;
          const hy = row * hexH + (col % 2 ? hexH / 2 : 0);
          const pulse = Math.sin(now * 0.002 + col * 0.3 + row * 0.4) * 0.5 + 0.5;
          ctx.globalAlpha = 0.02 + pulse * 0.03;
          ctx.beginPath();
          for (let s = 0; s < 6; s++) {
            const angle = (Math.PI / 3) * s - Math.PI / 6;
            const px = hx + Math.cos(angle) * hexR;
            const py = hy + Math.sin(angle) * hexR;
            s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    ctx.restore(); // Restore screen shake transform

    // Draw particles on top (not affected by screen shake) with differentiated shapes
    for (const p of this.particles) {
      if (this.themeId === "charter") continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.type === "spark") {
        // Sparks: elongated lines
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-p.size * 1.5, -1, p.size * 3, 2);
        ctx.restore();
      } else if (p.type === "ember") {
        // Embers: glowing circles with halo
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (p.type === "debris") {
        // Debris: small squares
        const s = p.size * (0.5 + alpha * 0.5);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else {
        // Smoke: circles
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Draw popups on top
    for (const p of this.popups) {
      if (this.themeId === "charter") continue;
      const alpha = Math.min(1, p.life / (p.maxLife * 0.3));
      const progress = 1 - p.life / p.maxLife;
      const rise = progress * 35;
      const scale = p.type === "sink" ? 1 + Math.sin(progress * Math.PI) * 0.3 : p.type === "combo" ? 1 + Math.sin(progress * Math.PI) * 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y - rise);
      ctx.scale(scale, scale);
      ctx.font = `bold ${p.size}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#000";
      ctx.fillText(p.text, 2, 2);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // VICTORY / DEFEAT OVERLAY
    if (this.phase === "over") {
      const isHotseat = this.mode === "hotseat";
      const isVictory = isHotseat || this.result.winner === "player" || this.result.winner === "player1";
      const overlayAlpha = Math.min(0.75, (performance.now() - (this._gameOverTime || performance.now())) * 0.001);
      if (overlayAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = overlayAlpha;
        ctx.fillStyle = isVictory ? "rgba(10, 40, 20, 0.85)" : "rgba(40, 10, 10, 0.85)";
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;

        // Result text
        const resultSize = Math.max(28, Math.floor(w * 0.06));
        ctx.font = `bold ${resultSize}px ${t.fonts.title}`;
        ctx.textAlign = "center";
        const resultText = isHotseat
          ? `PLAYER ${this.result.winner === "player1" ? 1 : 2} WINS`
          : isVictory ? "VICTORY" : "DEFEAT";
        const resultColor = isVictory ? "#68e8a8" : "#e87850";

        // Glow
        ctx.shadowColor = resultColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = resultColor;
        ctx.fillText(resultText, w / 2, h * 0.28);
        ctx.shadowBlur = 0;

        // Ship graveyard — draw all 5 fleet ships as mini silhouettes
        const graveY = h * 0.38;
        const graveSpacing = Math.min(60, w * 0.08);
        const graveStartX = w / 2 - (graveSpacing * 2);
        for (let i = 0; i < FLEET.length; i++) {
          const type = FLEET[i];
          const spec = SHIP_SPECS[type];
          const winningBoard = isHotseat
            ? (this.result.winner === "player1" ? this.player1Board : this.player2Board)
            : this.playerBoard;
          const losingBoard = isHotseat
            ? (this.result.winner === "player1" ? this.player2Board : this.player1Board)
            : this.opponentBoard;
          const ship = losingBoard.ships.find((s) => s.type === type);
          const playerShip = winningBoard.ships.find((s) => s.type === type);
          const enemySunk = ship?.sunk ?? false;
          const playerSunk = playerShip?.sunk ?? false;
          const shipColor = t.shipColors[type] ?? { main: t.accent, light: t.accent, dark: t.accentDim };
          const gx = graveStartX + i * graveSpacing;
          this.drawMiniShip(ctx, gx, graveY, 24, type, shipColor.main, enemySunk);
          // Label
          ctx.fillStyle = enemySunk ? t.sunkGlow : t.textMuted;
          ctx.font = `${Math.max(8, Math.floor(w * 0.014))}px ${t.fonts.body}`;
          ctx.fillText(spec.short, gx + 12, graveY + 32);
          // Player ship below
          this.drawMiniShip(ctx, gx, graveY + 38, 24, type, t.playerColor, playerSunk);
        }

        // Stats
        const statsY = h * 0.56;
        const accuracy = this.result.playerHits + this.result.playerMisses > 0
          ? Math.round((this.result.playerHits / (this.result.playerHits + this.result.playerMisses)) * 100)
          : 0;
        ctx.fillStyle = t.textPrimary;
        ctx.font = `${Math.max(14, Math.floor(w * 0.025))}px ${t.fonts.body}`;
        ctx.fillText(`${this.result.playerHits} HITS  ·  ${this.result.playerMisses} MISSES  ·  ${accuracy}% ACCURACY`, w / 2, statsY);
        ctx.fillStyle = t.textSecondary;
        ctx.fillText(`${this.result.turns} TURNS`, w / 2, statsY + 24);

        // Sparrow quote
        const sparrowLine = isVictory ? this.getSparrowLine("victory") : this.getSparrowLine("defeat");
        ctx.fillStyle = t.gold;
        ctx.font = `italic ${Math.max(12, Math.floor(w * 0.02))}px ${t.fonts.body}`;
        ctx.fillText(`"${sparrowLine}"`, w / 2, statsY + 56);

        // Hint
        ctx.fillStyle = t.textMuted;
        ctx.font = `${Math.max(11, Math.floor(w * 0.018))}px ${t.fonts.body}`;
        ctx.fillText("TAP to play again · ESC for tavern", w / 2, h - 60);

        ctx.textAlign = "left";
        ctx.restore();
      }
    }

    if (this.handoffPending) this.drawHandoff(ctx, w, h, t);
    if (this.onlineStatus) this.drawOnlineStatus(ctx, w, h, t);
  }

  private drawOnlineStatus(ctx: CanvasRenderingContext2D, w: number, h: number, t: BouyTheme) {
    const cardW = Math.min(w - 32, 560);
    const cardH = 190;
    const cardX = (w - cardW) / 2;
    const cardY = (h - cardH) / 2;
    ctx.save();
    ctx.fillStyle = t.bgDeep;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.panel;
    ctx.strokeStyle = t.panelBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = t.accent;
    ctx.font = `bold ${w < 520 ? 12 : 18}px ${t.fonts.body}`;
    ctx.fillText(this.onlineStatus, w / 2, cardY + 70, cardW - 24);
    ctx.fillStyle = t.textSecondary;
    ctx.font = `${Math.max(12, Math.min(18, Math.floor(w * 0.026)))}px ${t.fonts.body}`;
    const rival = this.onlineView?.players.find((player) => player?.seat !== this.onlineView?.yourSeat);
    ctx.fillText(rival ? `${rival.name} has taken the opposite seat.` : "Share the table and wait for another captain.", w / 2, cardY + 112, cardW - 28);
    ctx.fillStyle = t.textMuted;
    ctx.fillText("ESC leaves this table", w / 2, cardY + 152);
    ctx.restore();
  }

  private drawHandoff(ctx: CanvasRenderingContext2D, w: number, h: number, t: BouyTheme) {
    const player = this.phase === "setup"
      ? (this.setupSubPhase === "player1" ? 1 : 2)
      : (this.currentTurn === "player1" ? 1 : 2);
    const cardW = Math.min(w - 32, 520);
    const cardH = Math.min(h - 48, 250);
    const cardX = (w - cardW) / 2;
    const cardY = (h - cardH) / 2;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.bgDeep;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    ctx.fillStyle = t.panel;
    ctx.strokeStyle = t.panelBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = t.accent;
    ctx.font = `bold ${w < 520 ? 12 : 18}px ${t.fonts.title}`;
    ctx.fillText(`PASS TO PLAYER ${player}`, w / 2, cardY + 58);
    ctx.fillStyle = t.textPrimary;
    ctx.font = `bold ${w < 520 ? 12 : 18}px ${t.fonts.body}`;
    ctx.fillText(`PLAYER ${player}: TAP WHEN READY`, w / 2, cardY + 112);
    ctx.fillStyle = t.textMuted;
    ctx.font = `${Math.max(11, Math.min(16, Math.floor(w * 0.024)))}px ${t.fonts.body}`;
    const instruction = this.handoffReason === "setup"
      ? (this.phase === "setup" ? "The previous fleet is concealed. Deploy yours in private." : "Both fleets are concealed. Player 1 opens the battle.")
      : "The previous shot is concealed. Your waters await.";
    ctx.fillText(instruction, w / 2, cardY + 150, cardW - 36);
    ctx.fillStyle = t.textSecondary;
    ctx.fillText("Tap anywhere or press Enter", w / 2, cardY + cardH - 28);
    ctx.restore();
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private drawFleetStatus(ctx: CanvasRenderingContext2D, ox: number, oy: number, boardSize: number, panelH: number, which: "player" | "opponent", t: BouyTheme) {
    let board: Board;
    if (which === "player") {
      board = this.mode === "hotseat"
        ? (this.phase === "setup" ? this.getCurrentBoard() : this.currentTurn === "player1" ? this.player1Board : this.player2Board)
        : this.playerBoard;
    } else {
      board = this.mode === "hotseat"
        ? (this.phase === "setup" ? this.concealedBoard : this.currentTurn === "player1" ? this.player2Board : this.player1Board)
        : this.opponentBoard;
    }
    const panelX = ox;
    const panelY = oy;
    const panelW = boardSize;
    const itemW = Math.floor(panelW / FLEET.length);

    // Fixed-height fleet slots keep status text separate from health pips.
    ctx.fillStyle = t.panel;
    ctx.beginPath();
    ctx.rect(panelX, panelY, panelW, panelH);
    ctx.fill();
    ctx.strokeStyle = t.panelBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    const afloat = board.ships.filter((ship) => !ship.sunk).length;
    ctx.fillStyle = which === "player" ? t.playerColor : t.enemyColor;
    ctx.font = `bold 11px ${t.fonts.body}`;
    ctx.textAlign = "left";
    ctx.fillText(which === "player" ? "FLEET" : "RIVAL", panelX + 6, panelY + 14);
    ctx.fillStyle = t.textMuted;
    ctx.textAlign = "right";
    ctx.fillText(this.phase === "setup" && which === "opponent" ? "HIDDEN" : `${afloat}/5 ${this.phase === "setup" ? "SET" : "AFLOAT"}`, panelX + panelW - 6, panelY + 14);

    for (let typeIndex = 0; typeIndex < FLEET.length; typeIndex++) {
      const type = FLEET[typeIndex];
      const spec = SHIP_SPECS[type];
      const ship = board.ships.find((s) => s.type === type);
      const placed = !!ship;
      const sunk = ship?.sunk ?? false;
      const hits = ship?.hits.filter((h) => h).length ?? 0;
      const total = spec.size;
      const shipColors = t.shipColors[type] ?? { main: t.accent, light: t.accent, dark: t.accentDim };
      const itemX = panelX + typeIndex * itemW;
      const centerX = Math.floor(itemX + itemW / 2);
      ctx.fillStyle = t.bgDeep;
      ctx.fillRect(itemX + 2, panelY + 21, itemW - 4, panelH - 24);

      ctx.fillStyle = sunk ? t.sunkGlow : placed ? shipColors.light : t.textMuted;
      ctx.font = `bold 11px ${t.fonts.body}`;
      ctx.textAlign = "center";
      ctx.fillText(itemW >= 76 ? spec.label : spec.short, centerX, panelY + 34);

      const segGap = 1;
      const segAreaW = Math.max(14, itemW - 8);
      const segW = Math.max(2, Math.floor((segAreaW - (total - 1) * segGap) / total));
      const segH = 5;
      const segX = Math.floor(centerX - (segW * total + segGap * (total - 1)) / 2);
      const segY = panelY + 40;
      for (let i = 0; i < total; i++) {
        const sx = segX + i * (segW + segGap);
        if (placed && !sunk) {
          ctx.fillStyle = i < hits ? t.hitColor : shipColors.light;
          ctx.fillRect(sx, segY, segW, segH);
        } else if (sunk) {
          ctx.fillStyle = t.sunkGlow;
          ctx.fillRect(sx, segY, segW, segH);
        } else {
          ctx.fillStyle = t.gridLine;
          ctx.fillRect(sx, segY, segW, segH);
        }
      }

      let status = sunk ? "SUNK" : placed ? `${total - hits}/${total}` : "--";
      if (this.phase === "setup" && which === "player" && this.getCurrentShipType() === type && this.playerPlacing < FLEET.length) {
        status = "NEXT";
      }

      ctx.fillStyle = status === "NEXT" ? t.accent : sunk ? t.sunkGlow : t.textMuted;
      ctx.font = `11px ${t.fonts.body}`;
      ctx.fillText(status, centerX, panelY + 59);
    }

    ctx.textAlign = "left";
  }

  private drawBoard(ctx: CanvasRenderingContext2D, ox: number, oy: number, cell: number, which: "player" | "opponent", t: BouyTheme) {
    let grid: CellState[][];
    let board: Board;

    if (which === "player") {
      board = this.mode === "hotseat"
        ? (this.phase === "setup" ? this.getCurrentBoard() : this.currentTurn === "player1" ? this.player1Board : this.player2Board)
        : this.playerBoard;
      grid = board.grid;
    } else {
      grid = this.getTargetGrid();
      board = this.mode === "hotseat" ? (this.currentTurn === "player1" ? this.player2Board : this.player1Board) : this.opponentBoard;
    }
    const label = which === "player" ? "01 / YOUR WATERS" : "02 / TARGET GRID";
    const bw = GRID_SIZE * cell;
    const bh = GRID_SIZE * cell;

    ctx.save();

    // Flat board frame
    ctx.shadowBlur = 0;
    ctx.strokeStyle = t.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 3, oy - 3, bw + 6, bh + 6);
    ctx.shadowBlur = 0;

    // Water background for the board
    if (this.themeId === "charter") {
      ctx.fillStyle = t.gridBg;
      ctx.fillRect(ox, oy, bw, bh);
    } else this.drawWater(ctx, ox, oy, bw, bh, t);

    // Grid lines
    ctx.strokeStyle = t.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(ox + i * cell + 0.5, oy);
      ctx.lineTo(ox + i * cell + 0.5, oy + bh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox, oy + i * cell + 0.5);
      ctx.lineTo(ox + bw, oy + i * cell + 0.5);
      ctx.stroke();
    }

    // Ships sit below shot markers so damage symbols remain identical on both grids.
    if (which === "player") {
      for (const ship of board.ships) {
        const shipColor = t.shipColors[ship.type] ?? { main: t.accent, light: t.accent, dark: t.accentDim };
        this.drawShipSilhouette(ctx, ship.cells, cell, ox, oy, shipColor.main, shipColor.dark, 1, ship.sunk, ship.hits, ship.type);
      }
    }
    // Incoming misses live in the shot grid, not in the ship grid.
    const incoming = this.mode === "hotseat" ? (this.currentTurn === "player1" ? this.opponentTargetGrid : this.playerTargetGrid) : this.playerTargetGrid;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cx = ox + x * cell;
        const cy = oy + y * cell;
        const state = which === "player" && incoming[y][x] === CELL_STATES.miss ? CELL_STATES.miss : grid[y][x];

        if (state === CELL_STATES.hit || state === CELL_STATES.miss || state === CELL_STATES.sunk) {
          const midX = cx + Math.floor(cell / 2);
          const midY = cy + Math.floor(cell / 2);
          const arm = Math.max(3, Math.floor(cell / 4));
          ctx.fillStyle = state === CELL_STATES.miss ? t.textSecondary : t.hitColor;
          if (state === CELL_STATES.miss) ctx.fillRect(midX - 2, midY - 2, 4, 4);
          else {
            ctx.fillRect(cx + 2, cy + 2, cell - 4, cell - 4);
            ctx.fillStyle = t.textPrimary;
            if (state === CELL_STATES.sunk) {
              for (let d = -arm; d <= arm; d++) {
                ctx.fillRect(midX + d, midY + d, 2, 2);
                ctx.fillRect(midX + d, midY - d, 2, 2);
              }
            } else {
              ctx.fillRect(midX - arm, midY - 1, arm * 2 + 1, 3);
              ctx.fillRect(midX - 1, midY - arm, 3, arm * 2 + 1);
            }
          }
        }
      }
    }

    if (which === "player") {
      // Ghost preview during setup
      if (this.phase === "setup" && this.hoverCell && !this.onlineFleetSubmitted) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox, oy, bw, bh);
        ctx.clip();
        const [hx, hy] = this.hoverCell;
        const size = this.getCurrentShipSize();
        const previewCells: [number, number][] = [];
        for (let i = 0; i < size; i++) {
          previewCells.push(this.horizontal ? [hx + i, hy] : [hx, hy + i]);
        }
        const valid = this.canPlaceAt(hx, hy);
        const previewType = this.getCurrentShipType();
        const shipColor = t.shipColors[previewType] ?? { main: t.accent, light: t.accent, dark: t.accentDim };
        this.drawShipSilhouette(
          ctx, previewCells, cell, ox, oy,
          valid ? `${shipColor.main}60` : `${t.hitColor}60`,
          valid ? shipColor.main : t.hitColor,
          0.6, false, [], previewType,
        );
        ctx.restore();
      }
    }

    // Label
    ctx.fillStyle = which === "player" ? t.playerColor : t.enemyColor;
    ctx.font = `bold 12px ${t.fonts.body}`;
    ctx.textAlign = "center";
    ctx.fillText(label, ox + bw / 2, oy - 27);

    // Dedicated gutters keep coordinates readable even when the edge cells contain ships.
    ctx.fillStyle = t.textMuted;
    ctx.font = `11px ${t.fonts.body}`;
    for (let i = 0; i < GRID_SIZE; i++) {
      ctx.fillText(String.fromCharCode(65 + i), ox + i * cell + Math.floor(cell / 2), oy - 9);
      ctx.fillText(String(i + 1), ox - 16, oy + i * cell + Math.floor(cell / 2) + 4);
    }
    ctx.globalAlpha = 1;

    // Both hotseat players fire at the target grid, never their own waters.
    if (this.phase === "play" && !this.agentThinking) {
      const isPlayerTurn = this.currentTurn === "player" || this.mode === "hotseat";
      if (which === "opponent" && isPlayerTurn) {
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox - 5, oy - 5, bw + 10, bh + 10);
        if (this.hoverCell) {
          const [x, y] = this.hoverCell;
          ctx.strokeStyle = grid[y][x] === CELL_STATES.empty ? t.accent : t.enemyColor;
          ctx.strokeRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4);
        }
      }
    }

    // Flash effects (explosions for hits, splashes for misses, expanding rings for sinks)
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, bw, bh);
    ctx.clip();
    for (const f of this.flashCells) {
      const boards: ("player" | "opponent" | "player1" | "player2")[] = [];
      if (f.board === "player") boards.push("player");
      else if (f.board === "opponent") boards.push("opponent");
      else if (f.board === "player1") boards.push(this.mode === "hotseat" && this.currentTurn === "player2" ? "player" : "opponent");
      else if (f.board === "player2") boards.push(this.mode === "hotseat" && this.currentTurn === "player1" ? "player" : "opponent");

      if (boards.includes(which)) {
        if (this.themeId === "charter") {
          ctx.strokeStyle = f.type === "miss" ? t.textSecondary : t.accent;
          ctx.lineWidth = 2;
          ctx.strokeRect(ox + f.x * cell + 2, oy + f.y * cell + 2, cell - 4, cell - 4);
          continue;
        }
        const fx = ox + f.x * cell + cell / 2;
        const fy = oy + f.y * cell + cell / 2;
        const maxTimer = f.type === "sink" ? 800 : f.type === "hit" ? 300 : 250;
        const progress = 1 - Math.max(0, f.timer / maxTimer);

        if (f.type === "hit") {
          this.drawExplosionAt(ctx, fx, fy, cell * 0.6, t, progress);
        } else if (f.type === "miss") {
          this.drawSplashAt(ctx, fx, fy, cell, t, progress);
        } else if (f.type === "sink") {
          this.drawExplosionAt(ctx, fx, fy, cell * 1.0, t, Math.min(1, progress * 1.5));
          const ringR = cell * 0.8 * (1 + progress * 0.5);
          ctx.globalAlpha = 1 - progress;
          ctx.strokeStyle = t.sunkGlow;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fx, fy, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();

    ctx.textAlign = "left";
    ctx.restore();
  }

  // Input handlers
  pointerDown(nx: number, ny: number, w: number, h: number) {
    if (this.acknowledgeHandoff()) return;
    const { cell, startX, startY, opponentX, opponentY } = this.getBoardLayout(w, h);

    // On-screen setup controls (rotate + auto) — mouse AND touch friendly
    if (this.phase === "setup") {
      const rb = this.getRotateButtonRect(w, h);
      if (nx >= rb.x && nx <= rb.x + rb.w && ny >= rb.y && ny <= rb.y + rb.h) {
        this.horizontal = !this.horizontal;
        this.setMessage("SHIP ROTATED");
        return;
      }
      const ab = this.getAutoButtonRect(w, h);
      if (nx >= ab.x && nx <= ab.x + ab.w && ny >= ab.y && ny <= ab.y + ab.h) {
        this.randomizeCurrentBoard();
        this.setMessage("FLEET AUTO-DEPLOYED");
        return;
      }
    }

    // Check own board (placement)
    const ownX = Math.floor((nx - startX) / cell);
    const ownY = Math.floor((ny - startY) / cell);
    if (ownX >= 0 && ownX < GRID_SIZE && ownY >= 0 && ownY < GRID_SIZE) {
      if (this.phase === "setup") {
        if (this.canPlaceAt(ownX, ownY)) this.placeCurrentShip(ownX, ownY);
        else {
          this.message = "BLOCKED / KEEP A 1-CELL GAP; STAY IN GRID";
          this.messageTimer = 1800;
        }
      }
      return;
    }

    // Check opponent board (firing)
    const oppX = Math.floor((nx - opponentX) / cell);
    const oppY = Math.floor((ny - opponentY) / cell);
    if (oppX >= 0 && oppX < GRID_SIZE && oppY >= 0 && oppY < GRID_SIZE) {
      if (this.phase === "play") {
        if ((this.mode === "agent" || this.mode === "online") && this.currentTurn === "player") {
          this.playerFire(oppX, oppY);
        } else if (this.mode === "hotseat") {
          this.playerFire(oppX, oppY);
        }
      } else if (this.phase === "over") {
        this.reset();
      }
    }
  }

  pointerMove(nx: number, ny: number, w: number, h: number) {
    if (this.handoffPending || this.phase === "over") { this.hoverCell = null; return; }
    const { cell, startX, startY, opponentX, opponentY } = this.getBoardLayout(w, h);
    const x = Math.floor((nx - (this.phase === "setup" ? startX : opponentX)) / cell);
    const y = Math.floor((ny - (this.phase === "setup" ? startY : opponentY)) / cell);
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      this.hoverCell = [x, y];
    } else {
      this.hoverCell = null;
    }
  }

  keyDown(key: string) {
    const upper = key.toUpperCase();
    if (this.handoffPending && (upper === "ENTER" || upper === " ")) {
      this.acknowledgeHandoff();
      return;
    }
    if (upper === "R") {
      if (this.phase === "setup") this.horizontal = !this.horizontal;
    }
    if (upper === "A") {
      if (this.phase === "setup") this.randomizeCurrentBoard();
    }
    if (upper === "D") {
      if (this.phase === "setup" && this.mode === "agent") {
        const difficulties: ("easy" | "normal" | "hard")[] = ["easy", "normal", "hard"];
        const idx = difficulties.indexOf(this.agentDifficulty);
        this.agentDifficulty = difficulties[(idx + 1) % 3];
        this.setMessage(`DIFFICULTY: ${this.agentDifficulty.toUpperCase()}`, 1500);
      }
    }
    if (upper === "ESCAPE") {
      // Handled by main loop
    }
  }
}

export function renownFromBouyScore(result: BouyResult): number {
  if (!result.winner) return 0;
  const isVictory = result.winner === "player" || result.winner === "player1";
  const efficiency = result.turns > 0 ? Math.min(1.5, 50 / result.turns) : 1;
  return Math.floor((isVictory ? 180 : 60) * efficiency);
}

export function tokensFromBouyScore(result: BouyResult, stake = 0): number {
  if (!result.winner) return 0;
  const isVictory = result.winner === "player" || result.winner === "player1";
  return isVictory ? stake * 2 : 0;
}
