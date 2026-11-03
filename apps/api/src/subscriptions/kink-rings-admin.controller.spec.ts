import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { SUPER_ADMIN_EMAILS } from "../moderation/admins";
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

  it("takes back a member's rings, or a ring's Silver, as the admin, with a reason", async () => {
    const cancelUnused = vi.fn(async () => ({ cancelled: 3 }));
    const cancelSilver = vi.fn(async () => ({ memberId: "u2", silverUntil: null }));
    const controller = new KinkRingsAdminController({
      cancelUnused,
      cancelSilver,
    } as unknown as KinkRingsAdminService);
    const req = { user: { id: "admin" } } as never;
    await controller.cancelUnused(req, "u1", { reason: " Refunded " });
    expect(cancelUnused).toHaveBeenCalledWith("u1", "admin", "Refunded");
    const ring = "6f1c2a52-8a43-4c1e-9d1a-0f8e2b7c4d10";
    await controller.cancelSilver(req, ring, { reason: "Fraud" });
    expect(cancelSilver).toHaveBeenCalledWith(ring, "admin", "Fraud");
  });

  it("asks why, and turns away a ring id that isn't one", () => {
    const controller = new KinkRingsAdminController({} as unknown as KinkRingsAdminService);
    const req = { user: { id: "admin" } } as never;
    expect(() => controller.cancelUnused(req, "u1", { reason: "  " })).toThrow("Say why.");
    expect(() => controller.cancelUnused(req, "u1", {})).toThrow(BadRequestException);
    expect(() => controller.cancelSilver(req, "ring-1", { reason: "Fraud" })).toThrow(
      "Unknown ring.",
    );
  });

  it("lets every admin read the rings per plan, and only the founders change them", async () => {
    const settings = vi.fn(async (canEdit: boolean) => ({ rings: {}, canEdit }));
    const saveSettings = vi.fn(async () => ({}));
    const controller = new KinkRingsAdminController({
      settings,
      saveSettings,
    } as unknown as KinkRingsAdminService);
    const staff = { user: { id: "s1", email: "staff@example.com", emailVerified: true } } as never;
    await controller.settings(staff);
    expect(settings).toHaveBeenCalledWith(false);
    expect(() => controller.saveSettings(staff, { monthly: 1, yearly: 6 })).toThrow(
      "Only the founders",
    );
    expect(saveSettings).not.toHaveBeenCalled();
    const founder = {
      user: { id: "f1", email: SUPER_ADMIN_EMAILS[0], emailVerified: true },
    } as never;
    await controller.saveSettings(founder, { monthly: 1, yearly: 6 });
    expect(saveSettings).toHaveBeenCalledWith("f1", { monthly: 1, yearly: 6 });
    for (const bad of [
      { monthly: 1, yearly: 25 },
      { monthly: -1, yearly: 6 },
      { monthly: 1.5, yearly: 6 },
    ]) {
      expect(() => controller.saveSettings(founder, bad)).toThrow("whole number from 0 to 24");
    }
  });
});
