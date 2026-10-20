import { describe, expect, it } from "vitest";
import { memberSubscription } from "../db/schema";
import { giveSilver, silverGiven, takeBackSilver } from "./given-silver";
import { FOUNDER_SILVER_UNTIL } from "./plans";

/** Each `await` takes the next queued answer; the calls are kept to check what was written. */
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
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = calls.findIndex((c) => c.op === anchor && c.args[0] === table);
    return start < 0 ? undefined : calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: chain() as never, calls, after, left: () => queue.length };
}

const NOW = new Date("2026-10-20T12:00:00Z");
const PAID_END = new Date("2026-11-06T12:00:00Z");

describe("silverGiven", () => {
  it("is Silver with a founder recorded as the giver, or Silver for good", () => {
    expect(silverGiven({ end: FOUNDER_SILVER_UNTIL, grantedBy: "u1" })).toBe(true);
    expect(silverGiven({ end: FOUNDER_SILVER_UNTIL, grantedBy: null })).toBe(true);
    expect(silverGiven({ end: PAID_END, grantedBy: null })).toBe(false);
  });
});

describe("giveSilver", () => {
  it("puts an admin on Basic onto Silver for good, starting now", async () => {
    const { db, after, left } = queuedDb([[], undefined]);
    await expect(giveSilver(db, "u7", "u1", NOW)).resolves.toBe(true);
    expect(after("insert", memberSubscription, "values")).toEqual({
      userId: "u7",
      plan: "silver",
      currentPeriodEnd: FOUNDER_SILVER_UNTIL,
      grantedBy: "u1",
      startedAt: NOW,
      updatedAt: NOW,
    });
    expect(after("insert", memberSubscription, "onConflictDoUpdate")).toMatchObject({
      set: { paidUntil: null, startedAt: NOW },
    });
    expect(left()).toBe(0);
  });

  it("sets aside the paid time an admin still has, keeps their start date and shows a held check", async () => {
    const { db, after } = queuedDb([[{ end: PAID_END, grantedBy: null }], undefined]);
    await giveSilver(db, "u7", "u1", NOW);
    const { set } = after("insert", memberSubscription, "onConflictDoUpdate") as {
      set: Record<string, unknown>;
    };
    expect(set).toMatchObject({
      currentPeriodEnd: FOUNDER_SILVER_UNTIL,
      grantedBy: "u1",
      paidUntil: PAID_END,
      checkHeldAt: null,
      checkHoldReason: null,
    });
    expect(set).not.toHaveProperty("startedAt");
  });

  it("starts over for an admin whose paid Silver ran out", async () => {
    const lapsed = new Date("2026-09-01T00:00:00Z");
    const { db, after } = queuedDb([[{ end: lapsed, grantedBy: null }], undefined]);
    await giveSilver(db, "u7", "u1", NOW);
    expect(after("insert", memberSubscription, "onConflictDoUpdate")).toMatchObject({
      set: { paidUntil: null, startedAt: NOW },
    });
  });

  it("changes nothing for an admin who already has it from the founders", async () => {
    const { db, calls } = queuedDb([[{ end: FOUNDER_SILVER_UNTIL, grantedBy: "u2" }]]);
    await expect(giveSilver(db, "u7", "u1", NOW)).resolves.toBe(false);
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });
});

describe("takeBackSilver", () => {
  it("ends given Silver now when there's no paid time to go back to", async () => {
    const { db, after, left } = queuedDb([
      [{ end: FOUNDER_SILVER_UNTIL, grantedBy: "u1", paidUntil: null }],
      undefined,
    ]);
    await expect(takeBackSilver(db, "u7", NOW)).resolves.toBe(true);
    expect(after("update", memberSubscription, "set")).toEqual({
      currentPeriodEnd: NOW,
      grantedBy: null,
      paidUntil: null,
      updatedAt: NOW,
    });
    expect(left()).toBe(0);
  });

  it("gives back the paid time set aside, so nobody loses what they paid for", async () => {
    const { db, after } = queuedDb([
      [{ end: FOUNDER_SILVER_UNTIL, grantedBy: "u1", paidUntil: PAID_END }],
      undefined,
    ]);
    await takeBackSilver(db, "u7", NOW);
    expect(after("update", memberSubscription, "set")).toMatchObject({
      currentPeriodEnd: PAID_END,
      grantedBy: null,
    });
  });

  it("ignores paid time that ran out while Silver was given", async () => {
    const { db, after } = queuedDb([
      [{ end: FOUNDER_SILVER_UNTIL, grantedBy: "u1", paidUntil: new Date("2026-10-01T00:00:00Z") }],
      undefined,
    ]);
    await takeBackSilver(db, "u7", NOW);
    expect(after("update", memberSubscription, "set")).toMatchObject({ currentPeriodEnd: NOW });
  });

  it("never touches Silver an admin paid for, or a member on Basic", async () => {
    for (const row of [[{ end: PAID_END, grantedBy: null, paidUntil: null }], []]) {
      const { db, calls } = queuedDb([row]);
      await expect(takeBackSilver(db, "u7", NOW)).resolves.toBe(false);
      expect(calls.some((c) => c.op === "update")).toBe(false);
    }
  });
});
