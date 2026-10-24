import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AuthGuard } from "../auth/auth.guard";
import { PrivacyController } from "./privacy.controller";
describe("PrivacyController", () => {
  it("requires authentication for both reads and writes", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PrivacyController)).toContain(AuthGuard);
  });
  it("takes the owner from the authenticated session", async () => {
    const service = { get: vi.fn(), update: vi.fn() };
    const controller = new PrivacyController(service as never);
    await controller.get({ user: { id: "session-owner" } } as never);
    await controller.update({ user: { id: "session-owner" } } as never, { bio: "friends" });
    expect(service.get).toHaveBeenCalledWith("session-owner");
    expect(service.update).toHaveBeenCalledWith("session-owner", { bio: "friends" });
  });
});
