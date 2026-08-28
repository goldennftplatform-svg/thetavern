/**
 * Conflic Bouy debug — check canvas, grid layout, play 1 game.
 * Run: node scripts/smoke-conflic-debug.mjs
 */
import { setTimeout as sleep } from "node:timers/promises";

const baseArg = process.argv[2] ?? "http://127.0.0.1:5174";

async function resolveAppUrl(root) {
  for (const path of ["", "/thetavern/"]) {
    const url = `${root.replace(/\/$/, "")}${path}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const html = await res.text();
      if (html.includes("btn-skip-gate")) return url;
    } catch {}
  }
  return root;
}

async function run() {
  const baseUrl = await resolveAppUrl(baseArg);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.click("#btn-skip-gate");
  await page.waitForSelector("[data-hub-action='conflic_bouy']", { timeout: 15000 });
  console.log("Hub loaded");

  // Click the seat
  await page.click("[data-hub-action='conflic_bouy']");
  await sleep(1000);

  // Check what phase we're in
  const phase = await page.evaluate(() => {
    return document.querySelector("#play-shell")?.getAttribute("data-phase") ?? "unknown";
  });
  console.log("Phase after seat click:", phase);

  // If we're in theme picker, go through the flow
  if (phase === "conflic_theme") {
    console.log("In theme picker, selecting agent...");
    const modeBtn = await page.locator("[data-hub-action='conflic_mode:agent']");
    if (await modeBtn.count() > 0) {
      await modeBtn.click();
      await sleep(300);
      const themeBtn = await page.locator("[data-hub-action='conflic_theme:charter']");
      if (await themeBtn.count() > 0) {
        await themeBtn.click();
        await sleep(300);
      }
      const stakeBtn = await page.locator("[data-hub-action='conflic_stake:0']");
      if (await stakeBtn.count() > 0) {
        await stakeBtn.click();
        await sleep(500);
      }
    }
  }

  // Wait for game canvas
  await page.waitForFunction(() => {
    const c = document.querySelector("#well");
    return c && c.width > 0;
  }, { timeout: 5000 });
  await sleep(500);

  // Debug: canvas info
  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector("#well");
    if (!c) return { error: "no canvas" };
    const r = c.getBoundingClientRect();
    const phase = document.querySelector("#play-shell")?.getAttribute("data-phase") ?? "unknown";
    return {
      canvasW: c.width, canvasH: c.height,
      cssW: r.width, cssH: r.height,
      cssLeft: r.left, cssTop: r.top,
      phase,
    };
  });
  console.log("Canvas info:", JSON.stringify(canvasInfo, null, 2));

  // Try auto-deploy
  console.log("Pressing 'a' for auto-deploy...");
  await page.keyboard.press("a");
  await sleep(1000);

  // Check phase after deploy
  const phaseAfterDeploy = await page.evaluate(() => {
    return document.querySelector("#play-shell")?.getAttribute("data-phase") ?? "unknown";
  });
  console.log("Phase after deploy:", phaseAfterDeploy);

  // Debug: grid layout calculation
  const gridInfo = await page.evaluate(() => {
    const c = document.querySelector("#well");
    if (!c) return null;
    const w = c.width, h = c.height;
    const headerH = 72, footerH = 48;
    const availH = h - headerH - footerH;
    const boardSize = Math.min(w * 0.44, availH * 0.9);
    const cell = boardSize / 10;
    const gap = Math.max(20, w * 0.035);
    const startX = (w - boardSize * 2 - gap) / 2;
    const startY = headerH + (availH - boardSize) / 2;
    const oppX = startX + boardSize + gap;
    const rect = c.getBoundingClientRect();
    return {
      boardSize: Math.round(boardSize),
      cell: Math.round(cell * 10) / 10,
      gap: Math.round(gap),
      startX: Math.round(startX),
      startY: Math.round(startY),
      oppX: Math.round(oppX),
      rectLeft: Math.round(rect.left),
      rectTop: Math.round(rect.top),
      scaleX: Math.round(rect.width / w * 100) / 100,
      scaleY: Math.round(rect.height / h * 100) / 100,
    };
  });
  console.log("Grid layout:", JSON.stringify(gridInfo, null, 2));

  // Try clicking cell 0,0 on opponent board
  console.log("Clicking cell A1 on opponent grid...");
  const info = gridInfo;
  if (info) {
    const cx = info.rectLeft + (info.oppX + 0 * info.cell + info.cell / 2) * info.scaleX;
    const cy = info.rectTop + (info.startY + 0 * info.cell + info.cell / 2) * info.scaleY;
    console.log(`  Screen coords: (${Math.round(cx)}, ${Math.round(cy)})`);
    await page.mouse.click(cx, cy);
    await sleep(800);
  }

  // Fire a few more cells and check if anything changed
  for (let i = 1; i < 5; i++) {
    if (info) {
      const cx = info.rectLeft + (info.oppX + i * info.cell + info.cell / 2) * info.scaleX;
      const cy = info.rectTop + (info.startY + i * info.cell + info.cell / 2) * info.scaleY;
      await page.mouse.click(cx, cy);
      await sleep(500);
    }
  }

  // Check phase after firing
  const phaseAfterFire = await page.evaluate(() => {
    return document.querySelector("#play-shell")?.getAttribute("data-phase") ?? "unknown";
  });
  console.log("Phase after firing:", phaseAfterFire);

  if (errors.length) {
    console.log("\nPage errors:", errors.join("\n  "));
  }

  await browser.close();
  console.log("Done");
}

run().catch((err) => {
  console.error("FAIL:", err.message ?? err);
  process.exit(1);
});
