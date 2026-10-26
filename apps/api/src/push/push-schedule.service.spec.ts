import { afterEach, describe, expect, it, vi } from "vitest";
import { pushSent } from "../db/schema";
import { PushScheduleService } from "./push-schedule.service";

/** Each `await` on the Drizzle chain takes the next queued answer; calls are recorded. */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  return { db: chain() as never, calls };
}

/** 14:00 in Lagos: daytime. */
const day = new Date("2026-10-26T13:00:00Z");
afterEach(() => vi.restoreAllMocks());

describe("PushScheduleService", () => {
  it("reads the member's switches, zone, last push of the type and today's bundled count", async () => {
    const lastLike = new Date("2026-10-26T12:30:00Z");
    const { db } = queuedDb([
      [{ off: ["follows"], country: "KE", state: "Nairobi" }],
      [{ at: lastLike }],
      [{ n: 3 }],
    ]);
    const state = await new PushScheduleService(db).state("u1", "like");
    expect(state).toEqual({
      off: new Set(["follows"]),
      timeZone: "Africa/Nairobi",
      lastSentOfType: lastLike,
      bundledSentToday: 3,
    });
  });

  it("treats a member with no profile or switches as Lagos, everything on", async () => {
    const { db } = queuedDb([[], [{ at: null }], [{ n: 0 }]]);
    const state = await new PushScheduleService(db).state("u1", "comment");
    expect(state).toEqual({
      off: new Set(),
      timeZone: "Africa/Lagos",
      lastSentOfType: null,
      bundledSentToday: 0,
    });
  });

  it("decides from that state: a like half an hour after the last one waits", async () => {
    const { db } = queuedDb([
      [{ off: [], country: "NG", state: "Lagos" }],
      [{ at: new Date("2026-10-26T12:30:00Z") }],
      [{ n: 1 }],
    ]);
    await expect(new PushScheduleService(db).decide("u1", "like", day)).resolves.toBe("hold");
  });

  it("records each push sent, and now and then clears rows older than two days", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { db, calls } = queuedDb([undefined, undefined]);
    await new PushScheduleService(db).recordSent("u1", "follow");
    expect(calls.find((c) => c.op === "insert")?.args[0]).toBe(pushSent);
    expect(calls.find((c) => c.op === "values")?.args[0]).toEqual({ userId: "u1", type: "follow" });
    expect(calls.some((c) => c.op === "delete")).toBe(true);
  });
});
