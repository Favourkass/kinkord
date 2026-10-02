import { describe, expect, it, vi } from "vitest";
import type { Db } from "../db/db.module";
import { BronzeRepository } from "./bronze.repository";

describe("BronzeRepository", () => {
  it("returns null when no profile identity exists", async () => {
    const where = vi.fn(async () => []);
    const from = vi.fn(() => ({ where }));
    const db = { select: vi.fn(() => ({ from })) } as unknown as Db;
    const repository = new BronzeRepository(db);

    await expect(repository.snapshot("user-1")).resolves.toBeNull();
    expect(where).toHaveBeenCalledOnce();
  });
});
