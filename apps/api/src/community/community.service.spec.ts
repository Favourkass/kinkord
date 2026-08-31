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
});
