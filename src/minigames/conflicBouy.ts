/**
 * Conflic Bouy — Charter Battleship.
 * 10×10 grid, standard fleet, turn-based vs Agent or 1v1 hot-seat.
 * Now with: fleet status, parity AI, auto-randomize, ship health bars, hotseat placement for both players.
 */

import { playPlatformLand, playPlatformPickup, playWarriorImpact } from "../audio/warriorSfx";
import { BouyTheme, getTheme, BouyThemeId } from "./conflicBouyThemes";
import { getContextualSparrowLine, getVariantLine } from "./conflicBouyPersonality";

export type BouyMode = "agent" | "hotseat";
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
  playerTargetGrid: CellState[][] = emptyGrid();
  opponentTargetGrid: CellState[][] = emptyGrid();
  currentTurn: "player" | "agent" | "player1" | "player2" = "player";
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
  private agentDifficulty: "easy" | "normal" | "hard" = "normal";
  private lastHitDirection: [number, number] | null = null;
  themeId: BouyThemeId = "charter";
  stake = 0;
  private awaitingAbility = false;
  private lastW = 0;
  private lastH = 0;

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
  // Board entrance animation
  private boardEnterTimer = 0;
  private boardEnterDone = false;
  // Cannon fire projectile
  private cannonFire: { sx: number; sy: number; tx: number; ty: number; t: number; duration: number; color: string } | null = null;
  // Sink sequence (bow-to-stern flash)
  private sinkSequence: { cells: [number, number][]; board: "player" | "opponent"; timer: number; cellIndex: number } | null = null;
  // Smooth health bar interpolation
  private smoothHealth: Map<string, number> = new Map();
  // Turn transition wipe
  private turnWipe = 0;
  private turnWipeColor = "";

  constructor(opts?: { mode?: BouyMode; theme?: BouyThemeId; stake?: number }) {
    this.mode = opts?.mode ?? "agent";
    this.themeId = opts?.theme ?? "charter";
    this.stake = opts?.stake ?? 0;
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
      mode: this.mode,
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
    this.playerBoard = createBoard();
    this.opponentBoard = randomBoard();
    this.player1Board = createBoard();
    this.player2Board = createBoard();
    this.playerTargetGrid = emptyGrid();
    this.opponentTargetGrid = emptyGrid();
    this.currentTurn = "player";
    this.playerPlacing = 0;
    this.horizontal = true;
    this.hoverCell = null;
    this.result = { winner: null, playerHits: 0, playerMisses: 0, agentHits: 0, agentMisses: 0, turns: 0 };
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
    this.awaitingAbility = false;
    // Reset animation state
    this.popups = [];
    this.combo = 0;
    this.comboTimer = 0;
    this.firstBlood = false;
    this.boardEnterTimer = 0;
    this.boardEnterDone = false;
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
      return this.currentTurn === "player1" ? this.player1Board.grid : this.player2Board.grid;
    }
    return this.playerBoard.grid;
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
    if (this.playerPlacing >= FLEET.length) {
      if (this.mode === "hotseat" && this.setupSubPhase === "player1") {
        this.setupSubPhase = "player2";
        this.playerPlacing = 0;
        this.horizontal = true;
        this.hoverCell = null;
        this.setMessage("PLAYER 2 — DEPLOY YOUR FLEET", 2000);
      } else {
        this.phase = "play";
        this.setupSubPhase = "done";
        this.currentTurn = this.mode === "hotseat" ? "player1" : "player";
        this.opponentBoard = this.mode === "agent" ? randomBoard() : this.player2Board;
        this.setMessage(this.getSparrowLine("game_start"), 2500);
      }
    }
    return true;
  }

  randomizeCurrentBoard() {
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
  }

  setMessage(text: string, duration = 1200) {
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
      this.messageTimer = 1200;
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
    const { cell, startX, startY, boardSize, gap } = this.getBoardLayout(w, h);
    const screenX = startX + (byPlayer ? 0 : 1) * (GRID_SIZE * cell + gap) + x * cell + cell / 2;
    const screenY = startY + y * cell + cell / 2;
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
      sx: byPlayer ? startX + (GRID_SIZE * cell) / 2 : startX + boardSize + gap + (GRID_SIZE * cell) / 2,
      sy: startY + boardSize + 10,
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
    const { cell, startX, startY, boardSize, gap } = this.getBoardLayout(w, h);
    const screenX = startX + (byPlayer ? 0 : 1) * (GRID_SIZE * cell + gap) + x * cell + cell / 2;
    const screenY = startY + y * cell + cell / 2;
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
      sx: byPlayer ? startX + (GRID_SIZE * cell) / 2 : startX + boardSize + gap + (GRID_SIZE * cell) / 2,
      sy: startY + boardSize + 10,
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
    const { cell, startX, startY, boardSize, gap } = this.getBoardLayout(w, h);
    const screenX = startX + (byPlayer ? 0 : 1) * (GRID_SIZE * cell + gap) + x * cell + cell / 2;
    const screenY = startY + y * cell + cell / 2;
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
      sx: byPlayer ? startX + (GRID_SIZE * cell) / 2 : startX + boardSize + gap + (GRID_SIZE * cell) / 2,
      sy: startY + boardSize + 10,
      tx: screenX,
      ty: screenY,
      t: 0,
      duration: 100,
      color: this.theme.sunkGlow,
    };
  }

  private getBoardLayout(w: number, h: number) {
    const headerH = 56;
    const footerH = 48;
    const availH = h - headerH - footerH;
    const boardSize = Math.min(w * 0.44, availH * 0.9);
    const cell = boardSize / GRID_SIZE;
    const gap = Math.max(20, w * 0.035);
    const startX = (w - boardSize * 2 - gap) / 2;
    const startY = headerH + (availH - boardSize) / 2;
    return { cell, startX, startY, boardSize, gap };
  }

  playerFire(x: number, y: number): boolean {
    if (this.phase !== "play") return false;
    const isPlayerTurn = this.currentTurn === "player" || this.currentTurn === "player1";
    if (!isPlayerTurn) return false;
    const targetGrid = this.getTargetGrid();
    if (targetGrid[y][x] !== CELL_STATES.empty) return false;
    const opponentBoard = this.getOpponentBoard();
    const res = this.fireAt(opponentBoard, targetGrid, x, y, true);
    if (res === "hit") {
      this.result.playerHits++;
      this.setMessage(this.getSparrowLine("player_hit"));
    } else if (res === "sink") {
      this.result.playerHits++;
      const shipType = opponentBoard.shipMap.get(`${x},${y}`)?.type.toUpperCase() ?? "SHIP";
      this.setMessage(this.getSparrowLine("player_sink") + ` — ${shipType} SUNK!`);
    } else if (res === "miss") {
      this.result.playerMisses++;
      this.setMessage(this.getSparrowLine("player_miss"));
      this.endTurn();
    }
    this.result.turns++;
    this.checkWin();
    return true;
  }

  endTurn(scheduleNext = true) {
    // Turn transition wipe
    this.turnWipe = 1;
    this.turnWipeColor = this.theme.accent;
    if (this.mode === "agent") {
      // Agent always passes to player after its turn
      this.currentTurn = "player";
    } else {
      this.currentTurn = this.currentTurn === "player1" ? "player2" : "player1";
    }
    // Reset ability active flags at end of turn
    this.resetAbilityFlags();
    if (scheduleNext && this.mode === "agent") {
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
    const ability = SHIP_ABILITIES[type];
    if (!ability) return false;
    const board = this.getCurrentBoard();
    const ship = board.ships.find((s) => s.type === type);
    if (!ship || ship.sunk) return false;
    const currentTurn = this.result.turns;
    return ship.abilityUsed === -1 || currentTurn - ship.abilityUsed >= ability.cooldown;
  }

  useAbility(type: ShipType, targetX?: number, targetY?: number): boolean {
    if (!this.canUseAbility(type)) return false;
    const ability = SHIP_ABILITIES[type];
    const board = this.getCurrentBoard();
    const ship = board.ships.find((s) => s.type === type);
    if (!ship) return false;
    ship.abilityUsed = this.result.turns;
    this.setMessage(`ABILITY: ${ability.name}! ${ability.description}`);
    // Ability popup
    this.popups.push({ text: `⚡ ${ability.name}!`, x: this.lastW / 2, y: this.lastH * 0.3, life: 1000, maxLife: 1000, color: "#c0f0ff", size: 12, type: "ability" });
    this.executeAbility(type, targetX, targetY);
    // Ability counts as turn action - end turn
    if (this.mode !== "agent" || this.currentTurn !== "agent") {
      this.endTurn();
    }
    return true;
  }

  private executeAbility(type: ShipType, targetX?: number, targetY?: number) {
    const opponentBoard = this.getOpponentBoard();
    const targetGrid = this.getTargetGrid();
    switch (type) {
      case "carrier": // Air Strike - reveal 3x3
        if (targetX !== undefined && targetY !== undefined) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const x = targetX + dx;
              const y = targetY + dy;
              if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                if (targetGrid[y][x] === CELL_STATES.empty) {
                  this.fireAt(opponentBoard, targetGrid, x, y, true);
                }
              }
            }
          }
        }
        this.setMessage("AIR STRIKE COMPLETE — 3x3 area scanned!");
        break;
      case "battleship": // Broadside - 3 horizontal shots
        if (targetX !== undefined && targetY !== undefined) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = targetX + dx;
            const y = targetY;
            if (x >= 0 && x < GRID_SIZE && targetGrid[y][x] === CELL_STATES.empty) {
              this.fireAt(opponentBoard, targetGrid, x, y, true);
            }
          }
        }
        this.setMessage("BROADSIDE FIRED — Three shots across the line!");
        break;
      case "cruiser": // Radar Ping - cross pattern
        if (targetX !== undefined && targetY !== undefined) {
          const pattern = [[0,0], [1,0], [-1,0], [0,1], [0,-1]];
          for (const [dx, dy] of pattern) {
            const x = targetX + dx;
            const y = targetY + dy;
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
              if (targetGrid[y][x] === CELL_STATES.empty) {
                this.fireAt(opponentBoard, targetGrid, x, y, true);
              }
            }
          }
        }
        this.setMessage("RADAR PING COMPLETE — Cross pattern scanned!");
        break;
      case "submarine": // Silent Run - evasion (2 shots)
        if (targetX !== undefined && targetY !== undefined) {
          // Target current player's own board (for hotseat) or opponent (agent mode)
          const targetBoard = this.mode === "hotseat" ? this.getCurrentBoard() : opponentBoard;
          const ship = targetBoard.shipMap.get(`${targetX},${targetY}`);
          if (ship && ship.type === "submarine") {
            ship.abilityActive = true;
            ship.evasionCharges = 2; // Track evasion charges
            this.setMessage("SILENT RUN ACTIVATED — Submarine evading next 2 shots!");
          } else {
            this.setMessage("NO FRIENDLY SUBMARINE AT TARGET!");
          }
        }
        break;
      case "destroyer": // Depth Charge - auto-hit random
        const hiddenCells: [number, number][] = [];
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            if (targetGrid[y][x] === CELL_STATES.empty && opponentBoard.grid[y][x] === CELL_STATES.ship) {
              hiddenCells.push([x, y]);
            }
          }
        }
        if (hiddenCells.length > 0) {
          const [x, y] = hiddenCells[Math.floor(Math.random() * hiddenCells.length)];
          this.fireAt(opponentBoard, targetGrid, x, y, true);
          this.setMessage(`DEPTH CHARGE DETONATED — Auto-hit at ${String.fromCharCode(65+x)}${y+1}!`);
        } else {
          this.setMessage("DEPTH CHARGE — No hidden targets found!");
        }
        break;
    }
  }

  scheduleAgentTurn() {
    this.agentThinking = true;
    setTimeout(() => {
      this.agentThinking = false;
      this.setMessage(this.getSparrowLine("agent_turn_start"));
      this.agentTurn();
    }, 600 + Math.random() * 400);
  }

  agentTurn() {
    if (this.phase !== "play" || this.currentTurn !== "agent") return;
    
    // Agent considers using an ability first
    if (this.agentConsiderAbility()) {
      // Ability used - end agent turn, pass to player (don't schedule another agent turn)
      this.endTurn(false);
      return;
    }

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
      this.scheduleAgentTurn();
    this.scheduleAgentTurn();
    } else if (res === "sink") {
      this.result.agentHits++;
      this.setMessage(this.getSparrowLine("agent_sink"));
      this.huntMode = false;
      this.huntQueue = [];
      this.lastHit = null;
      this.lastHitDirection = null;
      this.endTurn();
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
      this.endTurn();
    }
    this.result.turns++;
    this.checkWin();
  }

  private agentConsiderAbility(): boolean {
    if (this.agentDifficulty === "easy") return false;
    const abilities = ["carrier", "battleship", "cruiser", "submarine", "destroyer"] as ShipType[];
    const shuffled = [...abilities].sort(() => Math.random() - 0.5);
    for (const type of shuffled) {
      if (this.canUseAbility(type)) {
        // Use ability based on situation
        if (type === "destroyer" && this.agentDifficulty === "hard") {
          // Always use depth charge if available on hard
          this.useAbility(type);
          return true;
        }
        if (type === "carrier" && Math.random() < 0.3) {
          // Random target for air strike
          const targets: [number, number][] = [];
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              if (this.playerTargetGrid[y][x] === CELL_STATES.empty) {
                targets.push([x, y]);
              }
            }
          }
          if (targets.length > 0) {
            const [x, y] = targets[Math.floor(Math.random() * targets.length)];
            this.useAbility("carrier", x, y);
            return true;
          }
        }
        if (type === "cruiser" && Math.random() < 0.25) {
          const targets: [number, number][] = [];
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              if (this.playerTargetGrid[y][x] === CELL_STATES.empty) {
                targets.push([x, y]);
              }
            }
          }
          if (targets.length > 0) {
            const [x, y] = targets[Math.floor(Math.random() * targets.length)];
            this.useAbility("cruiser", x, y);
            return true;
          }
        }
        if (type === "submarine" && Math.random() < 0.2) {
          // Protect own submarine
          const subs = this.opponentBoard.ships.filter(s => s.type === "submarine" && !s.sunk);
          if (subs.length > 0) {
            const sub = subs[0];
            const [x, y] = sub.cells[0];
            this.useAbility("submarine", x, y);
            return true;
          }
        }
      }
    }
    return false;
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
      if (this.mode === "agent") {
        this.result.winner = opponentDead ? "player" : "agent";
        this.setMessage(this.getSparrowLine(this.result.winner === "player" ? "victory" : "defeat"), 4000);
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

    // Board entrance
    if (!this.boardEnterDone && this.phase === "setup") {
      this.boardEnterTimer = Math.min(1, this.boardEnterTimer + dt * 0.003);
      if (this.boardEnterTimer >= 1) this.boardEnterDone = true;
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

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    this.lastW = w;
    this.lastH = h;
    const t = this.theme;
    ctx.imageSmoothingEnabled = false;

    // Screen shake transform
    ctx.save();
    if (this.screenShake > 0) {
      ctx.translate(this.screenShakeX, this.screenShakeY);
    }

    // Background with vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
    grad.addColorStop(0, t.bg);
    grad.addColorStop(1, t.bgDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Vignette overlay
    if (t.effects.vignette > 0) {
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, `rgba(0,0,0,${t.effects.vignette})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    const headerH = 56;
    const footerH = 48;
    const availH = h - headerH - footerH;
    const boardSize = Math.min(w * 0.44, availH * 0.9);
    const cell = boardSize / GRID_SIZE;
    const gap = Math.max(20, w * 0.035);
    const startX = (w - boardSize * 2 - gap) / 2;
    const startY = headerH + (availH - boardSize) / 2;

    // Board entrance animation offsets
    let leftOffsetX = 0, rightOffsetX = 0;
    if (!this.boardEnterDone && this.boardEnterTimer < 1) {
      const ease = 1 - Math.pow(1 - this.boardEnterTimer, 3);
      leftOffsetX = (1 - ease) * -40;
      rightOffsetX = (1 - ease) * 40;
    }

    // Header
    ctx.fillStyle = t.bgDeep;
    ctx.fillRect(0, 0, w, headerH);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, headerH - 2, w, 2);

    ctx.textAlign = "center";
    ctx.fillStyle = t.accent;
    ctx.font = `${Math.max(20, Math.floor(w * 0.04))}px ${t.fonts.title}`;
    ctx.fillText(t.terms.gameTitle, w / 2, 32);

    ctx.fillStyle = t.textSecondary;
    ctx.font = `${Math.max(13, Math.floor(w * 0.028))}px ${t.fonts.body}`;
    const modeText = this.mode === "agent" ? "vs AGENT" : "1v1 HOTSEAT";
    let turnText = "";
    if (this.phase === "setup") {
      const placer = this.mode === "hotseat" ? `PLAYER ${this.setupSubPhase === "player1" ? 1 : 2}` : "YOU";
      turnText = `${placer}: ${t.terms.deploy} ${this.getCurrentShipType().toUpperCase()} (${this.getCurrentShipSize()}) — R rotate, A auto`;
    } else if (this.phase === "over") {
      const isVictory = this.result.winner === "player" || this.result.winner === "player1";
      turnText = `GAME OVER — ${isVictory ? t.terms.victory : t.terms.defeat} · ${this.result.turns} turns`;
    } else {
      const turnLabel = this.currentTurn === "player" || this.currentTurn === "player1" ? t.terms.turnYou :
        this.mode === "agent" ? t.terms.turnEnemy : t.terms.turnPlayer2;
      const thinking = this.agentThinking ? " · THINKING..." : "";
      turnText = `${turnLabel}${thinking}`;
    }
    ctx.fillText(`${modeText} · ${turnText}`, w / 2, 50);

    // Draw boards with entrance animation offsets
    this.drawBoard(ctx, startX + leftOffsetX, startY, cell, "player", t);
    this.drawBoard(ctx, startX + boardSize + gap + rightOffsetX, startY, cell, "opponent", t);

    // Fleet status panels
    this.drawFleetStatus(ctx, startX, startY, boardSize, cell, "player", t);
    this.drawFleetStatus(ctx, startX + boardSize + gap, startY, boardSize, cell, "opponent", t);

    // Cannon fire projectile
    if (this.cannonFire) {
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
      const boardX = ss.board === "player" ? startX + leftOffsetX : startX + boardSize + gap + rightOffsetX;
      for (let i = 0; i <= ss.cellIndex && i < ss.cells.length; i++) {
        const [cx, cy] = ss.cells[i];
        const flashAlpha = i === ss.cellIndex ? 0.8 : 0.3;
        ctx.fillStyle = `${t.sunkGlow}${Math.floor(flashAlpha * 255).toString(16).padStart(2, '0')}`;
        ctx.fillRect(boardX + cx * cell, startY + cy * cell, cell, cell);
      }
    }

    // Message
    if (this.messageTimer > 0 && this.message) {
      const alpha = Math.min(1, this.messageTimer / 500);
      ctx.fillStyle = `${t.accent}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.font = `${Math.max(16, Math.floor(w * 0.035))}px ${t.fonts.body}`;
      ctx.fillText(this.message, w / 2, h - footerH + 20);
    }

    // Footer hint
    ctx.fillStyle = t.bgDeep;
    ctx.fillRect(0, h - footerH, w, footerH);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, h - footerH, w, 1);

    ctx.fillStyle = t.textMuted;
    ctx.font = `${Math.max(11, Math.floor(w * 0.024))}px ${t.fonts.body}`;
    let hint = "";
    if (this.phase === "setup") {
      hint = "CLICK/TAP to place · R rotate · A auto-randomize";
    } else if (this.phase === "over") {
      hint = "CLICK anywhere for NEW GAME · ESC for tavern";
    } else {
      hint = this.mode === "hotseat" ? "CLICK enemy grid to fire" : "CLICK enemy grid to fire · ESC to quit";
    }
    ctx.fillText(hint, w / 2, h - 14);
    ctx.textAlign = "left";

    // Turn transition wipe (subtle top-edge wipe on turn change)
    if (this.turnWipe > 0) {
      const wipeAlpha = this.turnWipe * 0.35;
      ctx.fillStyle = `${this.turnWipeColor}${Math.floor(wipeAlpha * 255).toString(16).padStart(2, '0')}`;
      ctx.fillRect(0, 0, w, headerH + 4);
    }

    // Theme scanlines effect
    if (t.effects.scanlines) {
      ctx.save();
      ctx.globalAlpha = 0.04;
      for (let y = 0; y < h; y += 3) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, y, w, 1);
      }
      ctx.restore();
    }

    // Theme CRT barrel distortion (simulated with gradient)
    if (t.effects.crt) {
      ctx.save();
      const crtGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.7);
      crtGrad.addColorStop(0, "rgba(0,0,0,0)");
      crtGrad.addColorStop(1, "rgba(0,0,0,0.15)");
      ctx.fillStyle = crtGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Theme glitch effect (random horizontal offset lines)
    if (t.effects.glitch && Math.random() < 0.03) {
      ctx.save();
      const glitchY = Math.random() * h;
      const glitchH = 2 + Math.random() * 6;
      const glitchShift = (Math.random() - 0.5) * 8;
      ctx.drawImage(ctx.canvas, 0, glitchY, w, glitchH, glitchShift, glitchY, w, glitchH);
      ctx.restore();
    }

    ctx.restore(); // Restore screen shake transform

    // Draw particles on top (not affected by screen shake) with differentiated shapes
    for (const p of this.particles) {
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
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private drawFleetStatus(ctx: CanvasRenderingContext2D, ox: number, oy: number, boardSize: number, cell: number, which: "player" | "opponent", t: BouyTheme) {
    let board: Board;
    if (which === "player") {
      board = this.mode === "hotseat" ? (this.currentTurn === "player1" || this.phase === "setup" ? this.player1Board : this.player2Board) : this.playerBoard;
    } else {
      board = this.mode === "hotseat" ? (this.currentTurn === "player1" ? this.player2Board : this.player1Board) : this.opponentBoard;
    }
    const isSetup = this.phase === "setup";
    const panelX = ox + boardSize + 8;
    const panelY = oy;
    const panelW = Math.max(100, cell * 3.5);
    const panelH = boardSize;

    ctx.fillStyle = `${t.panel}DD`;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = t.panelBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = which === "player" ? t.playerColor : t.enemyColor;
    ctx.font = `${Math.max(11, Math.floor(cell * 0.5))}px ${t.fonts.body}`;
    ctx.textAlign = "center";
    ctx.fillText(t.terms[which === "player" ? "playerFleet" : "enemyFleet"], panelX + panelW / 2, panelY + 16);

    let yOffset = panelY + 30;
    for (const type of FLEET) {
      const spec = SHIP_SPECS[type];
      const ship = board.ships.find((s) => s.type === type);
      const placed = !!ship;
      const sunk = ship?.sunk ?? false;
      const hits = ship?.hits.filter((h) => h).length ?? 0;
      const total = spec.size;
      const shipColors = t.shipColors[type] ?? { main: t.accent, light: t.accent, dark: t.accentDim };

      // Ship icon
      ctx.fillStyle = placed ? (sunk ? t.sunkColor : shipColors.main) : `${t.playerColor}4D`;
      ctx.fillRect(panelX + 8, yOffset, 16, 16);
      ctx.strokeStyle = sunk ? t.sunkGlow : (placed ? shipColors.main : `${t.playerColor}80`);
      ctx.lineWidth = sunk ? 2 : 1;
      ctx.strokeRect(panelX + 8, yOffset, 16, 16);

      // Health bar
      if (placed && !sunk) {
        const barW = panelW - 40;
        const barH = 6;
        const barX = panelX + 30;
        const barY = yOffset + 5;
        ctx.fillStyle = t.gridBg;
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = hits > 0 ? t.hitColor : t.playerColor;
        ctx.fillRect(barX, barY, Math.max(1, barW * (hits / total)), barH);
        ctx.strokeStyle = `${t.accent}4D`;
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
      }

      // Label
      ctx.fillStyle = sunk ? t.sunkGlow : (placed ? t.textPrimary : t.textMuted);
      ctx.font = `${Math.max(10, Math.floor(cell * 0.4))}px ${t.fonts.body}`;
      ctx.textAlign = "left";
      ctx.fillText(`${spec.short} ${sunk ? "SUNK" : placed ? `${hits}/${total}` : "—"}`, panelX + 30, yOffset + 14);

      // During setup, show current ship highlight
      if (isSetup && which === "player" && this.getCurrentShipType() === type && this.playerPlacing < FLEET.length) {
        ctx.fillStyle = `${t.accent}4D`;
        ctx.fillRect(panelX + 4, yOffset - 2, panelW - 8, 20);
      }

      yOffset += 24;
    }
    ctx.textAlign = "left";
  }

  private drawBoard(ctx: CanvasRenderingContext2D, ox: number, oy: number, cell: number, which: "player" | "opponent", t: BouyTheme) {
    let grid: CellState[][];

    if (which === "player") {
      grid = this.getOwnGrid();
    } else {
      grid = this.getTargetGrid();
    }
    const label = which === "player" ? t.terms.playerFleet : t.terms.targetingGrid;

    // Board background
    ctx.fillStyle = t.gridBg;
    ctx.fillRect(ox - 4, oy - 4, GRID_SIZE * cell + 8, GRID_SIZE * cell + 8);
    ctx.strokeStyle = t.panelBorder;
    ctx.lineWidth = 3;
    ctx.strokeRect(ox - 4, oy - 4, GRID_SIZE * cell + 8, GRID_SIZE * cell + 8);

    // Label
    ctx.fillStyle = which === "player" ? t.playerColor : t.enemyColor;
    ctx.font = `${Math.max(12, Math.floor(cell * 0.55))}px ${t.fonts.body}`;
    ctx.textAlign = "center";
    ctx.fillText(label, ox + GRID_SIZE * cell / 2, oy - 10);

    // Grid cells
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cx = ox + x * cell;
        const cy = oy + y * cell;
        const state = grid[y][x];
        let fill = t.gridBg;
        let stroke = t.gridLine;

        if (state === CELL_STATES.ship) {
          fill = "#1a2838";
          stroke = `${t.playerColor}4D`;
        } else if (state === CELL_STATES.hit) {
          fill = t.hitColor;
          stroke = t.hitGlow;
        } else if (state === CELL_STATES.miss) {
          fill = t.missColor;
          stroke = t.textMuted;
        } else if (state === CELL_STATES.sunk) {
          fill = t.sunkColor;
          stroke = t.sunkGlow;
        }

        ctx.fillStyle = fill;
        ctx.fillRect(cx, cy, cell, cell);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, cell, cell);

        // Ship preview during placement
        if (this.phase === "setup" && which === "player" && this.hoverCell) {
          const [hx, hy] = this.hoverCell;
          const size = this.getCurrentShipSize();
          const cells: [number, number][] = [];
          for (let i = 0; i < size; i++) {
            cells.push(this.horizontal ? [hx + i, hy] : [hx, hy + i]);
          }
          if (cells.some(([cx, cy]) => cx === x && cy === y)) {
            const valid = this.canPlaceAt(hx, hy);
            ctx.fillStyle = valid ? `${t.playerColor}73` : `${t.hitColor}73`;
            ctx.fillRect(cx, cy, cell, cell);
            // Show ship outline
            ctx.strokeStyle = valid ? t.playerColor : t.hitColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - 1, cy - 1, cell + 2, cell + 2);
          }
        }
      }
    }

    // Coordinate labels
    ctx.fillStyle = t.textMuted;
    ctx.font = `${Math.max(9, Math.floor(cell * 0.35))}px ${t.fonts.body}`;
    ctx.textAlign = "center";
    for (let i = 0; i < GRID_SIZE; i++) {
      ctx.fillText(String.fromCharCode(65 + i), ox + i * cell + cell / 2, oy - 14);
      ctx.fillText(String(i + 1), ox - 12, oy + i * cell + cell / 2 + 4);
    }

    // Turn indicator arrow
    if (this.phase === "play" && !this.agentThinking) {
      const isPlayerTurn = this.currentTurn === "player" || this.currentTurn === "player1";
      if ((which === "opponent" && isPlayerTurn) || (which === "player" && !isPlayerTurn && this.mode === "hotseat")) {
        ctx.fillStyle = t.accent;
        ctx.font = `${Math.max(16, Math.floor(cell * 0.8))}px ${t.fonts.body}`;
        ctx.textAlign = which === "player" ? "right" : "left";
        const arrowX = which === "player" ? ox - 20 : ox + GRID_SIZE * cell + 20;
        const arrowY = oy + GRID_SIZE * cell / 2 + 6;
        ctx.fillText(isPlayerTurn ? "►" : "◄", arrowX, arrowY);
      }
    }

    // Flash effects
    for (const f of this.flashCells) {
      const boards: ("player" | "opponent" | "player1" | "player2")[] = [];
      if (f.board === "player") boards.push("player");
      else if (f.board === "opponent") boards.push("opponent");
      else if (f.board === "player1") boards.push(this.mode === "hotseat" && this.currentTurn === "player2" ? "player" : "opponent");
      else if (f.board === "player2") boards.push(this.mode === "hotseat" && this.currentTurn === "player1" ? "player" : "opponent");

      if (boards.includes(which)) {
        const cx = ox + f.x * cell;
        const cy = oy + f.y * cell;
        const maxTimer = f.type === "sink" ? 800 : f.type === "hit" ? 300 : 250;
        const alpha = Math.max(0, f.timer / maxTimer);
        if (f.type === "hit") {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
          ctx.fillRect(cx + 2, cy + 2, cell - 4, cell - 4);
          ctx.strokeStyle = `${t.hitGlow}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx + 4, cy + 4);
          ctx.lineTo(cx + cell - 4, cy + cell - 4);
          ctx.moveTo(cx + cell - 4, cy + 4);
          ctx.lineTo(cx + 4, cy + cell - 4);
          ctx.stroke();
        } else if (f.type === "miss") {
          ctx.fillStyle = `${t.textPrimary}${Math.floor(alpha * 100).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(cx + cell / 2, cy + cell / 2, cell * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else if (f.type === "sink") {
          const pulse = 1 - f.timer / 800;
          ctx.strokeStyle = `${t.sunkGlow}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx + cell / 2, cy + cell / 2, cell * 0.5 * (1 + pulse * 0.5), 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = `${t.sunkGlow}${Math.floor(alpha * 50).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(cx + cell / 2, cy + cell / 2, cell * 0.5 * (1 + pulse * 0.5), 0, Math.PI * 2);
          ctx.fill();
          // Sunk ship label
          if (f.timer < 400) {
            ctx.fillStyle = `${t.sunkGlow}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
            ctx.font = `${Math.max(10, Math.floor(cell * 0.45))}px ${t.fonts.body}`;
            ctx.textAlign = "center";
            ctx.fillText("SUNK", cx + cell / 2, cy + cell / 2 + 4);
          }
        }
      }
    }

    ctx.textAlign = "left";
    ctx.restore(); // Restore screen shake transform

    // Draw particles on top (not affected by screen shake)
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Input handlers
  pointerDown(nx: number, ny: number, w: number, h: number) {
    const headerH = 56;
    const footerH = 48;
    const availH = h - headerH - footerH;
    const boardSize = Math.min(w * 0.44, availH * 0.9);
    const cell = boardSize / GRID_SIZE;
    const gap = Math.max(20, w * 0.035);
    const startX = (w - boardSize * 2 - gap) / 2;
    const startY = headerH + (availH - boardSize) / 2;

    // Check own board (placement)
    const ownX = Math.floor((nx - startX) / cell);
    const ownY = Math.floor((ny - startY) / cell);
    if (ownX >= 0 && ownX < GRID_SIZE && ownY >= 0 && ownY < GRID_SIZE) {
      if (this.phase === "setup") {
        if (this.canPlaceAt(ownX, ownY)) this.placeCurrentShip(ownX, ownY);
      }
      return;
    }

    // Check opponent board (firing)
    const oppX = Math.floor((nx - (startX + boardSize + gap)) / cell);
    const oppY = Math.floor((ny - startY) / cell);
    if (oppX >= 0 && oppX < GRID_SIZE && oppY >= 0 && oppY < GRID_SIZE) {
      if (this.phase === "play") {
        if (this.mode === "agent" && this.currentTurn === "player") {
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
    if (this.phase !== "setup") { this.hoverCell = null; return; }
    const headerH = 56;
    const footerH = 48;
    const availH = h - headerH - footerH;
    const boardSize = Math.min(w * 0.44, availH * 0.9);
    const cell = boardSize / GRID_SIZE;
    const startX = (w - boardSize * 2 - Math.max(20, w * 0.035)) / 2;
    const startY = headerH + (availH - boardSize) / 2;
    const x = Math.floor((nx - startX) / cell);
    const y = Math.floor((ny - startY) / cell);
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      this.hoverCell = [x, y];
    } else {
      this.hoverCell = null;
    }
  }

  keyDown(key: string) {
    const upper = key.toUpperCase();
    if (upper === "R") {
      if (this.phase === "setup") this.horizontal = !this.horizontal;
    }
    if (upper === "A") {
      if (this.phase === "setup") this.randomizeCurrentBoard();
    }
    if (upper === "E") {
      if (this.phase === "play" && (this.currentTurn === "player" || this.currentTurn === "player1")) {
        // Use ability - prompt for which ship type (1-5)
        this.setMessage("PRESS 1-5 FOR ABILITY: 1=CV 2=BB 3=CA 4=SS 5=DD", 3000);
        this.awaitingAbility = true;
      }
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
    // Handle ability number keys
    if (this.awaitingAbility && this.phase === "play") {
      const num = parseInt(upper);
      if (num >= 1 && num <= 5) {
        const types: ShipType[] = ["carrier", "battleship", "cruiser", "submarine", "destroyer"];
        const type = types[num - 1];
        if (this.canUseAbility(type)) {
          this.useAbility(type);
          this.awaitingAbility = false;
        } else {
          this.setMessage(`${SHIP_SPECS[type].short} ABILITY NOT READY`, 1500);
        }
      }
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