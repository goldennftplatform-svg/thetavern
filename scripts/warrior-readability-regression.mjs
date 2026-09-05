// Isolated canvas/layout checks; no generated media or shared app state changes.
// Run: node scripts/warrior-readability-regression.mjs
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 5197 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route(/^https:\/\//, route => route.abort());
  await page.route(server.resolvedUrls.local[0], route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Warrior canvas regression</title>" }));
  await page.goto(server.resolvedUrls.local[0], { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  const failures = await page.evaluate(async () => {
    const { DemplarWarrior } = await import("/src/minigames/demplarWarrior.ts");
    const { bindWarriorTouch } = await import("/src/warriorTouch.ts");
    const failures = [];
    for (const [w, h] of [[280, 320], [320, 480], [390, 600], [768, 360], [1100, 700]]) {
      for (const mobileEase of [false, true]) {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        const game = new DemplarWarrior({ mobileEase });
        const texts = [];
        const rectangles = [];
        const fillText = ctx.fillText.bind(ctx);
        ctx.fillText = (text, x, y, maxWidth) => {
          const m = ctx.measureText(text);
          const width = Math.min(m.width, maxWidth ?? Infinity);
          const left = x - (ctx.textAlign === "center" ? width / 2 : ctx.textAlign === "right" ? width : 0);
          texts.push({ text, left, right: left + width, top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent });
          fillText(text, x, y, ...(maxWidth === undefined ? [] : [maxWidth]));
        };
        const strokeRect = ctx.strokeRect.bind(ctx);
        ctx.strokeRect = (x, y, width, height) => {
          rectangles.push({ x, y, width, height });
          strokeRect(x, y, width, height);
        };
        for (const stage of ["brief", "tetris", "handoff", "drmario", "done"]) {
          if (stage === "tetris") game.rotate();
          else if (stage === "handoff") {
            game.tetris.finished = true;
            game.update(0, performance.now());
          } else if (stage === "drmario") game.rotate();
          else if (stage === "done") game.update(0, game.stageStarted + 38000);
          texts.length = rectangles.length = 0;
          game.draw(ctx, w, h, performance.now());
          const tag = `${stage} ${w}x${h} touch=${mobileEase}`;
          for (const t of texts) {
            if (t.left < 0 || t.right > w || t.top < 0 || t.bottom > h) failures.push(`${tag}: clipped ${t.text}`);
          }
          for (const r of rectangles) {
            if (r.x < 0 || r.x + r.width > w || r.y < 0 || r.y + r.height > h) failures.push(`${tag}: clipped board/preview`);
          }
          for (let i = 0; i < texts.length; i++) {
            for (const b of texts.slice(i + 1)) {
              const a = texts[i];
              if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) failures.push(`${tag}: overlapping ${a.text} / ${b.text}`);
            }
          }
        }
      }
    }
    const buttons = Object.fromEntries(["left", "right", "rotate", "drop", "hard"].map(k => [k, document.createElement("button")]));
    buttons.hard.innerHTML = '<span class="warrior-tap-label">Slam</span>';
    buttons.drop.innerHTML = '<span class="warrior-tap-label--tetris">Drop</span><span class="warrior-tap-label--drmario">Step</span>';
    bindWarriorTouch({ touchFriendly: true, canvas: document.createElement("canvas"), getPhase: () => "well", getGame: () => null, buttons });
    if (buttons.hard.textContent !== "Hard drop" || buttons.rotate.textContent !== "Rotate" || !buttons.drop.textContent.includes("Soft drop")) failures.push("Unclear touch labels");
    return failures;
  });
  assert.deepEqual(failures, []);
  console.log("warrior-readability-regression: OK (5 canvas sizes, keyboard/touch, both puzzles and labels)");
} finally {
  await browser?.close();
  await server.close();
}
