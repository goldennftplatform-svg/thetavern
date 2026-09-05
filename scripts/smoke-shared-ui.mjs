/** Isolated HTML fixtures with the real CSS cascade. No build or generated assets.
 * Run: node scripts/smoke-shared-ui.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({ server: { host: "127.0.0.1", port: 5197, strictPort: false, open: false } });
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/__shared_ui", (route) => route.fulfill({
    contentType: "text/html",
    body: `<html class="play-active"><head><link rel="stylesheet" href="${base}src/style.css"></head>
      <body><div id="app"><div id="play-shell" class="play-shell" data-phase="chance_pick">
      <div id="play-menu" class="play-menu"><div class="play-menu-body"></div></div>
      </div></div></body></html>`,
  }));
  await page.goto(`${base}__shared_ui`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => [...document.styleSheets].some((sheet) => sheet.href?.includes("style.css")));
  await page.evaluate(async (base) => {
    const studio = await import(`${base}src/ui/studioScreens.ts`);
    const chance = await import(`${base}src/ui/chanceScreens.ts`);
    const rules = await import(`${base}src/minigames/chance.ts`);
    const first = { suit: "cups", rank: 10, label: "Ten of Cups", id: "test-ten" };
    const second = { suit: "coins", rank: 14, label: "Ace of Coins", id: "test-ace" };
    const snapshot = { renown: 12345, tokens: 100, catalogSize: 18, titles: [],
      nickname: "A_very_long_patron_name_without_spaces", seasonName: "Harvest", seasonVerse: "", seasonNote: "", season: "autumn", avatarId: "" };
    window.fixtures = {
      menu: studio.chancePickStudioHtml("Take a seat at the divination table."),
      hilo: chance.chanceHighLowPlayHtml(first),
      color: chance.chanceRedBlackPlayHtml(),
      win: chance.chanceResultStudioHtml(rules.resolveHighLow(1, first, second, "high")),
      tie: chance.chanceResultStudioHtml(rules.resolveHighLow(1, first, first, "high")),
      loss: chance.chanceResultStudioHtml(rules.resolveRedBlack(1, first, "black")),
      modes: studio.conflicThemePickStudioHtml(),
      themes: studio.conflicThemePickStudioHtmlForMode("agent"),
      stakes: studio.conflicStakePickStudioHtml("agent", "odyssey"),
      lobby: studio.conflicLobbyStudioHtml([], true),
      rack: studio.poleRackStudioHtml({ xp: 10000, equippedId: "dockhand_reed", unlockedIds: ["dockhand_reed"] }),
      renown: studio.renownStudioHtml(snapshot, "A long tale of the well. ".repeat(15)),
      trivia: studio.triviaStudioHtml("Which tale belongs to the well?", ["A long answer that must wrap without losing its ending", "Another answer"]),
      arcadeResult: studio.demplarResultStudioHtml({ platform: 100, race: 200, asteroids: 300, total: 600 }, 10, 2),
      catch: studio.catchResolveHtml({ name: "A remarkably long fish name", rarity: "rare", renown: 5, tokens: 1 }, "A fine catch", "The entire fish story remains readable. ".repeat(20)),
    };
  }, base);
  let checked = 0;
  for (const [width, height, scale] of [[320, 568, 1], [390, 844, 1], [844, 390, 1], [1440, 900, 1], [390, 844, 2]]) {
    await page.setViewportSize({ width, height });
    for (const name of await page.evaluate(() => Object.keys(window.fixtures))) {
      await page.evaluate(({ name, scale, width }) => {
        document.documentElement.classList.toggle("tavern-mobile", width < 900);
        document.documentElement.style.fontSize = `${21 * scale}px`;
        document.querySelector(".play-menu-body").innerHTML = window.fixtures[name];
      }, { name, scale, width });
      await page.waitForTimeout(400);
      const issues = await page.evaluate(() => {
        const stage = document.querySelector(".studio-stage");
        const issues = [];
        if (stage.scrollWidth > stage.clientWidth + 2) issues.push("horizontal stage overflow");
        for (const el of stage.querySelectorAll("button, p, h2, h3, .playing-card")) {
          if (!el.getClientRects().length) continue;
          if (el.scrollWidth > el.clientWidth + 2) issues.push(`clipped width: ${el.className}`);
          if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflowY === "hidden") issues.push(`clipped height: ${el.className}`);
        }
        return issues;
      });
      assert.deepEqual(issues, [], `${name} at ${width}x${height}, text ${scale}x`);
      for (const button of await page.locator(".studio-stage button:not(:disabled)").all()) {
        // The mode preview uses pointer-events:none until a mode is selected.
        if (await button.evaluate((el) => getComputedStyle(el).pointerEvents === "none")) continue;
        await button.scrollIntoViewIfNeeded();
        await button.click({ trial: true, timeout: 3000 });
      }
      if (name === "color") assert.equal(await page.locator(".chance-color-legend").isVisible(), true);
      checked++;
    }
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${checked} shared screen/viewport combinations; overflow, button reachability, suit legend, runtime errors.`);
} finally {
  await browser?.close();
  await server.close();
}
