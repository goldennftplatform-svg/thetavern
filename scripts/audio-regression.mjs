// Run: node scripts/audio-regression.mjs. Isolated Vite, no generated assets or screenshots.
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 5198 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.route(/^https:\/\//, route => route.abort());
  await page.addInitScript(() => {
    window.audioConnections = [];
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (target, ...args) {
      window.audioConnections.push([this, target]);
      return connect.call(this, target, ...args);
    };
  });
  const url = server.resolvedUrls.local[0];
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  const state = () => page.evaluate(async () => (await import("/src/audio/soundtrack.ts")).audioState());
  assert.equal((await state()).contextState, "uninitialized");
  await page.locator("#audio-volume").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(async () => (await import("/src/audio/soundtrack.ts")).audioState().running);
  assert.equal((await state()).volume, 0.36);
  await page.click("#audio-mute");
  assert.equal((await state()).running, false);
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal((await state()).muted, true);
  assert.equal((await state()).volume, 0.36);
  assert.equal((await state()).contextState, "uninitialized");
  await page.click("#audio-mute");
  await page.waitForFunction(async () => (await import("/src/audio/soundtrack.ts")).audioState().running);

  const routing = await page.evaluate(async () => {
    const a = await import("/src/audio/soundtrack.ts");
    const cases = [
      ["enter", undefined, undefined, "tavern"], ["well", undefined, undefined, "tavern"],
      ["fish_cast", undefined, undefined, "fishing"], ["fish_wait", undefined, undefined, "fishing"],
      ["fish_reel", undefined, undefined, "fishing"], ["resolve", undefined, undefined, "fishing"],
      ["demplar_warrior", "brief", undefined, "tetris"],
      ["demplar_warrior", "tetris", undefined, "tetris"], ["demplar_warrior", "drmario", undefined, "drmario"],
      ["demplar_result", undefined, undefined, "tavern"], ["chance_pick", undefined, "red_black", "hilo"],
      ["chance_play", undefined, "high_low", "hilo"], ["chance_result", undefined, "red_black", "redblack"],
      ...["conflic_theme", "conflic_theme_mode", "conflic_stake", "conflic_lobby", "conflic_bouy", "conflic_bouy_result"].map(p => [p, undefined, undefined, "conflic"]),
    ];
    for (const [phase, stage, chance, expected] of cases) {
      a.setAudioPhase(phase, stage, chance);
      if (a.audioState().theme !== expected) throw Error(`Wrong theme for ${phase}/${stage}`);
    }
    const timers = new Set();
    const originalSet = window.setInterval;
    const originalClear = window.clearInterval;
    window.setInterval = (...args) => { const id = originalSet(...args); timers.add(id); return id; };
    window.clearInterval = id => { timers.delete(id); originalClear(id); };
    for (let i = 0; i < 40; i++) { a.setAudioPhase("well"); a.setAudioPhase("fish_cast"); a.setAudioPhase("fish_wait"); }
    const loops = timers.size;
    window.setInterval = originalSet;
    window.clearInterval = originalClear;
    const sfx = await import("/src/audio/warriorSfx.ts");
    const fish = await import("/src/audio/fishingSfx.ts");
    const jack = await import("/src/audio/jackSparrow.ts");
    const hall = await import("/src/audio/hallMusic.ts");
    sfx.playWarriorImpact(); sfx.playTetrisSlam(); fish.playSplash(); await hall.playCatchFanfare();
    jack.primeJackSparrow();
    const connections = window.audioConnections;
    const destinations = connections.filter(([, to]) => to instanceof AudioDestinationNode);
    const master = a.audioOutput();
    const mediaConnected = connections.some(([from, to]) => from instanceof MediaElementAudioSourceNode && to === master);
    a.setAudioPreferences({ volume: 0 });
    const stoppedAtZero = !a.audioState().running;
    const before = connections.length;
    sfx.playWarriorImpact(); fish.playSplash();
    const suppressed = connections.length === before && !jack.playJackTaunt();
    a.setAudioPreferences({ volume: 0.2 });
    await new Promise(r => setTimeout(r, 150));
    return { loops, destinations: destinations.length, mediaConnected, stoppedAtZero, suppressed, gain: master.gain.value };
  });
  assert.deepEqual({ ...routing, gain: Math.round(routing.gain * 100) }, { loops: 1, destinations: 1, mediaConnected: true, stoppedAtZero: true, suppressed: true, gain: 20 });

  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForFunction(async () => (await import("/src/audio/soundtrack.ts")).audioState().contextState === "suspended");
  assert.equal((await state()).running, false);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForFunction(async () => (await import("/src/audio/soundtrack.ts")).audioState().running);

  await page.click("#btn-skip-gate");
  await page.waitForSelector("[data-hub-action='fish']", { timeout: 30000 });
  await page.click("[data-hub-action='chance_menu']");
  await page.click("[data-hub-action='chance:red_black']");
  assert.equal((await state()).theme, "redblack");
  await page.click("[data-guess='red']");
  await page.click("[data-continue='well']");
  assert.equal((await state()).theme, "tavern");
  await page.click("[data-hub-action='demplar_warrior']");
  for (const [stage, expected] of [["tetris", "tetris"], ["drmario", "drmario"]]) {
    await page.evaluate(stage => {
      const game = window.__tavernQA.getDemplar();
      if (stage === "drmario") {
        game.tetris.finished = true;
        game.update(0, performance.now());
      }
      game.rotate();
    }, stage);
    await page.waitForFunction(async expected => (await import("/src/audio/soundtrack.ts")).audioState().theme === expected, expected);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.click("#btn-skip-gate");
  await page.waitForSelector("[data-hub-action='conflic_bouy_entry']", { timeout: 30000 });
  await page.click("[data-hub-action='conflic_bouy_entry']");
  await page.click("[data-hub-action='conflic_mode:hotseat']");
  await page.click("[data-hub-action='conflic_theme:charter']");
  await page.waitForSelector("#play-shell[data-phase='conflic_bouy']");
  assert.equal((await state()).theme, "conflic");
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const control = document.querySelector("#audio-controls").getBoundingClientRect();
      const shell = document.querySelector("#play-shell").getBoundingClientRect();
      const button = document.querySelector("#audio-mute").getBoundingClientRect();
      return { fits: control.left >= 0 && control.right <= innerWidth && control.bottom <= shell.top, hit: document.elementFromPoint(button.x + 22, button.y + 22)?.closest("#audio-mute") !== null };
    });
    assert.deepEqual(layout, { fits: true, hit: true }, `${width}x${height}`);
  }
  await page.evaluate(() => localStorage.setItem("moonwell.audio.v1", "broken"));
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal((await state()).volume, 0.35);
  const denied = await browser.newPage();
  await denied.route(/^https:\/\//, route => route.abort());
  await denied.addInitScript(() => {
    Storage.prototype.getItem = () => { throw Error("Storage blocked"); };
    Storage.prototype.setItem = () => { throw Error("Storage blocked"); };
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  await denied.goto(url, { waitUntil: "domcontentloaded" });
  await denied.click("#audio-mute");
  assert.equal(await denied.locator("#audio-mute").getAttribute("aria-pressed"), "true");
  await denied.close();
  assert.deepEqual(errors, []);
  console.log("PASS audio: gestures, preferences, 20 routes, one loop/mixer, SFX/media, visibility, live chance/warrior/Conflic, responsive controls, corrupt/blocked storage, unsupported audio");
} finally {
  await browser?.close();
  await server.close();
}
