/**
 * Browser smoke test — post-catch overlay must be visible and clickable.
 * Run: node scripts/smoke-play.mjs [baseUrl]
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const baseArg = process.argv[2] ?? "http://localhost:5174";

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
let devProc = null;

async function ensureServer(root) {
  try {
    const url = await resolveAppUrl(root);
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) return url;
  } catch {
    /* start vite */
  }
  devProc = spawn("npm", ["run", "dev", "--", "--host", "--port", "5174"], {
    shell: true,
    stdio: "ignore",
    detached: false,
  });
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const url = await resolveAppUrl(root);
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return url;
    } catch {
      /* retry */
    }
  }
  throw new Error(`Dev server not reachable at ${root}`);
}

async function run() {
  const baseUrl = await ensureServer(baseArg);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.click("#btn-skip-gate");
  await page.waitForSelector("#play-menu:not([hidden]) [data-hub-action='fish']", { timeout: 25000 });

  // Cast → wait → strike → reel completes → resolve overlay
  await page.click("[data-hub-action='fish']");
  await page.waitForSelector("#btn-primary:not([hidden])", { timeout: 5000 });
  await page.locator("#btn-primary").dispatchEvent("pointerdown");
  await sleep(400);
  await page.locator("#btn-primary").dispatchEvent("pointerup");
  await page.waitForSelector("#btn-strike:not([hidden])", { timeout: 10000 });
  await page.locator("#btn-strike").click({ force: true });
  await page.waitForSelector("#play-shell[data-phase='fish_reel']", { timeout: 10000 });
  await page.locator("#btn-primary").click({ force: true });
  await page.waitForSelector("[data-continue='renown']", { timeout: 12000 });

  const menuDisplay = await page.locator("#play-menu").evaluate((el) => getComputedStyle(el).display);
  const continueVisible = await page.locator("[data-continue='renown']").isVisible();
  if (menuDisplay === "none" || !continueVisible) {
    throw new Error(`Resolve overlay broken: menu display=${menuDisplay}, continue visible=${continueVisible}`);
  }

  await page.click("[data-continue='renown']");
  // Pole unlock interstitial also uses data-continue=renown ("Keep the old grip").
  for (let i = 0; i < 3; i++) {
    const interlude = page.locator("[data-continue='interlude']");
    if (await interlude.isVisible().catch(() => false)) break;
    const again = page.locator("[data-continue='renown']");
    if (await again.isVisible().catch(() => false)) await again.click();
    else break;
  }
  await page.waitForSelector("[data-continue='interlude']", { timeout: 5000 });
  await page.click("[data-continue='interlude']");

  const interludePhase = await page.locator("#play-shell").getAttribute("data-phase");
  if (interludePhase !== "peril" && interludePhase !== "trivia") {
    throw new Error(`Expected peril or trivia after renown, got ${interludePhase}`);
  }

  const choiceSel =
    interludePhase === "peril" ? "[data-peril-choice='0']" : "[data-trivia-choice='0']";
  await page.waitForSelector(choiceSel, { timeout: 5000 });
  await page.click(choiceSel);
  const teachContinue = page.locator("[data-continue='well']");
  if (await teachContinue.isVisible().catch(() => false)) {
    await teachContinue.click();
  }
  await page.waitForSelector("[data-hub-action='fish']", { timeout: 12000 });

  // Cards flow smoke — Hi-Lo
  await page.click("[data-hub-action='chance_menu']");
  await page.waitForSelector("[data-hub-action='chance:high_low']", { timeout: 5000 });
  await page.click("[data-hub-action='chance:high_low']");
  await page.waitForSelector("[data-guess='high'][data-chance-game='high_low']", { timeout: 5000 });
  const hiloKicker = await page.locator(".chance-stage--hilo .chance-game-kicker").textContent();
  if (!hiloKicker?.includes("Rank")) {
    throw new Error(`Hi-Lo screen wrong: kicker=${hiloKicker}`);
  }
  await page.click("[data-guess='high']");
  await page.waitForSelector("[data-continue='well']", { timeout: 5000 });
  let resultMenuDisplay = await page.locator("#play-menu").evaluate((el) => getComputedStyle(el).display);
  if (resultMenuDisplay === "none") {
    throw new Error(`Chance result overlay hidden (display=${resultMenuDisplay})`);
  }
  await page.click("[data-continue='well']");
  await page.waitForSelector("[data-hub-action='fish']", { timeout: 5000 });

  // Red / Black
  await page.click("[data-hub-action='chance_menu']");
  await page.click("[data-hub-action='chance:red_black']");
  await page.waitForSelector("[data-guess='red'][data-chance-game='red_black']", { timeout: 5000 });
  const colorKicker = await page.locator(".chance-stage--color .chance-game-kicker").textContent();
  if (!colorKicker?.includes("Color")) {
    throw new Error(`Red/Black screen wrong: kicker=${colorKicker}`);
  }
  const faceDown = await page.locator(".chance-stage--color .playing-card--back").count();
  if (faceDown < 1) throw new Error("Red/Black should show face-down card");
  await page.click("[data-guess='red']");
  await page.waitForSelector("[data-continue='well']", { timeout: 5000 });
  resultMenuDisplay = await page.locator("#play-menu").evaluate((el) => getComputedStyle(el).display);
  if (resultMenuDisplay === "none") {
    throw new Error(`Red/Black result overlay hidden`);
  }
  await page.click("[data-continue='well']");
  await page.waitForSelector("[data-hub-action='fish']", { timeout: 5000 });

  if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);

  console.log("smoke-play: OK — resolve, renown, interlude, cards, back to hub");
  await browser.close();
  if (devProc) devProc.kill();
}

run().catch((err) => {
  console.error("smoke-play: FAIL", err.message ?? err);
  if (devProc) devProc.kill();
  process.exit(1);
});
