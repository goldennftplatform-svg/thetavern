import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5174";
const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 },
];

mkdirSync("test-screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
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

  await page.screenshot({ path: `test-screenshots/conflic-layout-${viewport.name}.png` });
  console.log(`conflic-layout ${viewport.name}: OK ${Math.round(shell.canvas.width)}x${Math.round(shell.canvas.height)}`);
  await page.close();
}

await browser.close();
