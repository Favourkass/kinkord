import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { KinkRingsAdminService, ringStatus } from "./kink-rings-admin.service";

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
  withNote: false,
  recipientUsername: null,
  recipientName: null,
  ...yearly,
  ...change,
});

describe("ringStatus", () => {
  it("is given once given, else expired once past its date, else unused", () => {
    expect(ringStatus({ givenAt: day(-40), expiresAt: day(-10) }, now)).toBe("given");
    expect(ringStatus({ givenAt: null, expiresAt: day(-1) }, now)).toBe("expired");
    expect(ringStatus({ givenAt: null, expiresAt: day(1) }, now)).toBe("unused");
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
    expect(result.counts).toEqual({ total: 12, unused: 10, given: 1, expired: 1, received: 0 });
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
      },
    ]);
  });
});
