import { MOONWELL_SUIT_SYMBOL, type MoonwellSuit } from "../minigames/moonwellDeck";

export type ChanceCardSnap = { label: string; rank: number; suit: string };

export type ChanceSession = {
  from: string;
  game?: "high_low" | "red_black";
  phase: "chance_pick" | "chance_play" | "chance_result";
  cards?: ChanceCardSnap[];
  target?: number;
  outcome?: "win" | "lose" | "push";
  updatedAt: number;
};

const SUIT_COLOR: Record<string, string> = {
  wands: "#8ec878",
  cups: "#e87878",
  coins: "#e8b050",
  swords: "#98b8e8",
};

export function suitColor(suit: string): string {
  return SUIT_COLOR[suit] ?? "#c8c8d8";
}

export function suitSymbol(suit: string): string {
  return MOONWELL_SUIT_SYMBOL[suit as MoonwellSuit] ?? "◆";
}

export function rankLabel(rank: number): string {
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  return String(rank);
}

export function drawMiniCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  card: ChanceCardSnap,
  opts: { w?: number; h?: number; faceDown?: boolean; glow?: boolean } = {},
): void {
  const cw = opts.w ?? 28;
  const ch = opts.h ?? 38;
  const px = x - cw / 2;
  const py = y - ch / 2;

  if (opts.glow) {
    ctx.fillStyle = "rgba(232, 176, 80, 0.35)";
    ctx.fillRect(px - 3, py - 3, cw + 6, ch + 6);
  }

  ctx.fillStyle = opts.faceDown ? "#2a4068" : "#f4ece0";
  ctx.fillRect(px, py, cw, ch);
  ctx.strokeStyle = opts.faceDown ? "#6888b8" : "#1a1018";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, cw, ch);

  if (opts.faceDown) {
    ctx.fillStyle = "#88a8d8";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("?", x, y + 4);
    ctx.textAlign = "left";
    return;
  }

  const col = suitColor(card.suit);
  ctx.fillStyle = col;
  ctx.font = `${Math.max(8, cw * 0.38)}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(rankLabel(card.rank), x, y - 2);
  ctx.font = `${Math.max(7, cw * 0.32)}px "Press Start 2P", monospace`;
  ctx.fillText(suitSymbol(card.suit), x, y + 10);
  ctx.textAlign = "left";
}

export function drawChanceCorner(
  ctx: CanvasRenderingContext2D,
  zoneX: number,
  zoneY: number,
  sessions: ChanceSession[],
  tick: number,
  flashUntil: number,
  now: number,
): void {
  const zw = 120;
  const zh = 88;
  const active = sessions;

  const pulse = 0.5 + Math.sin(tick * 0.08) * 0.5;
  const flashing = now < flashUntil;

  if (active.length > 0 || flashing) {
    ctx.fillStyle = flashing
      ? `rgba(232, 176, 80, ${0.22 + pulse * 0.18})`
      : `rgba(232, 176, 80, ${0.06 + pulse * 0.08})`;
    ctx.fillRect(zoneX - 4, zoneY - 4, zw + 8, zh + 8);
  }

  ctx.fillStyle = "#4a3020";
  ctx.fillRect(zoneX, zoneY, zw, zh);
  ctx.strokeStyle = active.length > 0 ? "#e8b050" : "#000";
  ctx.lineWidth = active.length > 0 ? 3 : 2;
  ctx.strokeRect(zoneX, zoneY, zw, zh);

  ctx.fillStyle = "#e8b050";
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillText("CHANCE", zoneX + 6, zoneY + 14);

  if (active.length === 0) {
    ctx.fillStyle = "rgba(248, 240, 255, 0.45)";
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText("IDLE", zoneX + 8, zoneY + 52);
    return;
  }

  const show = active.slice(0, 2);
  show.forEach((s, i) => {
    const rowY = zoneY + 28 + i * 30;
    const short =
      s.from.length > 8 ? `${s.from.slice(0, 6)}…` : s.from;
    ctx.fillStyle = "#f8f0ff";
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText(short, zoneX + 6, rowY);

    if (s.phase === "chance_pick") {
      ctx.fillStyle = "#88b8a8";
      ctx.fillText("PICK…", zoneX + 6, rowY + 10);
      return;
    }

    if (s.game === "red_black") {
      const card = s.cards?.[0];
      if (card) {
        drawMiniCard(ctx, zoneX + zw - 22, rowY + 6, card, { w: 24, h: 32 });
      } else if (s.phase === "chance_play") {
        drawMiniCard(ctx, zoneX + zw - 22, rowY + 6, { label: "?", rank: 0, suit: "coins" }, {
          w: 24,
          h: 32,
          faceDown: true,
        });
      }
      ctx.fillStyle = "#e87878";
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText("RED/BLK", zoneX + 6, rowY + 10);
    } else {
      const first = s.cards?.[0];
      const second = s.cards?.[1];
      if (first) {
        drawMiniCard(ctx, zoneX + zw - 48, rowY + 6, first, {
          w: 22,
          h: 30,
          glow: s.phase === "chance_play",
        });
      }
      if (second) {
        drawMiniCard(ctx, zoneX + zw - 22, rowY + 6, second, { w: 22, h: 30 });
      } else if (s.phase === "chance_play") {
        drawMiniCard(ctx, zoneX + zw - 22, rowY + 6, { label: "?", rank: 0, suit: "cups" }, {
          w: 22,
          h: 30,
          faceDown: true,
        });
      }
    }

    if (s.phase === "chance_result" && s.outcome) {
      const col =
        s.outcome === "win" ? "#68e8a8" : s.outcome === "push" ? "#e8b050" : "#e87878";
      ctx.fillStyle = col;
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText(s.outcome.toUpperCase(), zoneX + 6, rowY + 22);
    }
  });

  if (active.length > 2) {
    ctx.fillStyle = "#88b8a8";
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText(`+${active.length - 2} more`, zoneX + 6, zoneY + zh - 6);
  }
}
