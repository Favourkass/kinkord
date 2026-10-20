// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

function worker() {
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const stored = new Map<string, Response>();
  const set = vi.fn(async () => undefined),
    clear = vi.fn(async () => undefined);
  const fetch = vi.fn(async () => new Response(JSON.stringify({ count: 4 })));
  const cache = {
    match: async (key: string) => stored.get(key)?.clone(),
    put: async (key: string, value: Response) => {
      stored.set(key, value);
    },
    delete: async (key: string) => stored.delete(key),
  };
  const self = {
    location: { origin: "https://kinkord.test" },
    navigator: { setAppBadge: set, clearAppBadge: clear },
    addEventListener: (name: string, fn: (event: Record<string, unknown>) => void) =>
      handlers.set(name, fn),
    clients: { matchAll: async () => [] },
    registration: { showNotification: vi.fn(async () => undefined) },
  };
  runInNewContext(readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"), {
    self,
    URL,
    Response,
    fetch,
    caches: { open: async () => cache },
  });
  async function event(name: string, data: unknown) {
    const work: Promise<unknown>[] = [];
    handlers.get(name)!({
      data,
      source: { url: "https://kinkord.test/home" },
      waitUntil: (p: Promise<unknown>) => work.push(p),
    });
    await Promise.all(work);
  }
  return { event, fetch, set, clear };
}
it("fetches authoritative launcher counts on push, including when no page is open", async () => {
  const w = worker();
  await w.event("message", {
    type: "kinkord:app-badge",
    url: "https://api.kinkord.test/notifications/app-badge-count",
    count: 99,
  });
  expect(w.set).toHaveBeenLastCalledWith(4);
  w.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ count: 0 })));
  await w.event("push", { json: () => ({ title: "New activity", url: "/notifications" }) });
  expect(w.clear).toHaveBeenCalledOnce();
});
it("clears the launcher on logout and drops the stored authenticated endpoint", async () => {
  const w = worker();
  await w.event("message", {
    type: "kinkord:app-badge",
    url: "https://api.kinkord.test/notifications/app-badge-count",
  });
  await w.event("message", { type: "kinkord:app-badge", url: null, count: 0 });
  w.fetch.mockClear();
  await w.event("push", { json: () => ({ title: "Activity" }) });
  expect(w.fetch).not.toHaveBeenCalled();
  expect(w.clear).toHaveBeenCalledOnce();
});
