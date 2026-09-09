import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { ONLINE_WINDOW_SECONDS, PresenceService } from "./presence.service";

describe("PresenceService.isOnline", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  it("is online inside the window and offline outside it", () => {
    const inside = new Date(now.getTime() - (ONLINE_WINDOW_SECONDS - 1) * 1000);
    const outside = new Date(now.getTime() - (ONLINE_WINDOW_SECONDS + 1) * 1000);
    expect(PresenceService.isOnline(inside, now)).toBe(true);
    expect(PresenceService.isOnline(outside, now)).toBe(false);
  });
  it("treats never-seen members as offline", () => {
    expect(PresenceService.isOnline(null, now)).toBe(false);
    expect(PresenceService.isOnline(undefined, now)).toBe(false);
  });
});

describe("PresenceService.touch", () => {
  it("issues a single throttled update and never throws", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const svc = new PresenceService({ execute } as unknown as Db);
    expect(() => svc.touch("u1")).not.toThrow();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("swallows database failures so a heartbeat can never fail a request", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("db down"));
    const svc = new PresenceService({ execute } as unknown as Db);
    expect(() => svc.touch("u1")).not.toThrow();
    // Let the rejected promise settle inside the service's catch.
    await new Promise((r) => setTimeout(r, 0));
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
