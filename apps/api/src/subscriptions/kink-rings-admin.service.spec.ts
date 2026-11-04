import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { KinkRingsAdminService, ringStatus, withoutRingMonth } from "./kink-rings-admin.service";
import { silverFrom } from "./silver-time";

/** Answers the two queries in the order they're made: the member's rings, then the ones they got. */
function dbAnswering(...answers: unknown[][]) {
  const queue = [...answers];
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const step of ["from", "leftJoin", "innerJoin", "where", "orderBy"]) c[step] = () => c;
    c.then = (ok: (rows: unknown[]) => unknown) => Promise.resolve(queue.shift() ?? []).then(ok);
    return c;
  };
  return { select: vi.fn(() => chain()) } as unknown as Db;
}

const now = new Date("2026-11-03T12:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
const yearly = {
  paymentId: "pay-1",
  period: "yearly",
  confirmedAt: new Date("2026-10-01T09:00:00Z"),
  createdAt: new Date("2026-10-01T09:00:00Z"),
};
const ring = (seq: number, change: Record<string, unknown> = {}) => ({
  id: `ring-${seq}`,
  seq,
  expiresAt: day(30 * seq - 33),
  givenAt: null,
  givenTo: null,
  revokedAt: null,
  silverCancelledAt: null,
  withNote: false,
  recipientUsername: null,
  recipientName: null,
  ...yearly,
  ...change,
});

describe("ringStatus", () => {
  it("is given once given, cancelled once taken back, else expired past its date, else unused", () => {
    const ring = { givenAt: null, revokedAt: null, expiresAt: day(1) };
    expect(ringStatus({ ...ring, givenAt: day(-40), expiresAt: day(-10) }, now)).toBe("given");
    expect(ringStatus({ ...ring, revokedAt: day(-1) }, now)).toBe("cancelled");
    expect(ringStatus({ ...ring, revokedAt: day(-1), expiresAt: day(-1) }, now)).toBe("cancelled");
    expect(ringStatus({ ...ring, expiresAt: day(-1) }, now)).toBe("expired");
    expect(ringStatus(ring, now)).toBe("unused");
  });
});

describe("KinkRingsAdminService.forMember", () => {
  it("shows a yearly payment's twelve rings: who got them, and when each runs out", async () => {
    const own = [
      ring(1, { expiresAt: day(-3) }),
      ring(2, {
        givenAt: day(-5),
        givenTo: "u2",
        withNote: true,
        recipientUsername: "tega",
        recipientName: "Tega",
      }),
      ...Array.from({ length: 10 }, (_, i) => ring(i + 3)),
    ];
    const service = new KinkRingsAdminService(dbAnswering(own, []));
    const result = await service.forMember("u1", now);
    expect(result.counts).toEqual({
      total: 12,
      unused: 10,
      given: 1,
      expired: 1,
      cancelled: 0,
      received: 0,
    });
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0]).toMatchObject({
      paymentId: "pay-1",
      period: "yearly",
      confirmedAt: "2026-10-01T09:00:00.000Z",
    });
    expect(result.batches[0].rings[1]).toEqual({
      id: "ring-2",
      seq: 2,
      status: "given",
      expiresAt: ring(2).expiresAt.toISOString(),
      givenAt: day(-5).toISOString(),
      recipient: { id: "u2", username: "tega", displayName: "Tega" },
      recipientLeft: false,
      withNote: true,
      silverCancelled: false,
    });
    expect(result.batches[0].rings[0].status).toBe("expired");
  });

  it("lists a payment's rings 1 to 12, whatever order they come in", async () => {
    const own = [ring(3), ring(1), ring(2)];
    const result = await new KinkRingsAdminService(dbAnswering(own, [])).forMember("u1", now);
    expect(result.batches[0].rings.map((r) => r.seq)).toEqual([1, 2, 3]);
  });

  it("keeps Kinkord's rings apart from paid ones, and notices a receiver who left", async () => {
    const own = [
      ring(1),
      {
        ...ring(1, { id: "gift-1", givenAt: day(-2), givenTo: null }),
        paymentId: null,
        period: null,
        confirmedAt: null,
      },
    ];
    const result = await new KinkRingsAdminService(dbAnswering(own, [])).forMember("u1", now);
    expect(result.batches.map((b) => b.paymentId)).toEqual(["pay-1", null]);
    expect(result.batches[1].rings[0]).toMatchObject({
      status: "given",
      recipient: null,
      recipientLeft: true,
    });
  });

  it("lists the rings others gave them", async () => {
    const received = [
      {
        id: "ring-9",
        givenAt: day(-1),
        silverCancelledAt: day(0),
        withNote: false,
        giverId: "u3",
        giverUsername: "dove",
        giverName: "Dove",
      },
    ];
    const result = await new KinkRingsAdminService(dbAnswering([], received)).forMember("u1", now);
    expect(result.counts.received).toBe(1);
    expect(result.received).toEqual([
      {
        id: "ring-9",
        givenAt: day(-1).toISOString(),
        giver: { id: "u3", username: "dove", displayName: "Dove" },
        withNote: false,
        silverCancelled: true,
      },
    ]);
  });
});

