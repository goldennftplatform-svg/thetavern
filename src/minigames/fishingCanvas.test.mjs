import assert from "node:assert/strict";
import { chromium } from "playwright";

// Run against npm run dev; no production build or generated-data hooks.
const baseUrl = process.argv[2] ?? "http://localhost:5174";
const browser = await chromium.launch();
try {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      return ["127.0.0.1", "localhost"].includes(url.hostname) ? route.continue() : route.abort();
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.click("#btn-skip-gate");
    await page.click("[data-hub-action='fish']");
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(async () => {
      const { drawMoonwell } = await import("/src/minigames/fishingCanvas.ts");
      const rect = document.querySelector("#well").getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      const original = ctx.fillText.bind(ctx);
      let labels = [];
      ctx.fillText = (text, x, y) => {
        const metrics = ctx.measureText(text);
        const left = x - (ctx.textAlign === "center" ? metrics.width / 2 : ctx.textAlign === "right" ? metrics.width : 0);
        labels.push({ text, left, right: left + metrics.width, top: y - metrics.actualBoundingBoxAscent, bottom: y + metrics.actualBoundingBoxDescent });
        original(text, x, y);
      };
      const errors = [];
      for (const phase of ["fish_cast", "fish_wait", "fish_reel"]) {
        for (const value of [0, 0.34, 0.5, 0.66, 0.8, 1]) {
          labels = [];
          drawMoonwell(ctx, {
            phase, castPower: value, biteOpen: value > 0.5, waitPulse: 1,
            reelTension: value, reelProgress: value, seasonTint: "#8cb8d8", now: 10000,
            loreLine: "Wide moonwell lore WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
            banner: "A very long fishing status WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
          }, w, h);
          // Heraldry and the avatar glyph are scenery painted beneath the HUD.
          const ui = labels.filter(label => !["\u2694", "\ud83c\udfa3", "MOONWELL \u00b7 RIM CHARTER", "cast well \u00b7 read mist \u00b7 keep the tale"].includes(label.text));
          for (const label of ui) {
            if (label.left < 0 || label.right > w || label.top < 0 || label.bottom > h) errors.push(`${phase}: clipped ${label.text}`);
          }
          for (let i = 0; i < ui.length; i++) {
            for (const b of ui.slice(i + 1)) {
              const a = ui[i];
              if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) errors.push(`${phase}: overlapping ${a.text} / ${b.text}`);
            }
          }
        }
      }
      return { w, h, errors };
    });
    assert.deepEqual(result.errors, [], JSON.stringify({ viewport, ...result }));
    console.log(`fishing canvas: ${viewport.width}x${viewport.height}, stage ${result.w}x${result.h}: OK`);
    await page.close();
  }
} finally {
  await browser.close();
}
