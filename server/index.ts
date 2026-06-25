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

type Patron = { id: string; name: string; atWell: boolean };

const patrons = new Map<string, Patron>();

function patronSnapshot() {
  return [...patrons.values()].filter((p) => p.atWell);
}

function broadcastPatrons(room: string) {
  const list = patronSnapshot();
  io.to(room).emit("moonwell:patrons", { patrons: list });
}

function sendPatronsTo(socket: import("socket.io").Socket) {
  socket.emit("moonwell:patrons", { patrons: patronSnapshot() });
}

function pushDeed(room: string, deed: Record<string, unknown>) {
  io.to(room).emit("hall:deed", deed);
}

io.on("connection", (socket) => {
  const defaultRoom = "moonwell";

  socket.on("tavern:join", async (payload: { name?: string; projector?: boolean }) => {
    const name = (payload?.name ?? `Angler ${socket.id.slice(0, 4)}`).slice(0, 32);
    const atWell = !payload?.projector;
    patrons.set(socket.id, { id: socket.id, name, atWell });
    await socket.join(defaultRoom);
    sendPatronsTo(socket);
    socket.to(defaultRoom).emit("moonwell:patrons", { patrons: patronSnapshot() });
    socket.emit("tavern:welcome", { room: defaultRoom, name });
  });

  socket.on("moonwell:presence", (payload: { atWell: boolean }) => {
    const p = patrons.get(socket.id);
    if (p) {
      p.atWell = !!payload?.atWell;
      patrons.set(socket.id, p);
      broadcastPatrons(defaultRoom);
    }
  });

  socket.on("hall:announce_deed", (deed: Record<string, unknown>) => {
    pushDeed(defaultRoom, {
      ts: Date.now(),
      ...deed,
      from: patrons.get(socket.id)?.name,
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
    }) => {
      const p = patrons.get(socket.id);
      if (!p) return;
      io.to(defaultRoom).emit("moonwell:chance", {
        ts: Date.now(),
        from: p.name,
        phase: payload?.phase ?? "idle",
        game: payload?.game,
        cards: payload?.cards,
        target: payload?.target,
        outcome: payload?.outcome,
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
