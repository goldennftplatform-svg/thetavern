import { io, type Socket } from "socket.io-client";
import type { TrailResolutionSource } from "./trailResolve";

export type TrailClient = {
  socket: Socket | null;
  trailUrl: string;
  source: TrailResolutionSource | "offline";
};

/**
 * Polling-first, then websocket upgrade — friendlier through Cloudflare tunnels / strict proxies.
 */
export async function connectTrail(
  trailUrl: string,
  source: TrailResolutionSource,
  opts: { name: string; projector?: boolean },
): Promise<TrailClient> {
  if (!trailUrl) {
    return { socket: null, trailUrl: "", source: "offline" };
  }

  const socket = io(trailUrl, {
    transports: ["polling", "websocket"],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 800,
  });

  const join = () => socket.emit("tavern:join", { name: opts.name, projector: opts.projector });
  socket.on("connect", join);

  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("trail timeout")), 12000);
    socket.once("connect", () => {
      window.clearTimeout(t);
      resolve();
    });
    socket.once("connect_error", (err) => {
      window.clearTimeout(t);
      reject(err);
    });
  });

  return { socket, trailUrl, source };
}