describe("silverFrom", () => {
  const at = (iso: string) => new Date(iso);
  it("runs each period on from the last, and starts over after a lapse", () => {
    expect(silverFrom([])).toBeNull();
    expect(
      silverFrom([
        { at: at("2026-03-10T00:00:00Z"), period: "monthly" },
        { at: at("2026-01-01T00:00:00Z"), period: "monthly" },
      ]),
    ).toEqual(at("2026-04-10T00:00:00Z"));
    expect(
      silverFrom([
        { at: at("2026-01-01T00:00:00Z"), period: "yearly" },
        { at: at("2026-03-01T00:00:00Z"), period: "monthly" },
      ]),
    ).toEqual(at("2027-02-01T00:00:00Z"));
  });
});

describe("withoutRingMonth", () => {
  it("ends a month sooner when the ring's month was stacked on paid time", () => {
    // Paid a year to 1 Jan 2027, then a ring: 1 Feb 2027. Without the ring: 1 Jan.
    const paidTo = new Date("2027-01-01T00:00:00Z");
    expect(withoutRingMonth(new Date("2027-02-01T00:00:00Z"), paidTo, now)).toEqual(paidTo);
    // A ring on another ring: one month goes, the other stays.
    expect(withoutRingMonth(new Date("2027-03-01T00:00:00Z"), paidTo, now)).toEqual(
      new Date("2027-02-01T00:00:00Z"),
    );
  });

  it("never takes paid time: a payment after a lapse keeps its whole month", () => {
    // The ring's month ran out before they paid; their Silver now is all paid for.
    expect(withoutRingMonth(day(25), day(25), now)).toEqual(day(25));
  });

  it("puts a member whose Silver was only the ring back on Basic", () => {
    expect(withoutRingMonth(day(20), null, now)).toBeNull();
  });

  it("never ends their Silver later than it ends now", () => {
    expect(withoutRingMonth(day(20), day(60), now)).toEqual(day(20));
  });
});

/** A transaction that answers selects in order and records what's written. */
function txAnswering(...answers: unknown[][]) {
  const queue = [...answers];
  const writes: Array<{ op: string; values?: unknown }> = [];
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const step of ["from", "leftJoin", "innerJoin", "where", "orderBy", "for", "limit"]) {
      c[step] = () => c;
    }
    c.then = (ok: (rows: unknown[]) => unknown) => Promise.resolve(queue.shift() ?? []).then(ok);
    return c;
  };
  const update = () => {
    const entry: { op: string; values?: unknown } = { op: "update" };
    writes.push(entry);
    const c: Record<string, unknown> = {
      set: (values: unknown) => {
        entry.values = values;
        return c;
      },
      where: () => c,
      returning: () => Promise.resolve(queue.shift() ?? []),
      then: (ok: (v: unknown) => unknown) => Promise.resolve(undefined).then(ok),
    };
    return c;
  };
  const tx = {
    select: vi.fn(() => chain()),
    update: vi.fn(update),
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        writes.push({ op: "insert", values });
        return Promise.resolve();
      },
    })),
    execute: vi.fn(async () => undefined),
  };
  const db = { transaction: (run: (t: typeof tx) => unknown) => run(tx) } as unknown as Db;
  return { db, writes };
}

