/**
 * Conflic Bouy — detailed debug of 1 game with console state tracking.
 * Run: node scripts/smoke-conflic-debug2.mjs
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

// Expose game state to window for reading
async function exposeGameState(page) {
  await page.evaluate(() => {
    // @ts-ignore
    window.__conflicGame = () => {
      // Access via the module's conflicGame variable - we need to hook it
      const canvas = document.querySelector("#well");
      return canvas?.__conflicGame || null;
    };
  });
}

// Read game state by evaluating code in page context
async function getGameState(page) {
  return page.evaluate(() => {
    // Try to find the game object via globalThis or window
    // The game is in a module, so we need to read state from canvas rendering
    // Instead, check the DOM for visual cues
    const phase = document.querySelector("#play-shell")?.getAttribute("data-phase");
    
    // Check if result screen buttons exist (game over)
    const hasResult = !!document.querySelector("[data-hub-action='conflic_bouy']");
    const hasPlayAgain = !!document.querySelector("[data-hub-action='conflic_bouy']");
    const hasChangeMode = !!document.querySelector("[data-hub-action='conflic_bouy_change']");
    
    return { phase, hasPlayAgain, hasChangeMode };
  });
}

async function run() {
  const baseUrl = await resolveAppUrl(baseArg);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  
  const consoleMsgs = [];
  page.on("console", (msg) => {
    const txt = msg.text();
    if (txt.includes("CONF") || txt.includes("conflic") || txt.includes("ERROR") || txt.includes("error")) {
      consoleMsgs.push(`[${msg.type()}] ${txt}`);
    }
  });
  
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.click("#btn-skip-gate");
  await page.waitForSelector("[data-hub-action='conflic_bouy']", { timeout: 15000 });
  console.log("Hub loaded");

  // Start game
  await page.click("[data-hub-action='conflic_bouy']");
  await sleep(600);

  // Auto-deploy
  await page.keyboard.press("a");
  await sleep(1500);
  await shot(page, "dbg-01-deployed");

  // Fire 10 shots and check state between each
  const m = await getGridMetrics(page);
  if (!m) { console.log("No grid!"); await browser.close(); return; }

  let gameOver = false;
  for (let i = 0; i < 15 && !gameOver; i++) {
    const gx = i % 10;
    const gy = Math.floor(i / 10);
    const { cx, cy } = cellScreen(m, gx, gy);
    
    console.log(`Shot ${i+1}: (${gx},${gy}) at screen (${Math.round(cx)},${Math.round(cy)})`);
    await page.mouse.click(cx, cy);
    await sleep(600);
    
    gameOver = await page.evaluate(() =>
      document.querySelector("#play-shell")?.getAttribute("data-phase") === "conflic_bouy_result"
    );
    
    if (i === 4 || i === 9 || i === 14) {
      await shot(page, `dbg-02-shot${i+1}`);
      console.log(`  Screenshot at shot ${i+1}, game over: ${gameOver}`);
    }
  }

  if (pageErrors.length) {
    console.log("\n⚠️ Page errors:");
    pageErrors.forEach(e => console.log(`  ${e.substring(0, 200)}`));
  }
  if (consoleMsgs.length) {
    console.log("\nConsole messages:");
    consoleMsgs.forEach(m => console.log(`  ${m.substring(0, 200)}`));
  }

  // Check canvas is being drawn to (not blank)
  const canvasHasContent = await page.evaluate(() => {
    const c = document.querySelector("#well");
    if (!c) return false;
    const ctx = c.getContext("2d");
    const data = ctx.getImageData(0, 0, 10, 10).data;
    let nonZero = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== 0) nonZero++;
    }
    return nonZero > 0;
  });
  console.log(`\nCanvas has drawn content: ${canvasHasContent}`);

  await browser.close();
  console.log("Done");
}

run().catch((err) => {
  console.error("FAIL:", err.message ?? err);
  process.exit(1);
});
