/**
 * Run Blender background job to stamp pole sprites into public/media/poles.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "blender_build_poles.py");
const blender =
  process.env.BLENDER_BIN ||
  "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe";

const child = spawn(blender, ["--background", "--python", script], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
