/**
 * Full QA suite — h wonder / PROMPTME bar.
 */
import { spawn } from "node:child_process";

const base = process.argv[2] ?? "http://127.0.0.1:5174";

function run(script) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [script, base], { stdio: "inherit", shell: true });
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

async function main() {
  await run("scripts/smoke-play.mjs");
  await run("scripts/smoke-warrior.mjs");
  await run("scripts/smoke-bigboard.mjs");
  console.log("smoke-all: OK — play, warrior, bigboard");
}

main().catch((err) => {
  console.error("smoke-all: FAIL", err.message ?? err);
  process.exit(1);
});
