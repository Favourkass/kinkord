import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker(windows: unknown[] = []) {
  const handlers = new Map<string, (event: unknown) => void>();
  const showNotification = vi.fn();
  const openWindow = vi.fn();
  const self = {
    location: { origin: "https://kinkord.test" },
    addEventListener: (name: string, fn: (event: unknown) => void) => handlers.set(name, fn),
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL, encodeURIComponent });
  const dispatch = async (name: string, properties: object) => {
    let pending: Promise<unknown> | undefined;
    handlers.get(name)!({
      ...properties,
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;
  };
  return { dispatch, showNotification, openWindow, matchAll: self.clients.matchAll };
}

describe("notification service worker", () => {
  it("retains the inbox id and refreshes open tabs when a push arrives", async () => {
    const client = {
      visibilityState: "hidden",
      url: "https://kinkord.test/home",
      postMessage: vi.fn(),
    };
    const w = worker([client]);
    await w.dispatch("push", {
      data: {
        json: () => ({
          title: "Kinkord",
          body: "New message from Ada",
          url: "/messages/c1",
          tag: "chat-c1",
          notificationId: "n1",
        }),
      },
    });
    expect(client.postMessage).toHaveBeenCalledWith({ type: "kinkord:notification" });
    expect(w.showNotification).toHaveBeenCalledWith(
      "Kinkord",
      expect.objectContaining({
        data: { url: "https://kinkord.test/messages/c1", notificationId: "n1" },
        icon: "/icons/push-icon-v2.png",
        badge: "/icons/badge-96x96.png",
        tag: "notification-n1",
        renotify: true,
        silent: false,
        vibrate: [200, 100, 200],
      }),
    );
  });
  it("alerts even while the recipient is watching the destination", async () => {
    const client = {
      visibilityState: "visible",
      url: "https://kinkord.test/messages/c1",
      postMessage: vi.fn(),
    };
    const w = worker([client]);
    await w.dispatch("push", { data: { json: () => ({ url: "/messages/c1" }) } });
    expect(client.postMessage).toHaveBeenCalled();
    expect(w.showNotification).toHaveBeenCalledWith(
      "Kinkord",
      expect.objectContaining({ silent: false, renotify: false }),
    );
  });
  it("keeps successive messages in the same conversation as separate device alerts", async () => {
    const w = worker();
    for (const notificationId of ["n1", "n2"]) {
      await w.dispatch("push", {
        data: { json: () => ({ url: "/messages/c1", tag: "chat-c1", notificationId }) },
      });
    }
    expect(w.showNotification.mock.calls.map((call) => call[1].tag)).toEqual([
      "notification-n1",
      "notification-n2",
    ]);
  });
  it("does not collapse older pushes without an inbox id into one chat tag", async () => {
    const w = worker();
    await w.dispatch("push", { data: { json: () => ({ tag: "chat-c1" }) } });
    expect(w.showNotification).toHaveBeenCalledWith(
      "Kinkord",
      expect.objectContaining({ tag: undefined, renotify: false, silent: false }),
    );
  });
  it("still displays the alert when refreshing browser clients fails", async () => {
    const w = worker();
    w.matchAll.mockRejectedValueOnce(new Error("Clients unavailable"));
    await w.dispatch("push", { data: { json: () => ({ notificationId: "n1" }) } });
    expect(w.showNotification).toHaveBeenCalledTimes(1);
  });
  it("routes an OS click through the inbox so the server can mark it read", async () => {
    const w = worker();
    const close = vi.fn();
    await w.dispatch("notificationclick", {
      notification: {
        close,
        data: { url: "https://kinkord.test/messages/c1", notificationId: "n1" },
      },
    });
    expect(close).toHaveBeenCalled();
    expect(w.openWindow).toHaveBeenCalledWith("https://kinkord.test/notifications?open=n1");
  });
  it("still opens older pushes without an inbox id", async () => {
    const w = worker();
    await w.dispatch("notificationclick", {
      notification: { close: vi.fn(), data: { url: "https://kinkord.test/messages/c1" } },
    });
    expect(w.openWindow).toHaveBeenCalledWith("https://kinkord.test/messages/c1");
  });
});
