#!/usr/bin/env node
/**
 * Launch NVIDIA ARDY interactive demo from the local clone + .venv-ardy.
 * Open http://localhost:2333 after startup.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const winPy = join(root, ".venv-ardy", "Scripts", "python.exe");
const nixPy = join(root, ".venv-ardy", "bin", "python");
const py = existsSync(winPy) ? winPy : existsSync(nixPy) ? nixPy : null;
const ardyRoot = join(root, "third_party", "ardy");
const demo = join(ardyRoot, "scripts", "run_demo.py");

if (!py) {
  console.error("[ardy:demo] Missing .venv-ardy — run scripts/install-ardy.ps1 first.");
  process.exit(1);
}
if (!existsSync(demo)) {
  console.error(`[ardy:demo] Missing ${demo} — clone nv-tlabs/ardy into third_party/ardy.`);
  process.exit(1);
}

console.log("[ardy:demo] starting", demo);
console.log("[ardy:demo] UI → http://localhost:2333");
const child = spawn(py, [demo], { cwd: ardyRoot, stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
