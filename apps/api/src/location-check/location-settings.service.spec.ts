import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { LocationSettingsService } from "./location-settings.service";

const dbWithMode = (value: string | null) => {
  const limit = vi.fn(async () => (value === null ? [] : [{ value }]));
  const onConflictDoUpdate = vi.fn(async () => undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const db = {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) })),
    insert: vi.fn(() => ({ values })),
  };
  return { db: db as unknown as Db, limit, values, onConflictDoUpdate };
};

describe("LocationSettingsService", () => {
  it("is off until the founders switch it on", async () => {
    expect(await new LocationSettingsService(dbWithMode(null).db).mode()).toBe("off");
  });

  it("reads the founders' choice", async () => {
    expect(await new LocationSettingsService(dbWithMode("enforce").db).mode()).toBe("enforce");
  });

  it("ignores a value it doesn't know", async () => {
    expect(await new LocationSettingsService(dbWithMode("maybe").db).mode()).toBe("off");
  });

  it("asks the database at most every 30 seconds", async () => {
    const { db, limit } = dbWithMode("enforce");
    const settings = new LocationSettingsService(db);
    await settings.mode(1_000);
    await settings.mode(20_000);
    expect(limit).toHaveBeenCalledTimes(1);
    await settings.mode(31_001);
    expect(limit).toHaveBeenCalledTimes(2);
  });

  it("shares one read among requests that arrive while it runs", async () => {
    const { db, limit } = dbWithMode("watch");
    const settings = new LocationSettingsService(db);
    const modes = await Promise.all([
      settings.mode(1_000),
      settings.mode(1_000),
      settings.mode(1_000),
    ]);
    expect(modes).toEqual(["watch", "watch", "watch"]);
    expect(limit).toHaveBeenCalledTimes(1);
  });

  it("saves a switch, with who made it, and uses it at once", async () => {
    const { db, limit, values } = dbWithMode("watch");
    const settings = new LocationSettingsService(db);
    await settings.mode();
    await settings.setMode("enforce", "founder-1");
    expect(values).toHaveBeenCalledWith({
      key: "location_check_mode",
      value: "enforce",
      updatedBy: "founder-1",
    });
    await settings.mode();
    expect(limit).toHaveBeenCalledTimes(2);
  });
});
