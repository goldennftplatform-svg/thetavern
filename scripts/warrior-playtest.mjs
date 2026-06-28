/**
 * Full Demplar Warrior playtest — all trials + result overlay.
 * Run: node scripts/warrior-playtest.mjs [baseUrl]
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const baseArg = process.argv[2] ?? "http://127.0.0.1:5174";
let devProc = null;

async function resolveAppUrl(root) {
  for (const path of ["", "/thetavern/"]) {
    const url = `${root.replace(/\/$/, "")}${path}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const html = await res.text();
      if (html.includes("btn-skip-gate")) return url;
    } catch {
      /* try next */
    }
  }
  return root;
}

async function ensureServer(root) {
  try {
    const url = await resolveAppUrl(root);
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) return url;
  } catch {
    /* start vite */
  }
  devProc = spawn("npm", ["run", "dev", "--", "--host", "--port", "5174"], {
    shell: true,
    stdio: "ignore",
  });
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const url = await resolveAppUrl(root);
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return url;
    } catch {
      /* retry */
    }
  }
  throw new Error(`Dev server not reachable at ${root}`);
}

async function run() {
  const baseUrl = await ensureServer(baseArg);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.click("#btn-skip-gate");
  await page.waitForSelector("[data-hub-action='demplar_warrior']", { timeout: 15000 });
  await page.click("[data-hub-action='demplar_warrior']");
  await page.waitForSelector("#play-shell[data-phase='demplar_warrior']", { timeout: 8000 });

  // Brief → platform
  await page.waitForSelector("#play-shell[data-warrior-stage='platform']", { timeout: 25000 });

  // Platform: auto-jump while running
  const jumpLoop = setInterval(async () => {
    try {
      await page.keyboard.press("Space");
    } catch {
      /* page closed */
    }
  }, 280);

  await page.waitForSelector("#play-shell[data-warrior-stage='tetris']", { timeout: 55000 });
  clearInterval(jumpLoop);

  // Tetris: light control smoke (avoid finishing trial during test)
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");
  await page.keyboard.down("ArrowDown");
  await sleep(60);
  await page.keyboard.up("ArrowDown");

  const tetrisState = await page.evaluate(() => {
    const d = window.__tavernQA?.getDemplar?.();
    if (!d) return null;
    return {
      stage: d.stage,
      lines: d.tetris.lines,
      score: d.tetris.score,
      gameOver: d.tetris.gameOver,
    };
  });
  if (!tetrisState) throw new Error("QA hook missing");
  if (tetrisState.stage !== "tetris") throw new Error(`Expected tetris, got ${tetrisState.stage}`);

  const slamPace = await page.evaluate(() => {
    const t = window.__tavernQA?.getDemplar?.()?.tetris;
    if (!t) return null;
    t.hardDrop();
    const y0 = t.active?.y ?? -99;
    t.update(90, 1000, 75_000);
    const y1 = t.active?.y ?? -99;
    return { y0, y1, moved: y1 > y0 };
  });
  if (!slamPace?.moved) {
    throw new Error(`Tetris slam spawn too slow — piece y ${slamPace?.y0} → ${slamPace?.y1} after 90ms`);
  }

  // Fast-forward tetris — must show Trial III handoff first
  await page.evaluate(() => {
    const d = window.__tavernQA?.getDemplar?.();
    if (!d) throw new Error("no demplar");
    d.advanceStage(performance.now(), "drmario");
  });
  await page.waitForSelector("#play-shell[data-warrior-stage='drmario']", { timeout: 5000 });
  await sleep(400);
  const handoff = await page.evaluate(() => {
    const d = window.__tavernQA?.getDemplar?.();
    return d?.stageBreak?.subtitle ?? "";
  });
  if (!handoff.includes("DR MARIO")) {
    throw new Error(`Missing Trial III handoff overlay: ${handoff}`);
  }
  await sleep(2400);

  const noNegDr = await page.evaluate(() => {
    const dr = window.__tavernQA?.getDemplar?.()?.drMario;
    if (!dr) return false;
    dr.update(75_000, 75_000, 75_000);
    return dr.score >= 0;
  });
  if (!noNegDr) throw new Error("Dr Mario timeout still applies negative score");

  // Dr Mario: light control smoke
  await page.keyboard.press("KeyA");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.down("ArrowDown");
  await sleep(60);
  await page.keyboard.up("ArrowDown");

  const drState = await page.evaluate(() => {
    const d = window.__tavernQA?.getDemplar?.();
    return d ? { stage: d.stage, viruses: d.drMario.virusesLeft, score: d.drMario.score } : null;
  });
  if (!drState || drState.stage !== "drmario") {
    throw new Error(`Dr Mario stage broken: ${JSON.stringify(drState)}`);
  }

  // Finish run
  await page.evaluate(() => {
    const d = window.__tavernQA?.getDemplar?.();
    if (!d) throw new Error("no demplar");
    d.advanceStage(performance.now(), "done");
    d.done = true;
  });

  await page.waitForSelector("#play-shell[data-phase='demplar_result']", { timeout: 8000 });
  const resultVisible = await page.locator("[data-continue='well']").isVisible();
  if (!resultVisible) throw new Error("Warrior result overlay missing continue button");

  const resultText = await page.locator("#play-menu").innerText();
  if (!/Tetris|Dr Mario|SPRINT|total/i.test(resultText)) {
    throw new Error(`Result menu missing trial labels: ${resultText.slice(0, 200)}`);
  }

  // Mobile tap zones on tetris (re-enter warrior briefly via QA)
  await page.click("[data-continue='well']");
  await page.waitForSelector("[data-hub-action='demplar_warrior']", { timeout: 8000 });
  await page.click("[data-hub-action='demplar_warrior']");
  await page.waitForSelector("#play-shell[data-warrior-stage='platform']", { timeout: 25000 });

  await page.evaluate(() => {
    const d = window.__tavernQA?.getDemplar?.();
    d?.advanceStage(performance.now(), "tetris");
  });
  await page.waitForSelector("#play-shell[data-warrior-stage='tetris']", { timeout: 5000 });

  const canvas = page.locator("#well");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");

  await page.touchscreen.tap(box.x + box.width * 0.16, box.y + box.height * 0.5);
  await sleep(50);
  await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await sleep(50);
  await page.touchscreen.tap(box.x + box.width * 0.84, box.y + box.height * 0.5);
  await sleep(50);
  await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.82);
  await sleep(120);
  await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await sleep(40);
  await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);

  if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);

  console.log(
    `warrior-playtest: OK — tetris L${tetrisState.lines} score ${tetrisState.score}, dr ♥${drState.viruses}, result shown`,
  );
  await browser.close();
  if (devProc) devProc.kill();
}

run().catch((err) => {
  console.error("warrior-playtest: FAIL", err.message ?? err);
  if (devProc) devProc.kill();
  process.exit(1);
});
