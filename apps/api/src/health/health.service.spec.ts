import { describe, expect, it, vi } from "vitest";
import { type Pool } from "pg";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("reports db up when SELECT 1 succeeds", async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as Pool;
    const result = await new HealthService(pool).check();
    expect(result.ok).toBe(true);
    expect(result.db).toBe("up");
  });

  it("stays ok with db down when the query fails", async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error("no db")) } as unknown as Pool;
    const result = await new HealthService(pool).check();
    expect(result.ok).toBe(true);
    expect(result.db).toBe("down");
  });
});
