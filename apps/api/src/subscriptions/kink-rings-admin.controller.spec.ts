import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { KinkRingsAdminController } from "./kink-rings-admin.controller";
import { type KinkRingsAdminService } from "./kink-rings-admin.service";

describe("KinkRingsAdminController", () => {
  it("gives admins a member's rings", async () => {
    const forMember = vi.fn(async () => ({ counts: { total: 0 } }));
    const controller = new KinkRingsAdminController({
      forMember,
    } as unknown as KinkRingsAdminService);
    await controller.forMember(" u1 ");
    expect(forMember).toHaveBeenCalledWith("u1");
  });

  it("refuses an empty member id", () => {
    const controller = new KinkRingsAdminController({} as unknown as KinkRingsAdminService);
    expect(() => controller.forMember("  ")).toThrow(BadRequestException);
  });
});
