import { describe, expect, it } from "vitest";
import { memberSubscription } from "../db/schema";
import { addSilverTime } from "./silver-time";

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
  const arg = (op: string) => calls.find((c) => c.op === op)?.args[0];
  return { db: chain() as never, calls, arg };
}

const now = new Date("2026-10-27T12:00:00.000Z");

describe("addSilverTime", () => {
  it("starts a month from now for a member without Silver", async () => {
    const { db, arg } = queuedDb([[], undefined]);
    await expect(
      addSilverTime(db, "u1", "silver", "monthly", now, { clearHeldCheck: false }),
    ).resolves.toEqual(new Date("2026-11-27T12:00:00.000Z"));
    expect(arg("insert")).toBe(memberSubscription);
    expect(arg("values")).toEqual({
      userId: "u1",
      plan: "silver",
      currentPeriodEnd: new Date("2026-11-27T12:00:00.000Z"),
      startedAt: now,
    });
    const upsert = arg("onConflictDoUpdate") as { set: Record<string, unknown> };
    // A lapsed run starts over; a held check stays held for a ring.
    expect(upsert.set).toMatchObject({ startedAt: now });
    expect(upsert.set).not.toHaveProperty("checkHeldAt");
  });

  it("runs on from where running Silver ends, keeping the start", async () => {
    const end = new Date("2026-11-10T08:00:00.000Z");
    const { db, arg } = queuedDb([[{ end, grantedBy: null, paidUntil: null }], undefined]);
    await expect(
      addSilverTime(db, "u1", "silver", "monthly", now, { clearHeldCheck: true }),
    ).resolves.toEqual(new Date("2026-12-10T08:00:00.000Z"));
    const upsert = arg("onConflictDoUpdate") as { set: Record<string, unknown> };
    expect(upsert.set).not.toHaveProperty("startedAt");
    // An admin confirming a payment looks at the member as they are now.
    expect(upsert.set).toMatchObject({ checkHeldAt: null, checkHoldReason: null });
  });

  it("adds to the member's own time while the founders' Silver runs", async () => {
    const forGood = new Date("2099-12-31T12:00:00.000Z");
    const { db, arg, calls } = queuedDb([
      [{ end: forGood, grantedBy: "f1", paidUntil: null }],
      undefined,
    ]);
    await expect(
      addSilverTime(db, "u1", "silver", "monthly", now, { clearHeldCheck: false }),
    ).resolves.toEqual(forGood);
    expect(arg("set")).toEqual({ paidUntil: new Date("2026-11-27T12:00:00.000Z"), updatedAt: now });
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });
});
