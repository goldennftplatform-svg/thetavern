/** Permanent two-stage regression: engines, real shell, inputs, timers and rewards.
 * node scripts/warrior-playtest.mjs (owns an isolated Vite server, no generated media)
 */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 5199, open: false } });
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route(/^https:\/\//, route => route.abort());
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const failures = await page.evaluate(async () => {
    const { DemplarWarrior, renownFromDemplarScore, tokensFromDemplarScore } = await import("/src/minigames/demplarWarrior.ts");
    const { composeDemplarDeed } = await import("/src/content/deedLore.ts");
    const failures = [];
    const check = (ok, message) => { if (!ok) failures.push(message); };
    for (const mobileEase of [false, true]) {
      const g = new DemplarWarrior({ mobileEase });
      check(g.stage === "brief" && !("platform" in g), "No platform model");
      g.update(0, g.stageStarted + 2999);
      check(g.stage === "brief", "Brief bounded before auto start");
      g.update(0, g.stageStarted + 3000);
      const start = g.stageStarted;
      check(g.stage === "tetris" && g.tetrisSecondsLeft(start) === 70, "Full Tetris clock after brief");
      g.hardDrop();
      check(g.tetris.piecesLocked === 1 && g.tetris.score > 0, "Tetris hard drop scores");
      g.update(0, start + 69999);
      check(!g.tetris.finished, "No early timeout");
      g.update(0, start + 70000);
      check(g.tetris.finished && g.result.race === g.tetris.score, "Exact timeout seals stack");
      const sealed = g.result.race;
      g.steer(1); g.boost(true);
      g.update(0, start + 71599);
      check(g.stage === "tetris" && g.tetris.score === sealed, "Handoff freezes score and input");
      g.update(0, start + 71600);
      const cureStart = g.stageStarted;
      check(g.stage === "drmario", "Only second puzzle follows");
      const y = g.drMario.pill.y;
      g.boost(true); g.pointerUp();
      for (let i = 0; i < 8; i++) g.update(40, cureStart + i * 40);
      check(g.drMario.pill.y === y + 1, "Release cancels held step");
      g.update(0, cureStart + 37999);
      check(!g.done, "Cure gets full 38 seconds");
      g.update(0, cureStart + 38000);
      check(g.done && g.stage === "done", "Cure timeout reaches done");
      check(g.result.total === g.result.race + g.result.asteroids && !("platform" in g.result), "Two-score total only");
      const result = JSON.stringify(g.result);
      g.update(48, cureStart + 90000); g.hardDrop(); g.rotate();
      check(JSON.stringify(g.result) === result, "Completion is idempotent");
      check(renownFromDemplarScore(g.result.total) >= 1 && tokensFromDemplarScore(g.result.total) >= 0, "Reward calculation");
    }
    // Exercise actual ceiling collisions, line cap, piece cap and cure victory.
    for (const ending of ["ceiling", "lines", "pieces"]) {
      const g = new DemplarWarrior();
      g.rotate();
      if (ending === "ceiling") {
        g.tetris.grid[0].fill(1);
        g.tetris.active.y = -1;
        g.tetris.hardDrop();
        check(g.tetris.gameOver, "Ceiling lock tops out instead of deleting hidden cells");
      } else if (ending === "lines") g.tetris.lines = 12;
      else g.tetris.piecesLocked = 28;
      g.update(0, performance.now());
      check(g.tetris.finished, `${ending} seals stack`);
      g.rotate();
      check(g.stage === "drmario", `${ending} handoff skippable`);
      const dr = g.drMario;
      dr.grid = Array.from({ length: 16 }, () => Array(8).fill(null));
      dr.grid[15][0] = "vR";
      dr.grid[14][0] = "R";
      dr.virusesLeft = 1;
      dr.pill = { x: 0, y: 0, horiz: false, a: "R", b: "R" };
      g.hardDrop();
      g.update(0, performance.now());
      check(g.done && dr.virusesLeft === 0 && dr.score >= 600, "Match-four virus victory ends run");
    }
    const g = new DemplarWarrior();
    g.rotate();
    const shapes = [];
    for (let shape = 0; shape < 7; shape++) {
      shapes.push(JSON.stringify(g.tetris.cells({ shape, color: shape, rot: 0, x: 0, y: 0 })));
    }
    check(new Set(shapes).size === 7, "Seven distinct tetrominoes");
    g.tetris.active = { shape: 0, color: 0, rot: 0, x: 3, y: 0 };
    g.rotate();
    check(g.tetris.active.rot === 0, "Square rotation stays stationary");
    g.tetris.finished = true; g.update(0, performance.now()); g.rotate();
    const pill = { ...g.drMario.pill };
    for (let i = 0; i < 4; i++) g.rotate();
    check(JSON.stringify(g.drMario.pill) === JSON.stringify(pill), "Four rotations restore capsule color order");
    const dr = g.drMario;
    dr.grid = Array.from({ length: 16 }, () => Array(8).fill(null));
    dr.grid[14][1] = "R"; dr.grid[14][2] = "B"; dr.grid[15][1] = "vY";
    dr.bonds[14][1] = dr.bonds[14][2] = 5;
    dr.settlePillGravity();
    check(dr.grid[14][2] === "B", "Supported capsule stays linked");
    dr.grid[14][1] = null; dr.bonds[14][1] = -1;
    dr.settlePillGravity();
    check(dr.grid[15][2] === "B", "Broken capsule half falls independently");
    dr.reset();
    g.drMario.grid[0] = ["R", "B", "R", "B", "R", "B", "R", "B"];
    g.drMario.hardDrop();
    g.update(0, performance.now());
    check(g.done, "Full bottle ends run");
    for (let i = 0; i < 20; i++) {
      const deed = composeDemplarDeed("Tester", 200, 300, 500);
      check(!/sprint|three|platform|\{\w+\}/i.test(deed.chronicle + deed.subtext), "Chronicle uses two puzzles");
    }
    return failures;
  });
  assert.deepEqual(failures, []);
  await page.close();

  for (const [width, height, mobile] of [[1280, 900, false], [390, 844, true], [320, 568, true], [844, 390, true]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: mobile });
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.route(/^https:\/\//, route => route.abort());
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.__tavernQA);
    await page.click("#btn-skip-gate");
    await page.waitForSelector("[data-hub-action='demplar_warrior']");
    await page.clock.install();
    await page.click("[data-hub-action='demplar_warrior']");
    await page.waitForSelector("#play-shell[data-warrior-stage='brief']");
    if (mobile) await page.locator("#well").tap();
    else await page.keyboard.press("Space");
    await page.waitForSelector("#play-shell[data-warrior-stage='tetris']");
    assert.equal(await page.locator("#btn-warrior-jump").count(), 0);
    const x0 = await page.evaluate(() => window.__tavernQA.getDemplar().tetris.active.x);
    if (mobile) await page.locator("#btn-warrior-left").tap();
    else await page.keyboard.press("ArrowLeft");
    assert.equal(await page.evaluate(() => window.__tavernQA.getDemplar().tetris.active.x), x0 - 1);
    if (mobile) {
      for (const id of ["rotate", "right", "drop", "hard"]) await page.locator(`#btn-warrior-${id}`).tap();
      const layout = await page.evaluate(() => {
        const controls = [...document.querySelectorAll(".warrior-tap")].map(el => el.getBoundingClientRect());
        return controls.every(r => r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight);
      });
      assert.equal(layout, true, `Touch controls fit and meet 44px targets at ${width}x${height}`);
    } else {
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("KeyF");
    }
    assert.equal(await page.evaluate(() => window.__tavernQA.getDemplar().tetris.piecesLocked), 1);
    if (process.env.COMBO_QA_DIR) await page.screenshot({ path: join(process.env.COMBO_QA_DIR, `combo-${mobile ? "mobile" : "desktop"}-stack.png`) });
    await page.clock.fastForward(71000);
    await page.clock.fastForward(1700);
    await page.waitForSelector("#play-shell[data-warrior-stage='drmario']");
    await page.keyboard.down("ArrowDown");
    await page.keyboard.up("ArrowDown");
    assert.equal(await page.evaluate(() => window.__tavernQA.getDemplar().dropHeld), false, "Keyboard step release");
    if (mobile) {
      await page.locator("#btn-warrior-drop").dispatchEvent("pointerdown", { pointerId: 99 });
      await page.locator("#btn-warrior-drop").dispatchEvent("pointercancel", { pointerId: 99 });
      assert.equal(await page.evaluate(() => window.__tavernQA.getDemplar().dropHeld), false, "Touch cancel releases step");
      await page.locator("#btn-warrior-hard").tap();
    } else await page.keyboard.press("KeyF");
    if (process.env.COMBO_QA_DIR) await page.screenshot({ path: join(process.env.COMBO_QA_DIR, `combo-${mobile ? "mobile" : "desktop"}-cure.png`) });
    await page.clock.fastForward(39000);
    await page.waitForSelector("#play-shell[data-phase='demplar_result']");
    const result = await page.evaluate(() => window.__tavernQA.getDemplar().result);
    assert.equal(result.total, result.race + result.asteroids);
    const text = await page.locator("#play-menu").innerText();
    assert.match(text, /Stack Attack/i);
    assert.match(text, /Veil Cure/i);
    assert.doesNotMatch(text, /sprint|platform|trial iii/i);
    assert.ok(text.includes(String(result.total)));
    const rewards = await page.evaluate(async () => {
      const { renownFromDemplarScore, tokensFromDemplarScore } = await import("/src/minigames/demplarWarrior.ts");
      const score = window.__tavernQA.getDemplar().result.total;
      return { renown: renownFromDemplarScore(score), tokens: tokensFromDemplarScore(score) };
    });
    assert.ok(text.includes(`+${rewards.renown} ★`) && text.includes(`+${rewards.tokens} ◎`), "Displayed rewards use two-stage total");
    await page.clock.fastForward(5000);
    assert.deepEqual(await page.evaluate(() => window.__tavernQA.getDemplar().result), result);
    await page.click("[data-continue='well']");
    await page.click("[data-hub-action='demplar_warrior']");
    await page.keyboard.press("Space");
    assert.deepEqual(await page.evaluate(() => window.__tavernQA.getDemplar().result), { total: 0, race: 0, asteroids: 0 });
    assert.deepEqual(errors, []);
    await page.close();
  }
  const smoke = await promisify(execFile)(process.execPath, ["scripts/smoke-warrior.mjs", base]);
  console.log(smoke.stdout.trim());
  console.log("warrior-playtest: PASS - four full desktop/touch runs; deadlines, early endings, match-four victory, capsule gravity, input release, totals, rewards, chronicle, result and replay");
} finally {
  await browser?.close();
  await server.close();
}
