/**
 * Render check for the Conflic result screen with a mine settlement.
 * run: npx tsx scripts/ui-check.mjs
 */
import { conflicResultStudioHtml } from "../src/ui/studioScreens.js";

const r = {
  winner: "player",
  playerHits: 12,
  playerMisses: 40,
  agentHits: 8,
  agentMisses: 30,
  turns: 55,
  mine: {
    stats: {
      scansUsed: 50, scansLeft: 0, oreFound: 3, payNodesHit: 1,
      blocksMined: 2, dust: 6, poolContributed: 50, payout: 38, floated: 2,
    },
    payout: 38,
    floated: 2,
    poolAfter: 62,
  },
};

const html = conflicResultStudioHtml(r, 220, 380, "agent");

const checks = [
  ["MINE THE BLOCK panel", html.includes("MINE THE BLOCK")],
  ["scans stat", /Scans/.test(html)],
  ["ore stat", /Ore/.test(html)],
  ["payday stat", /Paydays/.test(html)],
  ["blocks stat", /Blocks/.test(html)],
  ["payout 95% line", html.includes("+38 ◎ miner")],
  ["pool remaining", html.includes("62 ◎ remaining")],
  ["reward token total (380)", html.includes("+380 ◎")],
];
let fail = 0;
for (const [name, ok] of checks) {
  console.log(ok ? `✅ ${name}` : `❌ ${name}`);
  if (!ok) fail++;
}
console.log(fail === 0 ? "\nUI render OK" : `\n${fail} missing`);
process.exit(fail === 0 ? 0 : 1);
