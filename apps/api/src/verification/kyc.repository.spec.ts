import { describe, expect, it, vi } from "vitest";
import type { Db } from "../db/db.module";
import { KycRepository } from "./kyc.repository";

describe("KycRepository", () => {
  it("creates a case lazily and returns its latest stage results", async () => {
    const onConflictDoNothing = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const caseRow = { userId: "user-1", status: "in_progress" };
    const stageResult = { stage: "identity", status: "passed" };
    const select = vi
      .fn()
      .mockImplementationOnce(() => ({
        from: () => ({ where: async () => [caseRow] }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({ where: () => ({ orderBy: async () => [stageResult] }) }),
      }));
    const repository = new KycRepository({ insert, select } as unknown as Db);

    await expect(repository.snapshot("user-1")).resolves.toEqual({
      caseRow,
      results: [stageResult],
    });
    expect(values).toHaveBeenCalledWith({ userId: "user-1" });
  });
});
