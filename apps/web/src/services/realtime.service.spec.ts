import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RealtimeConnectionPM } from "@/domain/realtime";

vi.mock("./apiClient", () => ({ api: { get: vi.fn() } }));

import {
  createRealtimeClient,
  RECONNECT_DELAYS_MS,
  type RealtimeDeps,
  type SocketLike,
} from "./realtime.service";

class FakeSocket implements SocketLike {
  sent: unknown[] = [];
  closed = false;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {}
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
  /** AppSync talking back. */
  frame(f: unknown) {
    this.onmessage?.({ data: JSON.stringify(f) });
  }
}

const CONN: RealtimeConnectionPM = {
  enabled: true,
  url: "wss://abc.appsync-realtime-api.eu-west-1.amazonaws.com/event/realtime",
  host: "abc.appsync-api.eu-west-1.amazonaws.com",
  channel: "/chat/u1",
  token: "v1.a.b",
  expiresAt: "2026-10-01T12:10:00.000Z",
};

function setup(conn: RealtimeConnectionPM = CONN) {
  const sockets: FakeSocket[] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 1;
  const getConnection = vi.fn(async () => conn);
  const deps: RealtimeDeps = {
    getConnection,
    openSocket: (url, protocols) => {
      const s = new FakeSocket(url, protocols);
      sockets.push(s);
      return s;
    },
    setTimer: (fn, ms) => {
      const id = nextTimer++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id) => void timers.delete(id as number),
  };
  const client = createRealtimeClient(deps);
  const runTimer = (ms: number) => {
    const entry = [...timers.entries()].find(([, t]) => t.ms === ms);
    if (!entry) throw new Error(`no ${ms}ms timer pending`);
    timers.delete(entry[0]);
    entry[1].fn();
  };
  return { client, sockets, timers, runTimer, getConnection };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/** Opens, acks and subscribes the newest socket, the way AppSync does. */
function goLive(socket: FakeSocket) {
  socket.onopen?.({});
  socket.frame({ type: "connection_ack", connectionTimeoutMs: 300_000 });
  socket.frame({ type: "subscribe_success", id: "chat" });
}

describe("realtime client", () => {
  let events: unknown[];
  let statuses: boolean[];
  beforeEach(() => {
    events = [];
    statuses = [];
  });
  const listen = (client: ReturnType<typeof setup>["client"]) =>
    client.listen(
      (e) => events.push(e),
      (live) => statuses.push(live),
    );

  it("connects with AppSync's handshake, then subscribes to the member's channel", async () => {
    const { client, sockets } = setup();
    listen(client);
    await flush();
    const [ws] = sockets;
    expect(ws.url).toBe(CONN.url);
    expect(ws.protocols[0]).toBe("aws-appsync-event-ws");
    expect(ws.protocols[1]).toMatch(/^header-/);

    ws.onopen?.({});
    expect(ws.sent).toEqual([{ type: "connection_init" }]);
    ws.frame({ type: "connection_ack", connectionTimeoutMs: 300_000 });
    expect(ws.sent[1]).toEqual({
      type: "subscribe",
      id: "chat",
      channel: "/chat/u1",
      authorization: { Authorization: "v1.a.b", host: CONN.enabled ? CONN.host : "" },
    });
    expect(statuses).toEqual([false]);
    ws.frame({ type: "subscribe_success", id: "chat" });
    expect(statuses).toEqual([false, true]);
  });

  it("passes our events on to every listener", async () => {
    const { client, sockets } = setup();
    listen(client);
    const second: unknown[] = [];
    client.listen(
      (e) => second.push(e),
      () => undefined,
    );
    await flush();
    goLive(sockets[0]);
    sockets[0].frame({
      type: "data",
      id: "chat",
      event: JSON.stringify({ type: "message", conversationId: "c1" }),
    });
    expect(events).toEqual([{ type: "message", conversationId: "c1" }]);
    expect(second).toEqual(events);
    expect(sockets).toHaveLength(1); // one connection, however many listen
  });

  it("drops to offline and reconnects with growing backoff when the line drops", async () => {
    const { client, sockets, runTimer, getConnection } = setup();
    listen(client);
    await flush();
    goLive(sockets[0]);

    sockets[0].onclose?.({});
    expect(statuses.at(-1)).toBe(false);
    runTimer(RECONNECT_DELAYS_MS[0]);
    await flush();
    expect(getConnection).toHaveBeenCalledTimes(2); // a fresh token each time
    sockets[1].onerror?.({});
    runTimer(RECONNECT_DELAYS_MS[1]);
    await flush();
    goLive(sockets[2]);
    expect(statuses.at(-1)).toBe(true);
  });

  it("treats a missing keep-alive as a dead line", async () => {
    const { client, sockets, runTimer } = setup();
    listen(client);
    await flush();
    goLive(sockets[0]);
    sockets[0].frame({ type: "ka" });
    runTimer(300_000);
    expect(sockets[0].closed).toBe(true);
    expect(statuses.at(-1)).toBe(false);
  });

  it("stays closed, and the screens keep polling, when live chat is off", async () => {
    const { client, sockets, timers } = setup({ enabled: false });
    listen(client);
    await flush();
    expect(sockets).toHaveLength(0);
    expect(timers.size).toBe(0);
    expect(statuses).toEqual([false]);
  });

  it("closes when the last screen stops listening, and retries nothing after", async () => {
    const { client, sockets, timers } = setup();
    const stop = listen(client);
    await flush();
    goLive(sockets[0]);
    stop();
    expect(sockets[0].closed).toBe(true);
    expect(timers.size).toBe(0);
  });

  it("retries at once when woken during a backoff", async () => {
    const { client, sockets, getConnection } = setup();
    listen(client);
    await flush();
    sockets[0].onclose?.({});
    client.wake();
    await flush();
    expect(getConnection).toHaveBeenCalledTimes(2);
    expect(sockets).toHaveLength(2);
  });
});
