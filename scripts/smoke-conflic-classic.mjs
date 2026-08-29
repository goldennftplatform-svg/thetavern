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
    const { conflicResultStudioHtml } = await import("/src/ui/studioScreens.ts");

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
      handoffPending: hitGame.handoffPending,
      abilityAllowed: hitGame.useAbility("destroyer"),
    };

    const player2BlockedBeforeHandoff = hitGame.playerFire(0, 0);
    const player2Acknowledged = hitGame.acknowledgeHandoff();
    const player2Accepted = hitGame.playerFire(0, 0);
    const player2Result = {
      blockedBeforeHandoff: player2BlockedBeforeHandoff,
      acknowledged: player2Acknowledged,
      accepted: player2Accepted,
      resolved: countResolved(hitGame.opponentTargetGrid),
      a1: hitGame.opponentTargetGrid[0][0],
      b3: hitGame.opponentTargetGrid[2][1],
      turn: hitGame.currentTurn,
      handoffPending: hitGame.handoffPending,
    };

    const setupGame = new ConflicBouy({ mode: "hotseat" });
    setupGame.randomizeCurrentBoard();
    const setupHandoff = {
      subPhase: setupGame.setupSubPhase,
      pending: setupGame.handoffPending,
      player1Ships: setupGame.player1Board.ships.length,
      visibleShips: setupGame.getOwnGrid().flat().filter((cell) => cell === CELL_STATES.ship).length,
    };
    const setupAcknowledged = setupGame.acknowledgeHandoff();
    setupGame.randomizeCurrentBoard();
    const setupComplete = {
      acknowledged: setupAcknowledged,
      phase: setupGame.phase,
      turn: setupGame.currentTurn,
      pending: setupGame.handoffPending,
      player1Ships: setupGame.player1Board.ships.length,
      player2Ships: setupGame.player2Board.ships.length,
    };
    const player2ResultHtml = conflicResultStudioHtml({
      winner: "player2",
      playerHits: 5,
      playerMisses: 3,
      agentHits: 0,
      agentMisses: 0,
      turns: 8,
    }, 0, 0, "hotseat");
    const resultLabel = {
      player2Wins: player2ResultHtml.includes("PLAYER 2 WINS"),
      showsDefeat: player2ResultHtml.includes("DEFEAT"),
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

    const player2WinGame = new ConflicBouy({ mode: "hotseat" });
    player2WinGame.phase = "play";
    player2WinGame.currentTurn = "player2";
    player2WinGame.player1Board = boardWithShip([false, true]);
    player2WinGame.player2Board = boardWithShip([false, false]);
    player2WinGame.playerTargetGrid = emptyGrid();
    player2WinGame.opponentTargetGrid = emptyGrid();
    player2WinGame.opponentTargetGrid[3][1] = CELL_STATES.hit;
    const player2WinAccepted = player2WinGame.playerFire(1, 2);
    const player2WinResult = {
      accepted: player2WinAccepted,
      phase: player2WinGame.phase,
      winner: player2WinGame.result.winner,
      sunkShips: player2WinGame.player1Board.ships.filter((ship) => ship.sunk).length,
      handoffPending: player2WinGame.handoffPending,
    };

    return { hitResult, player2Result, setupHandoff, setupComplete, resultLabel, sinkResult, player2WinResult };
  });

  await browser.close();
  if (devProc) devProc.kill();

  const { hitResult, player2Result, setupHandoff, setupComplete, resultLabel, sinkResult, player2WinResult } = result;
  if (!hitResult.accepted || hitResult.resolved !== 1 || hitResult.b3 !== 2 || hitResult.c4 !== 0) {
    throw new Error(`B3 regression failed: ${JSON.stringify(hitResult)}`);
  }
  if (hitResult.turn !== "player2" || !hitResult.handoffPending || hitResult.abilityAllowed) {
    throw new Error(`Classic turn/ability regression failed: ${JSON.stringify(hitResult)}`);
  }
  if (player2Result.blockedBeforeHandoff || !player2Result.acknowledged || !player2Result.accepted || player2Result.resolved !== 1 || player2Result.a1 !== 3 || player2Result.b3 !== 0 || player2Result.turn !== "player1" || !player2Result.handoffPending) {
    throw new Error(`Player 2 turn regression failed: ${JSON.stringify(player2Result)}`);
  }
  if (setupHandoff.subPhase !== "player2" || !setupHandoff.pending || setupHandoff.player1Ships !== 5 || setupHandoff.visibleShips !== 0) {
    throw new Error(`Player 2 deployment privacy failed: ${JSON.stringify(setupHandoff)}`);
  }
  if (!setupComplete.acknowledged || setupComplete.phase !== "play" || setupComplete.turn !== "player1" || !setupComplete.pending || setupComplete.player1Ships !== 5 || setupComplete.player2Ships !== 5) {
    throw new Error(`Hotseat setup completion failed: ${JSON.stringify(setupComplete)}`);
  }
  if (!resultLabel.player2Wins || resultLabel.showsDefeat) {
    throw new Error(`Hotseat result label failed: ${JSON.stringify(resultLabel)}`);
  }
  if (!sinkResult.accepted || sinkResult.resolved !== 2 || sinkResult.b3 !== 4 || sinkResult.b4 !== 2 || sinkResult.c4 !== 0 || sinkResult.sunkShips !== 1) {
    throw new Error(`Sink regression failed: ${JSON.stringify(sinkResult)}`);
  }
  if (!player2WinResult.accepted || player2WinResult.phase !== "over" || player2WinResult.winner !== "player2" || player2WinResult.sunkShips !== 1 || player2WinResult.handoffPending) {
    throw new Error(`Player 2 victory regression failed: ${JSON.stringify(player2WinResult)}`);
  }

  console.log("smoke-conflic-classic: OK — one shot per turn, both hotseat players, private handoffs");
}

run().catch((error) => {
  console.error("smoke-conflic-classic: FAIL", error.message ?? error);
  if (devProc) devProc.kill();
  process.exit(1);
});
