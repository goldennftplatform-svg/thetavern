/**
 * Module-level settlement test for MINE THE BLOCK (run: npx tsx scripts/mine-test.mjs)
 */
import {
  seedMineNodes,
  drill,
  settleMine,
  newMineStats,
  DEFAULT_MINE_CONFIG,
  resetStreak,
  touchStreak,
  poolBalance,
  seedCommunityPool,
} from "../src/minigames/mine.js";

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("❌ FAIL:", msg); failed++; }
  else console.log("✅", msg);
}

// 1. Node seeding
const shipCells = new Set(["3,3", "3,4", "3,5", "7,7", "7,8"]);
const nodes = seedMineNodes((x, y) => shipCells.has(`${x},${y}`), DEFAULT_MINE_CONFIG);
assert(nodes.size === DEFAULT_MINE_CONFIG.oreNodeCount + DEFAULT_MINE_CONFIG.payNodeCount,
  `seeds ${nodes.size} nodes`);
assert(![...nodes.values()].some((n) => shipCells.has(`${n.x},${n.y}`)), "no node on a ship cell");

// 2. Drill budget + pool feeding
seedCommunityPool(0);
const stats = newMineStats(DEFAULT_MINE_CONFIG);
const nodeList = [...nodes.values()];
let ore = 0, pay = 0, block = 0;
for (let s = 0; s < 10; s++) {
  let node;
  if (s === 1) node = nodeList.find((n) => n.kind === "ore");
  else if (s === 4) node = nodeList.find((n) => n.kind === "pay");
  else if (s === 7) node = nodeList.find((n) => n.kind === "ore");
  const res = drill(stats, node, s === 7 ? "sinkAtNode" : "none", DEFAULT_MINE_CONFIG);
  if (res.drill === "ore") ore++;
  if (res.drill === "pay") pay++;
  if (res.drill === "block") block++;
}
assert(stats.scansUsed === 10 && stats.scansLeft === DEFAULT_MINE_CONFIG.scanBudget - 10, "10 scans consumed, budget decremented");
// s=1 is ore, s=4 is pay, s=7 is a ship-sink (block), so ore=1, pay=1, block=1
assert(ore === 1, "1 loose ore (s=1)");
assert(pay === 1, "1 pay day (s=4)");
assert(block === 1, "1 block (s=7 ship sunk on an ore cell -> block)");
assert(stats.poolContributed === 10, "10 energy fed the shared community pool");
assert(poolBalance() >= 0, "pool never goes negative");

// 3. Settlement: does not overdraw; payout attached to stats
const poolBefore = poolBalance();
const settlement = settleMine(stats, DEFAULT_MINE_CONFIG);
assert(settlement.payout >= 0, "payout non-negative");
assert(settlement.payout <= poolBefore, "payout does not overdraw the pool");
assert(settlement.poolAfter <= poolBefore, "pool after <= pool before");
assert(stats.payout === settlement.payout, "stats.payout matches settlement");
assert(settlement.poolAfter === poolBalance(), "poolAfter reflects the live pool");
console.log(`   [settle] pool ${poolBefore} -> payout ${settlement.payout}, after ${settlement.poolAfter}`);

// 4. Flywheel: streak compounds, idle decays
resetStreak(1000);
const firstMultiplier = { ...touchStreak(2000) }; // snapshot (touchStreak returns shared ref)
const secondMultiplier = { ...touchStreak(3000) };
assert(secondMultiplier.multiplier > firstMultiplier.multiplier, `streak compounds (${firstMultiplier.multiplier} -> ${secondMultiplier.multiplier})`);
assert(secondMultiplier.session === 2, "two active sessions in a row keep the streak alive");
const thirdMultiplier = { ...touchStreak(3000 + 60 * 60 * 1000) }; // 1h idle
assert(thirdMultiplier.session === 0, "long idle collapses the streak (session reset)");
assert(thirdMultiplier.multiplier < secondMultiplier.multiplier, "long idle lowers the multiplier");

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
