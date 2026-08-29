import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const root = "http://127.0.0.1:5174";
let devProc = null;

async function ensureServer() {
  try {
    const response = await fetch(root, { signal: AbortSignal.timeout(2000) });
    if (response.ok) return;
  } catch {
    // Start Vite below.
  }

  devProc = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
    shell: true,
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(500);
    try {
      const response = await fetch(root, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      // Retry while Vite starts.
    }
  }
  throw new Error("Vite did not start on port 5174");
}

async function run() {
  await ensureServer();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(root, { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const { ConflicBouy, CELL_STATES } = await import("/src/minigames/conflicBouy.ts");

    const emptyGrid = () => Array.from({ length: 10 }, () => Array(10).fill(CELL_STATES.empty));
    const boardWithShip = (hits) => {
      const grid = emptyGrid();
      const ship = {
        type: "destroyer",
        cells: [[1, 2], [1, 3]],
        hits: [...hits],
        sunk: false,
        abilityUsed: -1,
        abilityActive: false,
        evasionCharges: 0,
      };
      const shipMap = new Map();
      for (const [x, y] of ship.cells) {
        grid[y][x] = CELL_STATES.ship;
        shipMap.set(`${x},${y}`, ship);
      }
      return { grid, ships: [ship], shipMap };
    };

    const countResolved = (grid) => grid.flat().filter((cell) => cell !== CELL_STATES.empty).length;

    const hitGame = new ConflicBouy({ mode: "hotseat" });
    hitGame.phase = "play";
    hitGame.currentTurn = "player1";
    hitGame.player1Board = boardWithShip([false, false]);
    hitGame.player2Board = boardWithShip([false, false]);
    hitGame.playerTargetGrid = emptyGrid();
    hitGame.opponentTargetGrid = emptyGrid();
    const hitAccepted = hitGame.playerFire(1, 2);

    const hitResult = {
      accepted: hitAccepted,
      resolved: countResolved(hitGame.playerTargetGrid),
      b3: hitGame.playerTargetGrid[2][1],
      c4: hitGame.playerTargetGrid[3][2],
      turn: hitGame.currentTurn,
      abilityAllowed: hitGame.useAbility("destroyer"),
    };

    const sinkGame = new ConflicBouy({ mode: "hotseat" });
    sinkGame.phase = "play";
    sinkGame.currentTurn = "player1";
    sinkGame.player1Board = boardWithShip([false, false]);
    sinkGame.player2Board = boardWithShip([false, true]);
    sinkGame.playerTargetGrid = emptyGrid();
    sinkGame.playerTargetGrid[3][1] = CELL_STATES.hit;
    sinkGame.opponentTargetGrid = emptyGrid();
    const sinkAccepted = sinkGame.playerFire(1, 2);

    const sinkResult = {
      accepted: sinkAccepted,
      resolved: countResolved(sinkGame.playerTargetGrid),
      b3: sinkGame.playerTargetGrid[2][1],
      b4: sinkGame.playerTargetGrid[3][1],
      c4: sinkGame.playerTargetGrid[3][2],
      sunkShips: sinkGame.player2Board.ships.filter((ship) => ship.sunk).length,
    };

    return { hitResult, sinkResult };
  });

  await browser.close();
  if (devProc) devProc.kill();

  const { hitResult, sinkResult } = result;
  if (!hitResult.accepted || hitResult.resolved !== 1 || hitResult.b3 !== 2 || hitResult.c4 !== 0) {
    throw new Error(`B3 regression failed: ${JSON.stringify(hitResult)}`);
  }
  if (hitResult.turn !== "player2" || hitResult.abilityAllowed) {
    throw new Error(`Classic turn/ability regression failed: ${JSON.stringify(hitResult)}`);
  }
  if (!sinkResult.accepted || sinkResult.resolved !== 2 || sinkResult.b3 !== 4 || sinkResult.b4 !== 2 || sinkResult.c4 !== 0 || sinkResult.sunkShips !== 1) {
    throw new Error(`Sink regression failed: ${JSON.stringify(sinkResult)}`);
  }

  console.log("smoke-conflic-classic: OK — one shot, one cell, one turn");
}

run().catch((error) => {
  console.error("smoke-conflic-classic: FAIL", error.message ?? error);
  if (devProc) devProc.kill();
  process.exit(1);
});
