import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { SilverChecksController } from "./silver-checks.controller";
import type { SilverChecksService } from "./silver-checks.service";

const req = {
  user: { id: "a1", email: "staff@example.com", emailVerified: true },
} as unknown as AuthedRequest;

function make() {
  const checks = {
    held: vi.fn(async () => []),
    forMember: vi.fn(async () => null),
    approve: vi.fn(async () => ({ userId: "u1" })),
    remove: vi.fn(async () => ({ userId: "u1" })),
  };
  return {
    controller: new SilverChecksController(checks as unknown as SilverChecksService),
    checks,
  };
}

describe("SilverChecksController", () => {
  it("lists checks waiting for review and reads one member's", async () => {
    const { controller, checks } = make();
    await controller.held();
    expect(checks.held).toHaveBeenCalled();
    await expect(controller.member("u1")).resolves.toEqual({ check: null });
    expect(checks.forMember).toHaveBeenCalledWith("u1");
  });

  it("approves and removes as the signed-in admin", async () => {
    const { controller, checks } = make();
    await controller.approve(req, "u1");
    expect(checks.approve).toHaveBeenCalledWith("a1", "u1");
    await controller.remove(req, "u1", { reason: " Impersonation " });
    expect(checks.remove).toHaveBeenCalledWith("a1", "u1", "Impersonation");
    await controller.remove(req, "u1", {});
    expect(checks.remove).toHaveBeenLastCalledWith("a1", "u1", undefined);
  });

  it("refuses an empty member id", () => {
    const { controller } = make();
    expect(() => controller.approve(req, "  ")).toThrow(BadRequestException);
  });
});
