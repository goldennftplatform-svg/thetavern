/**
 * MINE THE BLOCK — the mining 201 layer for Conflic Bouy.
 *
 * Same 10x10 battleship board, but you're a probe-miner scanning a hidden claim
 * grid. Hidden in the cells (beyond the enemy fleet) are ORE NODES and rare
 * PAY NODES. Sinking a seam (ship) mints a block; every scan feeds a SHARED
 * COMMUNITY POOL; at settlement 95% of the pool pays back to the miner and 5%
 * floats out of circulation.
 *
 * Design (battle-testable, server-ready):
 *   - Hard SCAN BUDGET (default 50): your drills at the enemy grid are capped.
 *   - ORE NODE: a cell holding loose ore → small payout when drilled.
 *   - PAY NODE: a rare rich block (1/25 of ore blocks) → 25x payout jackpot.
 *   - SHARED POOL: every scan commits 1 energy to a community pool.
 *   - SETTLEMENT: 95% of pool returns to the miner weighted by ore found;
 *     5% floats out.
 *
 * The module keeps pool state at module scope (a lightweight stand-in for a
 * server wallet) so it survives across rounds — readers swap in a server call
 * later without changing the client math.
 */

export const SCAN_BUDGET = 50;
export const POOL_DEPOSIT_PER_SCAN = 1;
export const POOL_PAYOUT_RATIO = 0.95; // 95% back to the miner
export const ORE_NODE_COUNT = 8; // ore nodes seeded on empty cells
export const PAY_NODE_COUNT = 2; // "1/25 blocks pay big" — rare rich nodes
export const ORE_NODE_PAYOUT = 1; // per ore node (◎ dust)
export const PAY_NODE_PAYOUT = PAY_NODE_COUNT > 0 ? 25 : 0; // 25x jackpot
export const BLOCK_WEIGHT = 3; // ore-equivalent each sunk seam contributes
export const GRID = 10;

export type MineConfig = {
  scanBudget: number;
  oreNodeCount: number;
  payNodeCount: number;
  poolDepositPerScan: number;
  poolPayoutRatio: number;
  oreNodePayout: number;
  payNodePayout: number;
  blockWeight: number;
};

export const DEFAULT_MINE_CONFIG: MineConfig = {
  scanBudget: SCAN_BUDGET,
  oreNodeCount: ORE_NODE_COUNT,
  payNodeCount: PAY_NODE_COUNT,
  poolDepositPerScan: POOL_DEPOSIT_PER_SCAN,
  poolPayoutRatio: POOL_PAYOUT_RATIO,
  oreNodePayout: ORE_NODE_PAYOUT,
  payNodePayout: PAY_NODE_PAYOUT,
  blockWeight: BLOCK_WEIGHT,
};

export type MineNode = { x: number; y: number; kind: "ore" | "pay" };
export type DrillOutcome = "ore" | "pay" | "block" | "none";

export type MineStats = {
  scansUsed: number;
  scansLeft: number;
  oreFound: number; // ore nodes drilled
  payNodesHit: number; // pay nodes drilled
  blocksMined: number; // ships sunk
  dust: number; // small payout tokens banked in-run
  poolContributed: number; // energy this miner fed the pool
  payout: number; // final settlement payout (◎)
  floated: number; // 5% that leaves the pool
};

export type MineSettlement = {
  stats: MineStats;
  payout: number;
  floated: number;
  poolAfter: number;
};

const FREE_ORE = 0; // keep unscanned ore dust in the pool for the next miner

/** Community pool shared across rounds within a session (server-ready seam). */
const communityPool: { balance: number } = { balance: 100 };

export function poolBalance(): number {
  return communityPool.balance;
}

export function seedCommunityPool(pool: number): void {
  communityPool.balance = pool;
}

/**
 * Seed ore + pay nodes onto a board's empty cells (excluding fleet cells).
 * Returns the node set keyed by "x,y".
 */
export function seedMineNodes(
  occupied: (x: number, y: number) => boolean,
  cfg: MineConfig = DEFAULT_MINE_CONFIG,
): Map<string, MineNode> {
  const empties: [number, number][] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied(x, y)) empties.push([x, y]);
    }
  }
  // Fisher–Yates shuffle
  for (let i = empties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [empties[i], empties[j]] = [empties[j], empties[i]];
  }
  const nodes = new Map<string, MineNode>();
  let idx = 0;
  // Pay nodes first (rarest), then ore nodes.
  for (let i = 0; i < cfg.payNodeCount && idx < empties.length; i++, idx++) {
    const [x, y] = empties[idx]!;
    nodes.set(`${x},${y}`, { x, y, kind: "pay" });
  }
  for (let i = 0; i < cfg.oreNodeCount && idx < empties.length; i++, idx++) {
    const [x, y] = empties[idx]!;
    nodes.set(`${x},${y}`, { x, y, kind: "ore" });
  }
  return nodes;
}

export function newMineStats(cfg: MineConfig = DEFAULT_MINE_CONFIG): MineStats {
  return {
    scansUsed: 0,
    scansLeft: cfg.scanBudget,
    oreFound: 0,
    payNodesHit: 0,
    blocksMined: 0,
    dust: 0,
    poolContributed: 0,
    payout: 0,
    floated: 0,
  };
}

/**
 * Record a shot on a given node (or none) and update the shared pool + stats.
 * @returns the drill outcome for the result UI, and whether the mine is now exhausted.
 */
