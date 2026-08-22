import { describe, expect, it, vi } from "vitest";
import { HealthController } from "./health.controller";
import { type HealthService } from "./health.service";

describe("HealthController", () => {
  it("delegates to the health service", async () => {
    const service = {
      check: vi.fn(async () => ({ ok: true, db: "up", ts: "now" })),
    } as unknown as HealthService;
    await expect(new HealthController(service).check()).resolves.toEqual({
      ok: true,
      db: "up",
      ts: "now",
    });
  });
});
