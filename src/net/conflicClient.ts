import type {
  ConflicCommandResult,
  ConflicJoinResult,
  ConflicPlacement,
  ConflicPrivateRoomView,
  ConflicRoomSummary,
  ConflicTableId,
} from "./conflicProtocol";

const PLAYER_ID_KEY = "conflic_online_player_id";
const SESSION_KEY = "conflic_online_session";
const API_URL = (import.meta.env.VITE_CONFLIC_API_URL as string | undefined)?.trim() || "/api/conflic";

type StoredSession = { tableId: ConflicTableId; resumeToken: string };
type ApiFailure = { ok: false; error?: string; message: string };

function playerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

function storedSession(): StoredSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Partial<StoredSession> | null;
    return parsed?.tableId && parsed.resumeToken ? parsed as StoredSession : null;
  } catch {
    return null;
  }
}

export class ConflicOnlineClient {
  private name: string;
  private avatarId?: string;
  private session: StoredSession | null = storedSession();
  private latestView: ConflicPrivateRoomView | null = null;
  private onLobby: (rooms: ConflicRoomSummary[]) => void;
  private onState: (view: ConflicPrivateRoomView) => void;
  private onError: (message: string) => void;
  private onConnection: (connected: boolean) => void;
  private onSessionLost: () => void;
  private polling = false;
  private live = false;
  private stateRequest = 0;
  private lastHeartbeat = 0;

  constructor(opts: {
    name: string;
    avatarId?: string;
    onLobby: (rooms: ConflicRoomSummary[]) => void;
    onState: (view: ConflicPrivateRoomView) => void;
    onError: (message: string) => void;
    onConnection: (connected: boolean) => void;
    onSessionLost: () => void;
  }) {
    this.name = opts.name;
    this.avatarId = opts.avatarId;
    this.onLobby = opts.onLobby;
    this.onState = (view) => {
      this.latestView = view;
      opts.onState(view);
    };
    this.onError = opts.onError;
    this.onConnection = opts.onConnection;
    this.onSessionLost = opts.onSessionLost;
    void this.poll();
    window.setInterval(() => void this.poll(), 1500);
  }

  get tableId(): ConflicTableId | null {
    return this.session?.tableId ?? null;
  }

  get view(): ConflicPrivateRoomView | null {
    return this.latestView;
  }

  get connected(): boolean {
    return this.live;
  }

  requestLobby() {
    void this.fetchLobby();
  }

  async join(tableId: ConflicTableId): Promise<ConflicJoinResult> {
    const resumeToken = this.session?.tableId === tableId ? this.session.resumeToken : undefined;
    const result = await this.request<ConflicJoinResult>({
      action: "join",
      tableId,
      playerId: playerId(),
      name: this.name,
      avatarId: this.avatarId,
      resumeToken,
    });
    if (result.ok) {
      this.stateRequest += 1;
      this.session = { tableId, resumeToken: result.resumeToken };
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
      this.onState(result.state);
    } else if (resumeToken && result.error === "INVALID_RESUME_TOKEN") {
      this.clearSession();
    }
    return result;
  }

  async leave(): Promise<ConflicCommandResult | null> {
    if (!this.session) return null;
    const result = await this.request<ConflicCommandResult>({ action: "leave", ...this.session });
    // An explicit exit must stop heartbeats even if the network request fails;
    // the server's stale-seat cleanup will release an unconfirmed leave.
    this.clearSession();
    return result;
  }

  submitFleet(ships: ConflicPlacement[]) {
    if (!this.session) return;
    void this.request<ConflicCommandResult>({ action: "deploy", ...this.session, ships }).then((result) => {
      if (!result.ok) this.onError(result.message);
      else void this.fetchState();
    });
  }

  fire(x: number, y: number) {
    if (!this.session) return;
    void this.request<ConflicCommandResult>({
      action: "fire",
      ...this.session,
      x,
      y,
      actionId: crypto.randomUUID(),
    }).then((result) => {
      if (!result.ok) this.onError(result.message);
      else void this.fetchState();
    });
  }

  async sendChat(message: string): Promise<ConflicCommandResult | null> {
    if (!this.session) return null;
    const result = await this.request<ConflicCommandResult>({
      action: "chat",
      ...this.session,
      message,
      actionId: crypto.randomUUID(),
    });
    if (!result.ok) this.onError(result.message);
    else void this.fetchState();
    return result;
  }

  private async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      if (this.session) {
        if (Date.now() - this.lastHeartbeat > 10_000) await this.heartbeat();
        await this.fetchState();
      }
      else await this.fetchLobby();
    } finally {
      this.polling = false;
    }
  }

  private async fetchLobby() {
    const result = await this.request<{ ok: true; rooms: ConflicRoomSummary[] } | ApiFailure>({ action: "lobby" });
    if (result.ok) this.onLobby(result.rooms);
    else this.onError(result.message);
  }

  private async fetchState() {
    if (!this.session) return;
    const request = ++this.stateRequest;
    const result = await this.request<{ ok: true; state: ConflicPrivateRoomView } | ApiFailure>({
      action: "state",
      ...this.session,
    });
    if (request !== this.stateRequest) return;
    if (result.ok) {
      if (
        this.latestView?.matchId === result.state.matchId
        && this.latestView.revision >= result.state.revision
      ) return;
      this.onState(result.state);
    } else if (result.error === "NOT_SEATED") {
      this.onSessionLost();
      this.clearSession();
    }
    else this.onError(result.message);
  }

  private async heartbeat() {
    if (!this.session) return;
    const result = await this.request<ConflicCommandResult>({ action: "heartbeat", ...this.session });
    if (result.ok) {
      this.lastHeartbeat = Date.now();
    } else if (result.error === "NOT_SEATED") {
      this.onSessionLost();
      this.clearSession();
    }
  }

  private async request<T>(body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
      const result = await response.json() as T;
      this.setConnected(response.ok);
      return result;
    } catch {
      this.setConnected(false);
      return { ok: false, message: "Online tables are temporarily unavailable" } as T;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private setConnected(connected: boolean) {
    if (this.live === connected) return;
    this.live = connected;
    this.onConnection(connected);
  }

  private clearSession() {
    this.stateRequest += 1;
    this.session = null;
    this.latestView = null;
    localStorage.removeItem(SESSION_KEY);
    void this.fetchLobby();
  }
}
