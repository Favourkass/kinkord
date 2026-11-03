import { describe, expect, it, vi } from "vitest";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { type AuthedRequest } from "../auth/auth.guard";
import { LocationAdminController } from "./location-admin.controller";
import { type LocationCheckService } from "./location-check.service";
import { type LocationSettingsService } from "./location-settings.service";

function make() {
  const checks = {
    summary: vi.fn(async () => ({ checks: 0 })),
    list: vi.fn(async () => []),
  };
  const settings = { setMode: vi.fn(async (mode: string) => mode) };
  return {
    controller: new LocationAdminController(
      checks as unknown as LocationCheckService,
      settings as unknown as LocationSettingsService,
    ),
    checks,
    settings,
  };
}

const as = (email: string) =>
  ({ user: { id: "u1", email, emailVerified: true } }) as unknown as AuthedRequest;

describe("LocationAdminController", () => {
  it("summarises the last week by default, and up to 90 days", async () => {
    const { controller, checks } = make();
    await controller.summary(undefined);
    expect(checks.summary).toHaveBeenCalledWith(7);
    await controller.summary("30");
    expect(checks.summary).toHaveBeenLastCalledWith(30);
    expect(() => controller.summary("365")).toThrow(BadRequestException);
  });

  it("lists checks page by page, optionally by decision", async () => {
    const { controller, checks } = make();
    await controller.list({
      before: "2026-11-02T12:00:00.000Z",
      limit: "20",
      decision: "mismatch",
    });
    expect(checks.list).toHaveBeenCalledWith({
      before: new Date("2026-11-02T12:00:00.000Z"),
      limit: 20,
      decision: "mismatch",
    });
    expect(() => controller.list({ decision: "maybe" })).toThrow(BadRequestException);
  });

  it("lets only the founders switch the check", async () => {
    const { controller, settings } = make();
    await expect(
      controller.setMode(as("staff@kinkord.com"), { mode: "enforce" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(settings.setMode).not.toHaveBeenCalled();
    expect(await controller.setMode(as("nnabuekassidy@gmail.com"), { mode: "enforce" })).toEqual({
      mode: "enforce",
    });
    expect(settings.setMode).toHaveBeenCalledWith("enforce", "u1");
  });

  it("refuses a mode it doesn't know", async () => {
    const { controller } = make();
    await expect(
      controller.setMode(as("nnabuekassidy@gmail.com"), { mode: "maybe" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
