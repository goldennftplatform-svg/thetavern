/**
 * Conflic Bouy playtest — 3 full games with screenshots.
 * Run: node scripts/smoke-conflic.mjs [baseUrl]
 */
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync, mkdirSync } from "node:fs";

const baseArg = process.argv[2] ?? "http://127.0.0.1:5174";
const DIR = "test-screenshots";

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

async function shot(page, name) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

async function getGridMetrics(page) {
  return page.evaluate(() => {
    const c = document.querySelector("#well");
    if (!c) return null;
    const w = c.width, h = c.height;
    const rect = c.getBoundingClientRect();
    const headerH = 72, footerH = 48;
    const availH = h - headerH - footerH;
    const boardSize = Math.min(w * 0.44, availH * 0.9);
    const cell = boardSize / 10;
    const gap = Math.max(20, w * 0.035);
    const startX = (w - boardSize * 2 - gap) / 2;
    const startY = headerH + (availH - boardSize) / 2;
    const oppX = startX + boardSize + gap;
    return {
      cell, startX, startY, oppX,
      rectLeft: rect.left, rectTop: rect.top,
      scaleX: rect.width / w, scaleY: rect.height / h,
    };
  });
}

function cellScreen(m, gx, gy) {
  const cx = m.rectLeft + (m.oppX + gx * m.cell + m.cell / 2) * m.scaleX;
  const cy = m.rectTop + (m.startY + gy * m.cell + m.cell / 2) * m.scaleY;
  return { cx, cy };
}

async function isGameOver(page) {
  return page.evaluate(() =>
    document.querySelector("#play-shell")?.getAttribute("data-phase") === "conflic_bouy_result"
  );
}

async function playGame(page, num, themeName) {
  console.log(`\n🎮 Game ${num}: ${themeName}`);

  await page.click("[data-hub-action='conflic_bouy']");
  await sleep(600);

  const phase = await page.evaluate(() =>
    document.querySelector("#play-shell")?.getAttribute("data-phase")
  );

  if (phase === "conflic_theme") {
    console.log("  Selecting agent mode...");
    const modeBtn = page.locator("[data-hub-action='conflic_mode:agent']");
    if (await modeBtn.count() > 0) { await modeBtn.click(); await sleep(400); }
    const themeBtn = page.locator(`[data-hub-action="conflic_theme:${themeName}"]`);
    if (await themeBtn.count() > 0) { await themeBtn.click(); await sleep(400); }
    const stakeBtn = page.locator("[data-hub-action='conflic_stake:0']");
    if (await stakeBtn.count() > 0) { await stakeBtn.click(); await sleep(500); }
  }

  await page.waitForFunction(() => {
    const c = document.querySelector("#well");
    return c && c.width > 0;
  }, { timeout: 5000 });
  await sleep(400);

  await page.keyboard.press("a");
  await sleep(1500);
  await shot(page, `g${num}-01-deployed`);

  const m = await getGridMetrics(page);
  if (!m) {
    console.log("  ❌ No grid metrics!");
    return { theme: themeName, turns: 0, gameOver: false, error: "no grid" };
  }

  // Fire all 100 cells sequentially, wait 400ms between shots
  // Shots during agent turn are rejected (no harm) — we'll still cover all cells
  let turns = 0;
  let gameOver = false;

  for (let y = 0; y < 10 && !gameOver; y++) {
    for (let x = 0; x < 10 && !gameOver; x++) {
      const { cx, cy } = cellScreen(m, x, y);
      await page.mouse.click(cx, cy);
      turns++;
      await sleep(400);

      gameOver = await isGameOver(page);
    }
  }

  // Extra wait for game-over phase transition
  for (let i = 0; i < 8 && !gameOver; i++) {
    await sleep(400);
    gameOver = await isGameOver(page);
  }

  await shot(page, `g${num}-02-end`);
  console.log(`  ✅ Done: ${turns} shots, game over: ${gameOver}`);

  // Return to hub
  await page.keyboard.press("Escape");
  await sleep(1500);
  await page.waitForSelector("[data-hub-action='conflic_bouy']", { timeout: 5000 }).catch(() => {});
  await sleep(500);

  return { theme: themeName, turns, gameOver };
}

async function run() {
  const baseUrl = await resolveAppUrl(baseArg);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.click("#btn-skip-gate");
  await page.waitForSelector("[data-hub-action='conflic_bouy']", { timeout: 15000 });
  console.log("✅ Hub loaded");
  await shot(page, "g0-hub");

  const themes = ["charter", "odyssey", "abyssal"];
  const results = [];

  for (let i = 0; i < 3; i++) {
    try {
      const r = await playGame(page, i + 1, themes[i]);
      results.push(r);
    } catch (err) {
      console.error(`  ❌ Game ${i + 1}: ${err.message}`);
      await shot(page, `g${i + 1}-error`);
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(1000);
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.click("#btn-skip-gate").catch(() => {});
      await page.waitForSelector("[data-hub-action='conflic_bouy']", { timeout: 10000 }).catch(() => {});
      await sleep(500);
      results.push({ theme: themes[i], turns: 0, gameOver: false, error: err.message });
    }
  }

  if (pageErrors.length) {
    console.log("\n⚠️  Page errors:");
    pageErrors.forEach(e => console.log(`  ${e.substring(0, 300)}`));
  } else {
    console.log("\n✅ No page errors");
  }

  console.log("\n📊 Results:");
  for (const r of results) {
    console.log(`  ${r.theme}: ${r.turns} shots, completed: ${r.gameOver}${r.error ? ` ERROR: ${r.error}` : ""}`);
  }

  await browser.close();
}

run().catch((err) => {
  console.error("FAIL:", err.message ?? err);
  process.exit(1);
});
