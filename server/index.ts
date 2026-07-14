import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server as IOServer } from "socket.io";

const PORT = Number(process.env.TRAIL_PORT ?? process.env.PORT ?? 3847);
const CORS_ORIGIN = process.env.TRAIL_CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? true;

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.get("/health", (_req, res) => res.json({ ok: true, hall: "moonwell" }));

const httpServer = createServer(app);
const io = new IOServer(httpServer, {
  cors: { origin: CORS_ORIGIN },
  transports: ["polling", "websocket"],
  allowEIO3: true,
});

type Patron = {
  id: string;
  name: string;
  atWell: boolean;
  title?: string;
  catalogSize?: number;
  tokens?: number;
};

type Trophy = {
  id: string;
  fish: string;
  rarity: "mythic" | "omen";
  from: string;
  ts: number;
  charterNight?: string;
};

type StakeSnap = {
  from: string;
  kind: "chance" | "feast";
  label: string;
  stake: number;
  tokensLeft?: number;
  ts: number;
};

const patrons = new Map<string, Patron>();
const DEED_FEED_MAX = 120;
const TROPHY_MAX = 40;
const STAKE_MAX = 16;
const deedFeed: Record<string, unknown>[] = [];
const trophyFeed: Trophy[] = [];
const stakeFeed: StakeSnap[] = [];

function patronSnapshot() {
  return [...patrons.values()]
    .filter((p) => p.atWell)
    .map((p) => ({
      name: p.name,
      title: p.title,
      catalogSize: p.catalogSize,
      tokens: p.tokens,
    }));
}

function broadcastPatrons(room: string) {
  io.to(room).emit("moonwell:patrons", { patrons: patronSnapshot() });
}

function sendPatronsTo(socket: import("socket.io").Socket) {
  socket.emit("moonwell:patrons", { patrons: patronSnapshot() });
}

