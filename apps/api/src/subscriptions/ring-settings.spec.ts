import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { appSetting } from "../db/schema";
import { ringsPerPlan, saveRingsPerPlan } from "./ring-settings";

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
