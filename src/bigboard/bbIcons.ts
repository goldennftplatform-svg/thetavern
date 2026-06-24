/** Projector-readable feed icons (16×16, no emoji). */

export function bbIconCatch(): string {
  return `<svg class="bb-feed-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 8c2-4 5-6 8-5 1 0 2 1 3 3-2 1-3 3-3 5H5c0-2 1-3 2-3z"/><circle cx="11" cy="5" r="1" fill="#38f0a8"/></svg>`;
}

export function bbIconGamble(): string {
  return `<svg class="bb-feed-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"/><text x="8" y="11" text-anchor="middle" font-size="7" fill="currentColor" font-family="monospace">?</text></svg>`;
}

export function bbIconFeast(): string {
  return `<svg class="bb-feed-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3 4h10v2H3zm1 4h8v1H4zm0 3h6v1H4z"/><rect x="6" y="2" width="4" height="2" fill="#f8d820"/></svg>`;
}

export function bbIconDefault(): string {
  return `<svg class="bb-feed-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

export function bbIconForKind(kind?: string): string {
  if (kind === "catch") return bbIconCatch();
  if (kind === "gamble") return bbIconGamble();
  if (kind === "feast") return bbIconFeast();
  return bbIconDefault();
}
