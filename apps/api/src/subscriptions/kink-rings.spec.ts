import { describe, expect, it } from "vitest";
import { RINGS_FOR, RING_DAYS, ringsFor } from "./kink-rings";

const from = new Date("2026-10-27T10:00:00.000Z");
const days = (n: number) => new Date(from.getTime() + n * 86_400_000);

describe("ringsFor", () => {
  it("brings one ring for a month of Silver, expiring in 30 days", () => {
    expect(ringsFor("monthly", from)).toEqual([{ seq: 1, expiresAt: days(30) }]);
  });

  it("brings twelve for a year, a month apart: 30 days, 60 and on to 360", () => {
    const rings = ringsFor("yearly", from);
    expect(rings).toHaveLength(12);
    expect(rings.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(rings[0].expiresAt).toEqual(days(30));
    expect(rings[1].expiresAt).toEqual(days(60));
    expect(rings[11].expiresAt).toEqual(days(360));
  });

  it("is counted in whole 30-day months", () => {
    expect(RING_DAYS).toBe(30);
    expect(RINGS_FOR).toEqual({ monthly: 1, yearly: 12 });
  });
});