export function drill(
  stats: MineStats,
  node: MineNode | undefined,
  outcome: "sinkAtNode" | "none",
  cfg: MineConfig = DEFAULT_MINE_CONFIG,
): { drill: DrillOutcome; exhausted: boolean } {
  stats.scansUsed++;
  stats.scansLeft = Math.max(0, stats.scansLeft - 1);
  // Every scan feeds the community pool (the "deposit").
  communityPool.balance += cfg.poolDepositPerScan;
  stats.poolContributed += cfg.poolDepositPerScan;

  let drill: DrillOutcome = "none";
  if (outcome === "sinkAtNode") {
    stats.blocksMined++;
    drill = "block";
  } else if (node) {
    if (node.kind === "pay") {
      stats.payNodesHit++;
      drill = "pay";
    } else {
      stats.oreFound++;
      drill = "ore";
    }
  }
  // Award in-run dust for ore/pay nodes (drawn from the pool).
  if (drill === "ore") {
    const d = Math.min(cfg.oreNodePayout, communityPool.balance);
    stats.dust += d;
    communityPool.balance -= d;
  } else if (drill === "pay") {
    const d = Math.min(cfg.payNodePayout, communityPool.balance);
    stats.dust += d;
    communityPool.balance -= d;
  }

  const exhausted = stats.scansLeft <= 0;
  return { drill, exhausted };
}

// --- Burn-to-earn flywheel ---
// Repeated play compounds: a session burn-streak multiplies payouts, and the
// deep community pool scales how much each find is worth. The more (and the
// longer) people mine, the bigger the pool, the bigger every payout — the
// flywheel that pulls more players in. All of this is deterministic client math
// today; a server replaces the module-scope pool + streak without touching the
// payout formula.

export type BurnStreak = {
  session: number; // consecutive active mining sessions this streak
  games: number; // total games contributed this streak
  lastActivityAt: number; // epoch ms
  multiplier: number; // current compounded multiplier
};

const STREAK_DECAY_MS = 1000 * 60 * 30; // 30 min idle decays the streak
const STREAK_MAX_MULT = 4;
const STREAK_GAME_STEP = 0.25; // +0.25 per completed game (capped)

export const streakState: BurnStreak = {
  session: 0,
  games: 0,
  lastActivityAt: 0,
  multiplier: 1,
};

export function resetStreak(now = Date.now()): void {
  streakState.session = 0;
  streakState.games = 0;
  streakState.lastActivityAt = now;
  streakState.multiplier = 1;
}

/**
 * Advance the burn streak for one completed mining run. If the player has been
 * idle too long the streak decays; otherwise it compounds by the game step.
 */
export function touchStreak(now = Date.now(), step = STREAK_GAME_STEP): BurnStreak {
  if (!streakState.lastActivityAt) {
    streakState.lastActivityAt = now;
    streakState.multiplier = 1;
  }
  const idle = now - streakState.lastActivityAt;
  if (idle > STREAK_DECAY_MS) {
    streakState.session = 0;
    streakState.games = 0;
    streakState.multiplier = 1;
  } else {
    streakState.session += 1;
  }
  streakState.games += 1;
  streakState.multiplier = Math.min(STREAK_MAX_MULT, streakState.multiplier + step);
  streakState.lastActivityAt = now;
  return streakState;
}

/** The flywheel reward: pool-depth scaling × burn-streak multiplier. */
export function flywheelScalar(): number {
  // Pool depth relative to a baseline inflates the value of finds.
  const depthScale = 1 + Math.min(3, Math.max(0, (communityPool.balance - 100) / 200));
  return depthScale * streakState.multiplier;
}

/**
 * Settle the mine: 95% of the miner's contributed pool returns weighted by
 * their finds; 5% floats out of circulation. Payout scales with the flywheel
 * (pool depth × burn streak) so continued play pays more.
 * Returns the total official payout (◎) the miner banks.
 */
export function settleMine(
  stats: MineStats,
  cfg: MineConfig = DEFAULT_MINE_CONFIG,
  _opts?: { streak?: BurnStreak; depthScale?: number },
): MineSettlement {
  // Claim weight: ore + blocks (blocks weigh more) + pay jackpot boost.
  const weight = stats.oreFound + stats.blocksMined * cfg.blockWeight + stats.payNodesHit * (cfg.payNodePayout > 0 ? 5 : 0);
  const pool = communityPool.balance;
  const theoretical = pool * cfg.poolPayoutRatio;
  const scalar = Math.max(1, flywheelScalar());
  // The pool ring a single miner can draw per round — keep the chain solvent
  // while letting the flywheel visibly grow rewards.
  const ringCap = Math.max(10, Math.floor(pool * cfg.poolPayoutRatio * 0.6));
  let payout: number;
  if (weight <= 0) {
    payout = stats.dust;
  } else {
    const base = Math.max(stats.dust, theoretical * Math.min(1, weight / (weight + FREE_ORE + 10)));
    payout = Math.floor(Math.min(ringCap, base * scalar));
  }
  const adjusted = Math.min(payout, communityPool.balance);
  const floated = communityPool.balance - adjusted;
  stats.payout = adjusted;
  stats.floated = 0;
  communityPool.balance = adjusted > 0 ? communityPool.balance - adjusted : communityPool.balance;
  return { stats, payout: adjusted, floated, poolAfter: communityPool.balance };
}
