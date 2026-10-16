import { describe, expect, it, vi } from "vitest";
import { type Db } from "../db/db.module";
import { CommunityService } from "./community.service";

const makeDb = (rows: Array<{ members: number }>) => {
  const from = vi.fn().mockResolvedValue(rows);
  const select = vi.fn().mockReturnValue({ from });
  return { db: { select } as unknown as Db, select, from };
};

describe("CommunityService", () => {
  it("returns the registered member count", async () => {
    const { db } = makeDb([{ members: 128 }]);
    const service = new CommunityService(db);
    await expect(service.stats()).resolves.toEqual({ members: 128 });
  });

  it("returns zero when the user table is empty", async () => {
    const { db } = makeDb([]);
    const service = new CommunityService(db);
    await expect(service.stats()).resolves.toEqual({ members: 0 });
  });
  it("shares the public aggregate query and refreshes after a minute", async () => {
    const { db, select, from } = makeDb([{ members: 128 }]);
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      const service = new CommunityService(db);
      await expect(Promise.all([service.publicStats(), service.publicStats()])).resolves.toEqual([
        { members: 128 },
        { members: 128 },
      ]);
      expect(select).toHaveBeenCalledTimes(1);
      now.mockReturnValue(61_000);
      from.mockResolvedValue([{ members: 129 }]);
      await expect(service.publicStats()).resolves.toEqual({ members: 129 });
      expect(select).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });
  it("retries after a failed public query instead of caching its failure", async () => {
    const { db, from } = makeDb([{ members: 3 }]);
    from.mockRejectedValueOnce(new Error("db unavailable"));
    const service = new CommunityService(db);
    await expect(service.publicStats()).rejects.toThrow("db unavailable");
    await expect(service.publicStats()).resolves.toEqual({ members: 3 });
  });
});
