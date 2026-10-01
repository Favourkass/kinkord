/**
 * The live chat connection. One per tab, shared by every screen listening:
 * it opens with the first listener and closes after the last. While it's down
 * the screens keep polling, and it retries with backoff. If live chat is off
 * on the server, it stays closed and they just poll.
 */
import {
  connectionProtocols,
  eventsFromFrame,
  type RealtimeConnectionPM,
  type RealtimeEventPM,
} from "@/domain/realtime";
import { api } from "./apiClient";

type EventListener = (e: RealtimeEventPM) => void;
type StatusListener = (live: boolean) => void;

/** The bits of a WebSocket this uses, so tests can stand one in. */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface RealtimeDeps {
  getConnection: () => Promise<RealtimeConnectionPM>;
  openSocket: (url: string, protocols: string[]) => SocketLike;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (id: unknown) => void;
}

/** Waits before reconnecting, longer each time in a row it fails. */
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
/** How long without a keep-alive means the line is dead, if AppSync's ack doesn't say. */
const DEFAULT_KEEPALIVE_TIMEOUT_MS = 300_000;
/** One subscription per connection: the member's own channel. */
const SUBSCRIPTION_ID = "chat";

export function createRealtimeClient(deps: RealtimeDeps) {
  const eventListeners = new Set<EventListener>();
  const statusListeners = new Set<StatusListener>();
  let socket: SocketLike | null = null;
  let live = false;
  let failures = 0;
  let reconnectTimer: unknown = null;
  let keepAliveTimer: unknown = null;
  // Bumped on every connect and teardown, so callbacks from an old socket
  // can't act on the new one.
  let generation = 0;

  const setLive = (next: boolean) => {
    if (live === next) return;
    live = next;
    statusListeners.forEach((l) => l(live));
  };

  const clearTimer = (id: unknown) => {
    if (id !== null) deps.clearTimer(id);
  };

  const teardown = () => {
    generation++;
    clearTimer(keepAliveTimer);
    keepAliveTimer = null;
    const old = socket;
    socket = null;
    if (old) {
      old.onopen = old.onmessage = old.onclose = old.onerror = null;
      try {
        old.close();
      } catch {
        // Already closed.
      }
    }
    setLive(false);
  };

  const scheduleReconnect = () => {
    if (eventListeners.size === 0 || reconnectTimer !== null) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(failures, RECONNECT_DELAYS_MS.length - 1)];
    failures++;
    reconnectTimer = deps.setTimer(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  const fail = () => {
    teardown();
    scheduleReconnect();
  };

  async function connect(): Promise<void> {
    teardown();
    const mine = generation;
    let conn: RealtimeConnectionPM;
    try {
      conn = await deps.getConnection();
    } catch {
      if (mine === generation) scheduleReconnect();
      return;
    }
    if (mine !== generation || eventListeners.size === 0 || !conn.enabled) return;

    const ws = deps.openSocket(conn.url, connectionProtocols(conn));
    socket = ws;
    let keepAliveMs = DEFAULT_KEEPALIVE_TIMEOUT_MS;
    const armKeepAlive = () => {
      clearTimer(keepAliveTimer);
      keepAliveTimer = deps.setTimer(() => {
        if (mine === generation) fail();
      }, keepAliveMs);
    };

    ws.onopen = () => ws.send(JSON.stringify({ type: "connection_init" }));
    ws.onmessage = (m) => {
      if (mine !== generation) return;
      let frame: { type?: string; connectionTimeoutMs?: number };
      try {
        frame = JSON.parse(String(m.data));
      } catch {
        return;
      }
      switch (frame.type) {
        case "connection_ack":
          keepAliveMs = frame.connectionTimeoutMs ?? DEFAULT_KEEPALIVE_TIMEOUT_MS;
          armKeepAlive();
          ws.send(
            JSON.stringify({
              type: "subscribe",
              id: SUBSCRIPTION_ID,
              channel: conn.channel,
              authorization: { Authorization: conn.token, host: conn.host },
            }),
          );
          break;
        case "ka":
          armKeepAlive();
          break;
        case "subscribe_success":
          failures = 0;
          setLive(true);
          break;
        case "data":
          for (const e of eventsFromFrame(frame)) eventListeners.forEach((l) => l(e));
          break;
        case "subscribe_error":
        case "connection_error":
        case "error":
          fail();
          break;
      }
    };
    ws.onerror = () => {
      if (mine === generation) fail();
    };
    ws.onclose = () => {
      if (mine === generation) fail();
    };
  }

  return {
    /** Hears events and live/offline changes until the returned function is called. */
    listen(onEvent: EventListener, onStatus: StatusListener): () => void {
      eventListeners.add(onEvent);
      statusListeners.add(onStatus);
      onStatus(live);
      if (eventListeners.size === 1) {
        failures = 0;
        void connect();
      }
      return () => {
        eventListeners.delete(onEvent);
        statusListeners.delete(onStatus);
        if (eventListeners.size === 0) {
          clearTimer(reconnectTimer);
          reconnectTimer = null;
          teardown();
        }
      };
    },

    /** Retry now rather than after the backoff: the tab came back, or the network did. */
    wake(): void {
      if (eventListeners.size === 0 || live || reconnectTimer === null) return;
      clearTimer(reconnectTimer);
      reconnectTimer = null;
      failures = 0;
      void connect();
    },
  };
}

export const realtime = createRealtimeClient({
  getConnection: () => api.get<RealtimeConnectionPM>("/chat/realtime"),
  openSocket: (url, protocols) => new WebSocket(url, protocols) as unknown as SocketLike,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
});

if (typeof window !== "undefined") {
  window.addEventListener("online", () => realtime.wake());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") realtime.wake();
  });
}