describe("KinkRingsAdminService.cancelUnused", () => {
  it("takes back every ring they still have, and logs who did it and why", async () => {
    const { db, writes } = txAnswering([{ id: "r1" }, { id: "r2" }]);
    const result = await new KinkRingsAdminService(db).cancelUnused("u1", "admin", "Refunded", now);
    expect(result).toEqual({ cancelled: 2 });
    expect(writes[0].values).toEqual({
      revokedAt: now,
      revokedBy: "admin",
      revokeReason: "Refunded",
    });
    expect(writes[1].values).toMatchObject({
      actorId: "admin",
      action: "cancel-kink-rings",
      subjectUserId: "u1",
      detail: "2 rings: Refunded",
    });
  });

  it("says so when they have none left", async () => {
    const { db } = txAnswering([]);
    await expect(
      new KinkRingsAdminService(db).cancelUnused("u1", "admin", "Refunded", now),
    ).rejects.toThrow("no unused Kink Rings");
  });
});

describe("KinkRingsAdminService.cancelSilver", () => {
  const given = { givenTo: "u2", givenAt: day(-5), silverCancelledAt: null };

  it("puts a member whose only Silver was the ring back on Basic", async () => {
    const { db, writes } = txAnswering(
      [given],
      [{ end: day(25), grantedBy: null, paidUntil: null }],
      [],
      [],
    );
    const result = await new KinkRingsAdminService(db).cancelSilver(
      "ring-1",
      "admin",
      "Fraud",
      now,
    );
    expect(result).toEqual({ memberId: "u2", silverUntil: null });
    expect(writes[0].values).toEqual({
      usageCancelledAt: now,
      usageCancelledBy: "admin",
      usageCancelReason: "Fraud",
    });
    expect(writes[1].values).toEqual({ currentPeriodEnd: now, updatedAt: now });
    expect(writes[2].values).toMatchObject({
      action: "cancel-kink-ring-silver",
      subjectUserId: "u2",
    });
  });

  it("keeps the time their own payment bought", async () => {
    // Paid a month 10 days ago (to 24 Nov), then the ring stacked a month on top (to 24 Dec).
    const { db, writes } = txAnswering(
      [given],
      [{ end: new Date("2026-12-24T12:00:00Z"), grantedBy: null, paidUntil: null }],
      [{ at: day(-10), period: "monthly" }],
      [],
    );
    const result = await new KinkRingsAdminService(db).cancelSilver(
      "ring-1",
      "admin",
      "Fraud",
      now,
    );
    expect(result.silverUntil).toBe("2026-11-24T12:00:00.000Z");
    expect(writes[1].values).toEqual({
      currentPeriodEnd: new Date("2026-11-24T12:00:00Z"),
      updatedAt: now,
    });
  });

  it("takes the month off the time set aside while the founders' Silver runs", async () => {
    const { db, writes } = txAnswering(
      [given],
      [{ end: new Date("9999-12-31T00:00:00Z"), grantedBy: "founder", paidUntil: day(20) }],
      [],
      [],
    );
    const result = await new KinkRingsAdminService(db).cancelSilver(
      "ring-1",
      "admin",
      "Fraud",
      now,
    );
    expect(result.silverUntil).toBe("9999-12-31T00:00:00.000Z");
    expect(writes[1].values).toEqual({ paidUntil: null, updatedAt: now });
  });

  it("changes nothing on Silver that has already run out", async () => {
    const { db, writes } = txAnswering(
      [given],
      [{ end: day(-1), grantedBy: null, paidUntil: null }],
    );
    const result = await new KinkRingsAdminService(db).cancelSilver(
      "ring-1",
      "admin",
      "Fraud",
      now,
    );
    expect(result.silverUntil).toBeNull();
    expect(writes.map((w) => w.op)).toEqual(["update", "insert"]);
  });

  it("refuses a ring not given, a receiver who left, or a second cancel", async () => {
    const cancel = (ring: unknown) =>
      new KinkRingsAdminService(txAnswering([ring]).db).cancelSilver("ring-1", "admin", "x", now);
    await expect(cancel(undefined)).rejects.toThrow("hasn't been given");
    await expect(cancel({ ...given, givenAt: null })).rejects.toThrow("hasn't been given");
    await expect(cancel({ ...given, givenTo: null })).rejects.toThrow("left Kinkord");
    await expect(cancel({ ...given, silverCancelledAt: day(-1) })).rejects.toThrow("already");
  });
});
