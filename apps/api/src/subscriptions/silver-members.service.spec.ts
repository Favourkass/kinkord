import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { FOUNDER_SILVER_UNTIL } from "./plans";
import { SilverMembersService, silverSource } from "./silver-members.service";

const now = new Date("2026-11-03T12:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("silverSource", () => {
  const running = { end: day(20), grantedBy: null };

  it("is the founders' gift, or Silver for good, before anything paid or given", () => {
    expect(silverSource({ end: day(20), grantedBy: "founder" }, day(20), 0, now)).toBe("given");
    expect(silverSource({ end: FOUNDER_SILVER_UNTIL, grantedBy: null }, null, 0, now)).toBe(
      "given",
    );
  });

  it("is a subscription while their own payments carry it", () => {
    expect(silverSource(running, day(20), 0, now)).toBe("subscription");
    // A ring whose month was spent before they paid adds nothing now.
    expect(silverSource(running, day(20), 1, now)).toBe("subscription");
  });

  it("is a ring when a ring's month is what's running", () => {
    expect(silverSource(running, null, 1, now)).toBe("ring");
    // Paid once, lapsed, then given a ring.
    expect(silverSource(running, day(-30), 1, now)).toBe("ring");
  });

  it("is both when rings are stacked on paid time", () => {
    expect(silverSource({ end: day(50), grantedBy: null }, day(20), 1, now)).toBe("both");
  });

  it("is other for Silver neither paid for nor given by a ring", () => {
    expect(silverSource(running, null, 0, now)).toBe("other");
  });
});

/** Answers selects in order: the Silver members, then their payments, then their rings. */
function dbAnswering(...answers: unknown[][]) {
  const queue = [...answers];
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const step of ["from", "innerJoin", "leftJoin", "where", "orderBy", "groupBy"]) {
      c[step] = () => c;
    }
    c.then = (ok: (rows: unknown[]) => unknown) => Promise.resolve(queue.shift() ?? []).then(ok);
    return c;
  };
  return { select: vi.fn(() => chain()) } as unknown as Db;
}

describe("SilverMembersService.list", () => {
  const members = [
    { id: "u1", username: "tega", displayName: "Tega", end: day(25), grantedBy: null },
    { id: "u2", username: "sweetdaddydom", displayName: "Dom", end: day(300), grantedBy: null },
    { id: "u3", username: "ada", displayName: "Ada", end: FOUNDER_SILVER_UNTIL, grantedBy: "f1" },
  ];
  const payments = [{ userId: "u2", at: day(-65), period: "yearly" }];
  const rings = [{ userId: "u1", n: 1 }];

  it("lists everyone on Silver with how they got it", async () => {
    const service = new SilverMembersService(dbAnswering(members, payments, rings));
    const result = await service.list("all", undefined, 1, now);
    expect(result.counts).toEqual({ all: 3, subscription: 1, ring: 1, given: 1 });
    expect(result.items.map((m) => [m.username, m.source, m.plan, m.forGood])).toEqual([
      ["tega", "ring", null, false],
      ["sweetdaddydom", "subscription", "yearly", false],
      ["ada", "given", null, true],
    ]);
    expect(result.nextPage).toBeNull();
  });

  it("filters by how they got it, and finds them by name", async () => {
    const service = new SilverMembersService(dbAnswering(members, payments, rings));
    const rings_ = await service.list("ring", undefined, 1, now);
    expect(rings_.items.map((m) => m.username)).toEqual(["tega"]);
    expect(rings_.counts.all).toBe(3);
    const found = await new SilverMembersService(dbAnswering(members, payments, rings)).list(
      "all",
      "@DOM",
      1,
      now,
    );
    expect(found.items.map((m) => m.username)).toEqual(["sweetdaddydom"]);
  });

  it("has nobody to classify when nobody is on Silver", async () => {
    const db = dbAnswering([]);
    const result = await new SilverMembersService(db).list("all", undefined, 1, now);
    expect(result).toEqual({
      counts: { all: 0, subscription: 0, ring: 0, given: 0 },
      items: [],
      nextPage: null,
    });
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
