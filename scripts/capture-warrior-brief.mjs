import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5174";
const { chromium } = await import("playwright");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(base.replace(/\/$/, "") + "/", { waitUntil: "networkidle" });
await page.click("#btn-skip-gate");
await page.waitForSelector("[data-hub-action='demplar_warrior']");
await page.click("[data-hub-action='demplar_warrior']");
await page.waitForSelector("#play-shell[data-phase='demplar_warrior']");
await sleep(1200);
const info = await page.evaluate(() => {
  const c = document.getElementById("well");
  const r = c?.getBoundingClientRect();
  const m = window.__tavernQA?.getDemplar?.()?.getBriefMetrics?.();
  return { canvas: r ? { w: r.width, h: r.height } : null, metrics: m };
});
const out = resolve("scripts/warrior-brief-qa.png");
await page.screenshot({ path: out });
console.log(JSON.stringify({ screenshot: out, ...info }, null, 2));
await browser.close();
