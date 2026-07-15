#!/usr/bin/env node
/**
 * Prefer the local ARDY CUDA venv (.venv-ardy), else fall back to system python.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const winPy = join(root, ".venv-ardy", "Scripts", "python.exe");
const nixPy = join(root, ".venv-ardy", "bin", "python");
const py = existsSync(winPy) ? winPy : existsSync(nixPy) ? nixPy : "python";
const script = join(root, "scripts", "ardy_bake_clips.py");

const r = spawnSync(py, [script, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
  shell: false,
});
process.exit(r.status ?? 1);
