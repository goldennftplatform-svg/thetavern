/**
 * Bigboard QA — one viewport, map canvas, demo patrons.
 * Run: node scripts/smoke-bigboard.mjs [baseUrl]
 */
import { setTimeout as sleep } from "node:timers/promises";

const baseArg = process.argv[2] ?? "http://127.0.0.1:5174";

async function run() {
  const root = baseArg.replace(/\/$/, "");
  const paths = [`${root}/bigboard.html`, `${root}/thetavern/bigboard.html`];
  let bigboardUrl = null;
  for (const url of paths) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        bigboardUrl = url;
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!bigboardUrl) throw new Error("bigboard.html not reachable");

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(bigboardUrl, { waitUntil: "networkidle" });
  await sleep(2000);

  const scroll = await page.evaluate(() => ({
    doc: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    body: document.body.scrollHeight - document.body.clientHeight,
  }));
  if (scroll.doc > 4 || scroll.body > 4) {
    throw new Error(`Bigboard page scrolls: doc=${scroll.doc}px body=${scroll.body}px`);
  }

  const map = await page.locator("#tavern-map").evaluate((c) => ({
    w: c.width,
    h: c.height,
    cw: c.clientWidth,
    ch: c.clientHeight,
  }));
  if (map.ch < 200 || map.cw < 280) {
    throw new Error(`Map canvas too small: ${map.cw}x${map.ch}`);
  }

  const dock = (await page.locator("#bb-dock-patrons").textContent())?.trim() ?? "";
  if (!/seated|Waiting|Preview|knight/i.test(dock)) {
    throw new Error(`Unexpected dock patrons: "${dock}"`);
  }

  console.log(`smoke-bigboard: OK — no scroll, map ${map.cw}x${map.ch}, dock: ${dock.slice(0, 50)}`);
  await browser.close();
}

run().catch((err) => {
  console.error("smoke-bigboard: FAIL", err.message ?? err);
  process.exit(1);
});
