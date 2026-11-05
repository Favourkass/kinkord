import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { appSetting } from "../db/schema";
import { ringPairPrice, ringsPerPlan, saveRingPairPrice, saveRingsPerPlan } from "./ring-settings";

function dbWith(rows: Array<{ key: string; value: string }>) {
  const chain = { from: () => chain, where: () => Promise.resolve(rows) };
  return { select: vi.fn(() => chain) } as unknown as Db;
}

describe("ringsPerPlan", () => {
  it("is one for a month and twelve for a year until the founders set their own", async () => {
    await expect(ringsPerPlan(dbWith([]))).resolves.toEqual({ monthly: 1, yearly: 12 });
  });

  it("reads the founders' numbers, including none", async () => {
    const db = dbWith([
      { key: "kink_rings_monthly", value: "0" },
      { key: "kink_rings_yearly", value: "6" },
    ]);
    await expect(ringsPerPlan(db)).resolves.toEqual({ monthly: 0, yearly: 6 });
  });

  it("falls back for a stored value that isn't a count it could give", async () => {
    const db = dbWith([
      { key: "kink_rings_monthly", value: "2.5" },
      { key: "kink_rings_yearly", value: "99" },
    ]);
    await expect(ringsPerPlan(db)).resolves.toEqual({ monthly: 1, yearly: 12 });
  });
});

describe("saveRingsPerPlan", () => {
  it("stores both plans' counts, with who set them", async () => {
    const written: unknown[] = [];
    const db = {
      insert: vi.fn((table: unknown) => {
        expect(table).toBe(appSetting);
        return {
          values: (values: unknown) => {
            written.push(values);
            return { onConflictDoUpdate: () => Promise.resolve() };
          },
        };
      }),
    } as unknown as Db;
    const now = new Date("2026-11-03T12:00:00Z");
    await saveRingsPerPlan(db, { monthly: 1, yearly: 6 }, "founder", now);
    expect(written).toEqual([
      { key: "kink_rings_monthly", value: "1", updatedBy: "founder", updatedAt: now },
      { key: "kink_rings_yearly", value: "6", updatedBy: "founder", updatedAt: now },
    ]);
  });
});

describe("ringPairPrice", () => {
  const priceDb = (rows: Array<{ value: string }>) => {
    const chain = { from: () => chain, where: () => chain, limit: () => Promise.resolve(rows) };
    return { select: vi.fn(() => chain) } as unknown as Db;
  };

  it("is $5 for 2 rings until the founders set a price", async () => {
    await expect(ringPairPrice(priceDb([]))).resolves.toBe(500);
  });

  it("reads the founders' price in cents", async () => {
    await expect(ringPairPrice(priceDb([{ value: "499" }]))).resolves.toBe(499);
  });

  it("falls back to $5 for a stored price outside $0.50 to $500", async () => {
    for (const value of ["49", "50001", "4.5", "free"]) {
      await expect(ringPairPrice(priceDb([{ value }]))).resolves.toBe(500);
    }
  });
});

describe("saveRingPairPrice", () => {
  it("stores the price in cents, with who set it", async () => {
    const written: unknown[] = [];
    const db = {
      insert: vi.fn(() => ({
        values: (values: unknown) => {
          written.push(values);
          return { onConflictDoUpdate: () => Promise.resolve() };
        },
      })),
    } as unknown as Db;
    const now = new Date("2026-11-04T12:00:00Z");
    await saveRingPairPrice(db, 499, "founder", now);
    expect(written).toEqual([
      { key: "kink_ring_pair_usd_cents", value: "499", updatedBy: "founder", updatedAt: now },
    ]);
  });
});
