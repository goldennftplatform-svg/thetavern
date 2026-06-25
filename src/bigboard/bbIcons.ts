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

export function bbIconPeril(): string {
  return `<svg class="bb-feed-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 2l6 11H2z" opacity="0.9"/><text x="8" y="12" text-anchor="middle" font-size="8" fill="#0c1018" font-family="monospace">!</text></svg>`;
}

export function bbIconTrivia(): string {
  return `<svg class="bb-feed-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/><text x="8" y="11" text-anchor="middle" font-size="9" fill="currentColor" font-family="monospace">?</text></svg>`;
}

export function bbIconRenown(): string {
  return `<svg class="bb-feed-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1l2 5h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5z"/></svg>`;
}

export function bbIconDefault(): string {
  return `<svg class="bb-feed-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

export function bbIconWarrior(): string {
  return `<svg class="bb-feed-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 13l5-10 5 10H2zm2-2h6L8 5 4 11z"/><path fill="#e8b050" d="M7 1h2v4H7z"/></svg>`;
}

export function bbIconForKind(kind?: string): string {
  if (kind === "catch") return bbIconCatch();
  if (kind === "demplar") return bbIconWarrior();
  if (kind === "gamble") return bbIconGamble();
  if (kind === "feast") return bbIconFeast();
  if (kind === "peril") return bbIconPeril();
  if (kind === "trivia") return bbIconTrivia();
  if (kind === "renown") return bbIconRenown();
  return bbIconDefault();
}
