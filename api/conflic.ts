import { ConflicRoomManager, type ConflicRoomsSnapshot } from "../server/conflicRooms.js";
import {
  CONFLIC_TABLE_IDS,
  type ConflicCommandResult,
  type ConflicJoinResult,
  type ConflicPlacement,
  type ConflicTableId,
} from "../src/net/conflicProtocol.js";

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
};

type StoredState = { revision: number; state: ConflicRoomsSnapshot | null };
type Body = Record<string, unknown>;

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const stateEndpoint = `${supabaseUrl}/rest/v1/conflic_state`;

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function failure(message: string): ConflicCommandResult {
  return { ok: false, error: "INVALID_PAYLOAD", message };
}

function tableId(value: unknown): ConflicTableId | null {
  return typeof value === "string" && CONFLIC_TABLE_IDS.includes(value as ConflicTableId)
    ? value as ConflicTableId
    : null;
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined;
}

async function readState(): Promise<StoredState> {
  const response = await fetch(`${stateEndpoint}?id=eq.global&select=revision,state`, {
    headers: headers(),
  });
  if (!response.ok) throw new Error(`Supabase state read failed (${response.status})`);
  const rows = await response.json() as StoredState[];
  if (!rows[0]) throw new Error("Supabase Conflic migration has not been applied");
  return rows[0];
}

async function commitState(previousRevision: number, manager: ConflicRoomManager): Promise<boolean> {
  const response = await fetch(
    `${stateEndpoint}?id=eq.global&revision=eq.${previousRevision}&select=revision`,
    {
      method: "PATCH",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify({
        revision: previousRevision + 1,
        state: manager.snapshot(),
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!response.ok) throw new Error(`Supabase state write failed (${response.status})`);
  return ((await response.json()) as unknown[]).length === 1;
}

async function mutate<T>(operation: (manager: ConflicRoomManager) => T): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stored = await readState();
    const manager = new ConflicRoomManager(stored.state);
    const result = operation(manager);
    if (typeof result === "object" && result && "ok" in result && !(result as { ok: boolean }).ok) return result;
    if (await commitState(stored.revision, manager)) return result;
  }
  throw new Error("Conflic table was busy; retry the action");
}

async function lobby() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stored = await readState();
    const manager = new ConflicRoomManager(stored.state);
    if (manager.expireStale() === 0 || await commitState(stored.revision, manager)) return manager.lobby();
  }
  throw new Error("Conflic tables were busy; retry the lobby");
}

function parseBody(raw: unknown): Body {
  if (raw && typeof raw === "object") return raw as Body;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? parsed as Body : {};
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "POST required" });
    return;
  }
  if (!supabaseUrl || !serviceKey) {
    res.status(503).json({ ok: false, message: "Supabase environment variables are missing" });
    return;
  }

  const body = parseBody(req.body);
  const action = text(body.action, 24);
  try {
    if (action === "lobby") {
      res.status(200).json({ ok: true, rooms: await lobby() });
      return;
    }

    const id = tableId(body.tableId);
    if (!id) {
      res.status(200).json({ ok: false, error: "INVALID_TABLE", message: "Unknown Conflic table" });
      return;
    }

    if (action === "join") {
      const playerId = text(body.playerId, 64);
      const name = text(body.name, 32);
      if (!playerId || !name) {
        res.status(200).json(failure("playerId and name are required"));
        return;
      }
      const result = await mutate<ConflicJoinResult>((manager) => manager.join({
        tableId: id,
        playerId,
        name,
        avatarId: text(body.avatarId, 24),
        resumeToken: text(body.resumeToken, 128),
        clientId: playerId,
      }));
      res.status(200).json(result);
      return;
    }

    const resumeToken = text(body.resumeToken, 128);
    if (!resumeToken) {
      res.status(200).json(failure("resumeToken is required"));
      return;
    }
    if (action === "state") {
      const stored = await readState();
      const state = new ConflicRoomManager(stored.state).viewForToken(id, resumeToken);
      res.status(200).json(state ? { ok: true, state } : { ok: false, error: "NOT_SEATED", message: "Seat was not found" });
      return;
    }
    if (action === "heartbeat") {
      res.status(200).json(await mutate((manager) => manager.heartbeat(id, resumeToken)));
      return;
    }
    if (action === "leave") {
      res.status(200).json(await mutate((manager) => manager.leave(id, resumeToken)));
      return;
    }
    if (action === "deploy") {
      if (!Array.isArray(body.ships)) {
        res.status(200).json(failure("ships are required"));
        return;
      }
      res.status(200).json(await mutate((manager) => manager.submitFleet(id, resumeToken, body.ships as ConflicPlacement[])));
      return;
    }
    if (action === "fire") {
      const x = body.x;
      const y = body.y;
      const actionId = text(body.actionId, 64);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !actionId) {
        res.status(200).json(failure("integer x, integer y, and actionId are required"));
        return;
      }
      res.status(200).json(await mutate((manager) => manager.fire(id, resumeToken, x as number, y as number, actionId)));
      return;
    }
    res.status(200).json(failure("Unknown action"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conflic service failed";
    res.status(503).json({ ok: false, message });
  }
}