function recordDeed(deed: Record<string, unknown>): Record<string, unknown> {
  const ev = {
    id: `${deed.ts ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...deed,
    ts: deed.ts ?? Date.now(),
  };
  deedFeed.unshift(ev);
  if (deedFeed.length > DEED_FEED_MAX) deedFeed.length = DEED_FEED_MAX;
  return ev;
}

function pushTrophy(room: string, trophy: Trophy) {
  if (trophyFeed.some((t) => t.id === trophy.id)) return;
  trophyFeed.unshift(trophy);
  if (trophyFeed.length > TROPHY_MAX) trophyFeed.length = TROPHY_MAX;
  io.to(room).emit("hall:trophy", trophy);
  io.to(room).emit("hall:trophy:sync", trophyFeed);
}

function pushStake(room: string, stake: StakeSnap) {
  stakeFeed.unshift(stake);
  if (stakeFeed.length > STAKE_MAX) stakeFeed.length = STAKE_MAX;
  io.to(room).emit("hall:stake", stake);
  io.to(room).emit("hall:stake:sync", stakeFeed);
}

function maybeRecordTrophy(deed: Record<string, unknown>, room: string) {
  if (deed.kind !== "catch") return;
  const rarity = deed.rarity;
  if (rarity !== "mythic" && rarity !== "omen") return;
  const fish = typeof deed.fish === "string" ? deed.fish : undefined;
  const from = typeof deed.from === "string" ? deed.from : "A patron";
  if (!fish) return;
  const ts = typeof deed.ts === "number" ? deed.ts : Date.now();
  pushTrophy(room, {
    id: `${from}|${fish}|${ts}`,
    fish,
    rarity,
    from,
    ts,
    charterNight: typeof deed.charterNight === "string" ? deed.charterNight : undefined,
  });
}

function maybeRecordStake(deed: Record<string, unknown>, room: string) {
  const kind = deed.kind;
  const from = typeof deed.from === "string" ? deed.from : "A patron";
  const ts = typeof deed.ts === "number" ? deed.ts : Date.now();
  if (kind === "gamble" && typeof deed.stake === "number" && deed.stake > 0) {
    const game = typeof deed.game === "string" ? deed.game : "cards";
    pushStake(room, {
      from,
      kind: "chance",
      label: game === "red_black" ? "Red/Black" : game === "high_low" ? "Hi-Lo" : "Chance",
      stake: deed.stake,
      tokensLeft: typeof deed.tokensLeft === "number" ? deed.tokensLeft : undefined,
      ts,
    });
  }
  if (kind === "feast" && typeof deed.stake === "number" && deed.stake > 0) {
    pushStake(room, {
      from,
      kind: "feast",
      label: typeof deed.food === "string" ? deed.food : "Kitchen",
      stake: deed.stake,
      tokensLeft: typeof deed.tokensLeft === "number" ? deed.tokensLeft : undefined,
      ts,
    });
  }
}

function pushDeed(room: string, deed: Record<string, unknown>) {
  const ev = recordDeed(deed);
  io.to(room).emit("hall:deed", ev);
  maybeRecordTrophy(ev, room);
  maybeRecordStake(ev, room);
}

function sendDeedSync(socket: import("socket.io").Socket) {
  socket.emit("hall:deed:sync", deedFeed);
  socket.emit("hall:trophy:sync", trophyFeed);
  socket.emit("hall:stake:sync", stakeFeed);
}

io.on("connection", (socket) => {
  const defaultRoom = "moonwell";

  socket.on(
    "tavern:join",
    async (payload: {
      name?: string;
      projector?: boolean;
      title?: string;
      catalogSize?: number;
      tokens?: number;
    }) => {
      const name = (payload?.name ?? `Angler ${socket.id.slice(0, 4)}`).slice(0, 32);
      const atWell = !payload?.projector;
      patrons.set(socket.id, {
        id: socket.id,
        name,
        atWell,
        title: typeof payload?.title === "string" ? payload.title.slice(0, 48) : undefined,
        catalogSize:
          typeof payload?.catalogSize === "number" ? Math.max(0, payload.catalogSize) : undefined,
        tokens: typeof payload?.tokens === "number" ? Math.max(0, payload.tokens) : undefined,
      });
      await socket.join(defaultRoom);
      sendPatronsTo(socket);
      sendDeedSync(socket);
      socket.to(defaultRoom).emit("moonwell:patrons", { patrons: patronSnapshot() });
      socket.emit("tavern:welcome", { room: defaultRoom, name });
    },
  );

  socket.on("hall:deed:request", () => {
    sendDeedSync(socket);
  });

  socket.on(
    "moonwell:identity",
    (payload: { title?: string; catalogSize?: number; tokens?: number }) => {
      const p = patrons.get(socket.id);
      if (!p) return;
      if (typeof payload?.title === "string") p.title = payload.title.slice(0, 48) || undefined;
      if (typeof payload?.catalogSize === "number") p.catalogSize = Math.max(0, payload.catalogSize);
      if (typeof payload?.tokens === "number") p.tokens = Math.max(0, payload.tokens);
      patrons.set(socket.id, p);
      broadcastPatrons(defaultRoom);
    },
  );

  socket.on("moonwell:presence", (payload: { atWell: boolean }) => {
    const p = patrons.get(socket.id);
    if (p) {
      p.atWell = !!payload?.atWell;
      patrons.set(socket.id, p);
      broadcastPatrons(defaultRoom);
    }
  });

  socket.on("hall:announce_deed", (deed: Record<string, unknown>) => {
    const patron = patrons.get(socket.id);
    pushDeed(defaultRoom, {
      ts: Date.now(),
      ...deed,
      from: patron?.name ?? (typeof deed.from === "string" ? deed.from : undefined) ?? "A patron",
    });
  });

  socket.on(
    "moonwell:fishing",
    (payload: {
      phase?: string;
      castPower?: number;
      biteOpen?: boolean;
      reelProgress?: number;
    }) => {
      const p = patrons.get(socket.id);
      if (!p) return;
      io.to(defaultRoom).emit("moonwell:fishing", {
        ts: Date.now(),
        from: p.name,
        phase: payload?.phase ?? "idle",
        castPower: payload?.castPower,
        biteOpen: payload?.biteOpen,
        reelProgress: payload?.reelProgress,
      });
    },
  );

  socket.on(
    "moonwell:chance",
    (payload: {
      phase?: string;
      game?: string;
      cards?: Array<{ label: string; rank: number; suit: string }>;
      target?: number;
      outcome?: string;
      stake?: number;
      tokens?: number;
    }) => {
      const p = patrons.get(socket.id);
      if (!p) return;
      if (typeof payload?.tokens === "number") {
        p.tokens = Math.max(0, payload.tokens);
        patrons.set(socket.id, p);
      }
      io.to(defaultRoom).emit("moonwell:chance", {
        ts: Date.now(),
        from: p.name,
        phase: payload?.phase ?? "idle",
        game: payload?.game,
        cards: payload?.cards,
        target: payload?.target,
        outcome: payload?.outcome,
        stake: payload?.stake,
        tokens: payload?.tokens ?? p.tokens,
        title: p.title,
      });
    },
  );

  socket.on("disconnect", () => {
    patrons.delete(socket.id);
    broadcastPatrons(defaultRoom);
  });
});

httpServer
  .listen(PORT, () => {
    console.log(`[trail] Moonwell hall listening on :${PORT} (polling+websocket)`);
  })
  .on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[trail] Port ${PORT} is already in use (another trail server?). Stop it or set TRAIL_PORT in .env — Windows: netstat -ano | findstr :${PORT} then taskkill /PID <pid> /F`,
      );
    } else {
      console.error("[trail] Server error:", err.message);
    }
    process.exit(1);
  });
