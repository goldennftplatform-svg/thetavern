import type { XLoreFeed } from "../lore/xFeed";
import { formatXPostAge } from "../lore/xFeed";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tickerItemsHtml(feed: XLoreFeed): string {
  return feed.posts
    .map((p) => {
      const handle = p.handle.replace(/^@/, "");
      const age = formatXPostAge(p.createdAt);
      return `<span class="bb-ticker-item"><strong class="bb-ticker-handle">@${escapeHtml(handle)}</strong> <span class="bb-ticker-text">${escapeHtml(p.text)}</span> <span class="bb-ticker-age">${escapeHtml(age)}</span></span>`;
    })
    .join("");
}

/** CNN-style horizontal relay ticker — duplicate track for seamless loop. */
export function mountBbTicker(root: HTMLElement, feed: XLoreFeed): void {
  const html = tickerItemsHtml(feed);
  if (!html) return;

  for (const lane of root.querySelectorAll<HTMLElement>(".bb-ticker-track")) {
    const copies = lane.querySelectorAll<HTMLElement>(".bb-ticker-content");
    copies.forEach((el) => {
      el.innerHTML = html;
    });

    const measure = copies[0];
    if (!measure) continue;

    const setSpeed = () => {
      const w = measure.scrollWidth || 2400;
      const pxPerSec = 72;
      const duration = Math.max(48, Math.min(360, w / pxPerSec));
      lane.style.setProperty("--bb-ticker-duration", `${duration}s`);
    };

    setSpeed();
    requestAnimationFrame(setSpeed);
  }
}

export function bbTickerShell(label = "OVERHEARD ON X"): string {
  return `<div class="bb-ticker" role="marquee" aria-live="off" aria-label="Tavern relay of Demplar posts from X">
  <div class="bb-ticker-label">${escapeHtml(label)}</div>
  <div class="bb-ticker-viewport">
    <div class="bb-ticker-track">
      <div class="bb-ticker-content"></div>
      <div class="bb-ticker-content" aria-hidden="true"></div>
    </div>
  </div>
</div>`;
}
