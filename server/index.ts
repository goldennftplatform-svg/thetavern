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

function broadcastPatrons(room: string) {
  const list = [...patrons.values()].filter((p) => p.atWell);
  io.to(room).emit("moonwell:patrons", { patrons: list });
}

function pushDeed(room: string, deed: Record<string, unknown>) {
  io.to(room).emit("hall:deed", deed);
}

io.on("connection", (socket) => {
  const defaultRoom = "moonwell";

  socket.on("tavern:join", (payload: { name?: string; projector?: boolean }) => {
    const name = (payload?.name ?? `Angler ${socket.id.slice(0, 4)}`).slice(0, 32);
    const atWell = !payload?.projector;
    patrons.set(socket.id, { id: socket.id, name, atWell });
    void socket.join(defaultRoom);
    broadcastPatrons(defaultRoom);
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

  socket.on("disconnect", () => {
    patrons.delete(socket.id);
    broadcastPatrons(defaultRoom);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[trail] Moonwell hall listening on :${PORT} (polling+websocket)`);
});
