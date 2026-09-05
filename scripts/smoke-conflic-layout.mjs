import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5174";
const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small-phone", width: 320, height: 568 },
  { name: "landscape", width: 844, height: 390 },
  { name: "tablet", width: 768, height: 1024 },
];

const screenshots = process.env.CONFLIC_SCREENSHOTS ?? join(tmpdir(), "opencode", "conflic-nes");
mkdirSync(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
for (const viewport of viewports) {
  const page = await browser.newPage({ viewport, hasTouch: true, deviceScaleFactor: viewport.name === "mobile" ? 2 : 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.click("#btn-skip-gate");
  const seat = page.locator('[data-hub-action="conflic_bouy_entry"]');
  await seat.scrollIntoViewIfNeeded();
  const beforeHover = await seat.boundingBox();
  await seat.hover();
  const afterHover = await seat.boundingBox();
  if (!beforeHover || !afterHover || Math.abs((beforeHover.x + beforeHover.width / 2) - (afterHover.x + afterHover.width / 2)) > 2) {
    throw new Error(`${viewport.name}: Conflic seat shifts horizontally on hover`);
  }

  await seat.click();
  await page.click('[data-hub-action="conflic_mode:agent"]');
  await page.click('[data-hub-action="conflic_theme:charter"]');
  await page.click('[data-hub-action="conflic_stake:0"]');
  await page.screenshot({ path: join(screenshots, `${viewport.name}-setup.png`) });
  await page.keyboard.press("a");
  await page.waitForTimeout(1000);

  const shell = await page.evaluate(() => {
    const canvas = document.querySelector("#well");
    const rect = canvas?.getBoundingClientRect();
    const hud = document.querySelector(".play-hud");
    const dock = document.querySelector(".play-dock");
    return {
      phase: document.querySelector("#play-shell")?.getAttribute("data-phase"),
      canvas: rect ? { width: rect.width, height: rect.height } : null,
      hudDisplay: hud ? getComputedStyle(hud).display : null,
      dockDisplay: dock ? getComputedStyle(dock).display : null,
    };
  });

  if (shell.phase !== "conflic_bouy" || !shell.canvas || shell.canvas.width < 300 || shell.canvas.height < 300) {
    throw new Error(`${viewport.name}: invalid game shell ${JSON.stringify(shell)}`);
  }
  if (shell.hudDisplay !== "none" || shell.dockDisplay !== "none") {
    throw new Error(`${viewport.name}: shared HUD or dock still overlaps the game`);
  }
  if (errors.length) throw new Error(`${viewport.name}: ${errors.join("; ")}`);

  const regression = await page.evaluate(async () => {
    // Use the app's module URL, including Vite's HMR version, for the input-binding spy.
    const moduleUrl = performance.getEntriesByType("resource").find(entry => /\/conflicBouy\.ts(?:\?|$)/.test(entry.name))?.name;
    const { ConflicBouy } = await import(moduleUrl ?? "/src/minigames/conflicBouy.ts");
    const rect = document.querySelector("#well").getBoundingClientRect();
    const w = Math.round(rect.width), h = Math.round(rect.height);
    const failures = [];
    const check = (condition, message) => { if (!condition) failures.push(message); };
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    const game = new ConflicBouy({ mode: "hotseat" });
    const l = game.getBoardLayout(w, h);
    for (const key of ["cell", "boardSize", "startX", "startY", "opponentX", "opponentY"]) {
      check(Number.isInteger(l[key]), `${key} must be pixel aligned`);
    }
    check(l.cell >= 18, `targets too small: ${l.cell}`);
    check(l.startX >= 24 && l.opponentX + l.boardSize + 6 <= w, "coordinate gutters out of bounds");
    check(l.messageY + l.messageH <= h - l.footerH, "message overlaps footer");
    check(l.playerFleetY >= l.startY + l.boardSize + 6, "own fleet overlaps grid");
    check(l.opponentFleetY >= l.opponentY + l.boardSize + 6, "enemy fleet overlaps grid");
    if (l.stacked) check(l.opponentY - 38 >= l.playerFleetY + l.statusH, "stacked board label overlaps fleet");
    for (const r of [game.getRotateButtonRect(w, h), game.getAutoButtonRect(w, h)]) {
      check(r.h >= 44 && r.w >= 100, "setup control not touch sized");
      check(r.y + r.h < l.startY - 38, "control covers board label");
    }
    game.pointerDown(l.startX + 6 * l.cell + 1, l.startY + 1, w, h);
    check(game.playerPlacing === 0, "invalid edge placement accepted");
    game.pointerDown(l.startX + 5 * l.cell + 1, l.startY + 1, w, h);
    check(game.playerPlacing === 1, "top-right placement swallowed by controls");
    const rotate = game.getRotateButtonRect(w, h);
    game.pointerDown(rotate.x + 5, rotate.y + 5, w, h);
    check(!game.horizontal && game.playerPlacing === 1, "rotate also placed a ship");

    // All cell centers map to the same coordinates that are painted, even at first frame.
    game.phase = "play"; game.currentTurn = "player2";
    let fired = null;
    game.playerFire = (x, y) => { fired = [x, y]; return true; };
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      game.pointerDown(l.opponentX + (x + 0.5) * l.cell, l.opponentY + (y + 0.5) * l.cell, w, h);
      check(fired?.[0] === x && fired?.[1] === y, `cell mapping ${x},${y}`);
    }
    game.pointerMove(l.opponentX + 1.5 * l.cell, l.opponentY + 2.5 * l.cell, w, h);
    check(game.hoverCell?.join() === "1,2", "target coordinate hover");

    const texts = [];
    const fillText = ctx.fillText.bind(ctx);
    ctx.fillText = (text, x, y, maxWidth) => {
      const width = Math.min(ctx.measureText(text).width, maxWidth ?? Infinity);
      const left = ctx.textAlign === "center" ? x - width / 2 : ctx.textAlign === "right" ? x - width : x;
      texts.push({ text, left, right: left + width, y });
      fillText(text, x, y, ...(maxWidth === undefined ? [] : [maxWidth]));
    };
    for (const theme of ["charter", "odyssey", "abyssal", "corsair", "voidwalker"]) {
      game.setTheme(theme);
      for (const phase of ["setup", "play"]) {
        game.phase = phase;
        texts.length = 0;
        game.draw(ctx, w, h);
        check(texts.every(t => t.left >= 0 && t.right <= w && t.y >= 0 && t.y <= h), `${theme}/${phase} text leaves canvas`);
        texts.length = 0;
        game.drawFleetStatus(ctx, l.startX, l.playerFleetY, l.boardSize, l.statusH, "player", game.theme);
        check(texts.every(t => t.left >= l.startX && t.right <= l.startX + l.boardSize && t.y <= l.playerFleetY + l.statusH), `${theme}/${phase} fleet text escapes panel`);
      }
    }
    game.setTheme("charter"); game.handoffPending = true;
    texts.length = 0;
    game.draw(ctx, w, h);
    check(texts.every(t => t.left >= 0 && t.right <= w), "handoff text leaves canvas");
    const concealed = ctx.getImageData(0, 0, w, h).data;
    game.player2Board = game.player1Board;
    game.draw(ctx, w, h);
    check(ctx.getImageData(0, 0, w, h).data.every((value, index) => value === concealed[index]), "handoff leaks fleet pixels");

    let request = null;
    const online = new ConflicBouy({ mode: "online", onlineCallbacks: { deploy() {}, fire(x, y) { request = [x, y]; } } });
    online.phase = "play"; online.currentTurn = "player";
    online.pointerDown(l.opponentX + 1.5 * l.cell, l.opponentY + 2.5 * l.cell, w, h);
    check(request?.join() === "1,2" && online.opponentTargetGrid[2][1] === 0, "online input resolved a shot locally");
    const markers = new ConflicBouy({ mode: "agent" });
    markers.phase = "play";
    markers.playerTargetGrid[0][0] = 3;
    markers.opponentTargetGrid[0][0] = 3;
    markers.opponentTargetGrid[0][1] = 2;
    markers.opponentTargetGrid[0][2] = 4;
    markers.draw(ctx, w, h);
    const pixelAt = (x, y) => [...ctx.getImageData(x, y, 1, 1).data].join();
    const mid = Math.floor(l.cell / 2);
    check(pixelAt(l.startX + mid, l.startY + mid) === "168,216,248,255", "incoming miss is invisible");
    check(pixelAt(l.opponentX + mid, l.opponentY + mid) === "168,216,248,255", "outgoing miss is invisible");
    check(pixelAt(l.opponentX + l.cell + mid, l.opponentY + mid) === "248,232,200,255", "hit cross is invisible");
    check(pixelAt(l.opponentX + l.cell * 2 + mid + 3, l.opponentY + mid + 3) === "248,232,200,255", "sunk X is invisible");

    // Exercise the real main.ts binding: touch-down/swipes/cancel never dispatch game actions.
    const surface = document.querySelector("#well");
    let actions = 0;
    const original = ConflicBouy.prototype.pointerDown;
    ConflicBouy.prototype.pointerDown = () => { actions++; };
    const touch = (type, x, y) => surface.dispatchEvent(new PointerEvent(type, {
      pointerId: 42, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true,
    }));
    try {
      touch("pointerdown", 100, 200);
      check(actions === 0, "touch fires before release");
      touch("pointermove", 100, 250); touch("pointerup", 100, 250);
      check(actions === 0, "swipe fired a shot");
      touch("pointerdown", 100, 200); touch("pointercancel", 100, 200); touch("pointerup", 100, 200);
      check(actions === 0, "cancelled touch fired a shot");
      touch("pointerdown", 100, 200); touch("pointerup", 100, 200);
      check(actions === 1, `completed tap dispatched ${actions} actions instead of one`);
    } finally { ConflicBouy.prototype.pointerDown = original; }
    const viewport = document.querySelector(".stage-viewport");
    check(viewport.scrollWidth <= viewport.clientWidth + 1, "horizontal battle overflow");
    if (h > viewport.clientHeight) {
      viewport.scrollTop = viewport.scrollHeight;
      check(viewport.scrollTop > 0, "short screen cannot scroll to target grid");
      viewport.scrollTop = 0;
    }
    return { failures, cell: l.cell, stacked: l.stacked };
  });
  assert.deepEqual(regression.failures, [], `${viewport.name}: layout regressions`);
  await page.screenshot({ path: join(screenshots, `${viewport.name}-battle.png`) });
  if (viewport.name === "mobile" || viewport.name === "small-phone" || viewport.name === "landscape") {
    await page.locator(".stage-viewport").evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.screenshot({ path: join(screenshots, `${viewport.name}-targets.png`) });
  }
  if (errors.length) throw new Error(`${viewport.name}: ${errors.join("; ")}`);
  console.log(`conflic-layout ${viewport.name}: OK ${Math.round(shell.canvas.width)}x${Math.round(shell.canvas.height)}`);
  await page.close();
}
} finally {
await browser.close();
}
