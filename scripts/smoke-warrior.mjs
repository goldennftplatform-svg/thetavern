/**
 * Warrior QA — brief readable type, canvas size, trial starts.
 * Run: node scripts/smoke-warrior.mjs [baseUrl]
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
    } catch {
      /* try next */
    }
  }
  return root;
}

async function run() {
  const baseUrl = await resolveAppUrl(baseArg);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.click("#btn-skip-gate");
  await page.waitForSelector("[data-hub-action='demplar_warrior']", { timeout: 15000 });
  await page.click("[data-hub-action='demplar_warrior']");
  await page.waitForSelector("#play-shell[data-phase='demplar_warrior']", { timeout: 8000 });

  const canvasBox = await page.locator("#well").boundingBox();
  if (!canvasBox || canvasBox.height < 280) {
    throw new Error(`Warrior canvas too short: ${canvasBox?.height ?? 0}px (need ≥280)`);
  }

  await sleep(400);
  const metrics = await page.evaluate(() => {
    const q = window.__tavernQA?.getDemplar?.();
    return q?.getBriefMetrics?.() ?? null;
  });
  if (!metrics) {
    throw new Error("Warrior QA hook missing — dev build required for brief metrics");
  }
  if (metrics.minFontPx < 26) {
    throw new Error(`Warrior brief font too small: ${metrics.minFontPx}px (PROMPTME min 26px)`);
  }
  if (metrics.rowCount < 3) {
    throw new Error(`Warrior brief too few rows: ${metrics.rowCount}`);
  }

  await page.waitForSelector("#play-shell[data-warrior-stage='platform']", { timeout: 20000 });

  if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);

  console.log(
    `smoke-warrior: OK — canvas ${Math.round(canvasBox.height)}px, brief min ${metrics.minFontPx}px, platform started`,
  );
  await browser.close();
}

run().catch((err) => {
  console.error("smoke-warrior: FAIL", err.message ?? err);
  process.exit(1);
});
