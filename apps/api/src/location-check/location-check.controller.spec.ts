import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import { type Auth } from "../auth/auth.instance";
import { LocationCheckController } from "./location-check.controller";
import { type LocationCheckService } from "./location-check.service";

const body = {
  country: "ng",
  gps: { status: "ok", lat: 6.52, lng: 3.38, accuracy: 25 },
  device: {
    timezone: "Africa/Lagos",
    automation: false,
    geolocationNative: true,
    renderer: null,
  },
  deviceId: "device-1234",
};

function make(session: unknown = null, country: string | null = "NG") {
  const auth = { api: { getSession: vi.fn(async () => session) } } as unknown as Auth;
  const checks = {
    mode: vi.fn(async () => "watch"),
    memberOf: vi.fn(async (id: string) => ({ id, country })),
    dueFor: vi.fn(async () => ({ due: true, hold: false })),
    check: vi.fn(async () => ({ id: "check-1" })),
    skip: vi.fn(async () => ({ id: "check-2" })),
  };
  return {
    controller: new LocationCheckController(auth, checks as unknown as LocationCheckService),
    checks,
  };
}

const req = {
  headers: { "x-forwarded-for": "6.6.6.6, 102.89.32.1" },
} as unknown as Request;

describe("LocationCheckController", () => {
  it("tells the app whether checks run", async () => {
    expect(await make().controller.mode()).toEqual({ mode: "watch" });
  });

  it("checks a visitor joining, with the address that reached AWS", async () => {
    const { controller, checks } = make();
    await controller.check(req, body);
    expect(checks.check).toHaveBeenCalledWith({
      ...body,
      country: "NG",
      member: null,
      ip: "102.89.32.1",
    });
  });

  it("checks a signed-in member against their profile country", async () => {
    const { controller, checks } = make({ user: { id: "u1" } }, "GH");
    await controller.check(req, body);
    expect(checks.check).toHaveBeenCalledWith(
      expect.objectContaining({ member: { id: "u1", country: "GH" } }),
    );
  });

  it("refuses a malformed check", async () => {
    const { controller, checks } = make();
    for (const bad of [
      { ...body, country: "Nigeria" },
      { ...body, gps: { status: "ok", lat: "6.5" } },
      { ...body, gps: { status: "somewhere" } },
      { ...body, deviceId: "x" },
    ]) {
      await expect(controller.check(req, bad)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(checks.check).not.toHaveBeenCalled();
  });

  it("records a skip", async () => {
    const { controller, checks } = make();
    await controller.skip(req, { country: "NG", deviceId: null });
    expect(checks.skip).toHaveBeenCalledWith({
      country: "NG",
      deviceId: null,
      member: null,
      ip: "102.89.32.1",
    });
  });

  it("treats a sign-up check as one for a new account, whoever the browser is signed in as", async () => {
    const { controller, checks } = make({ user: { id: "u1" } }, "GH");
    await controller.check(req, { ...body, joining: true });
    expect(checks.memberOf).not.toHaveBeenCalled();
    expect(checks.check).toHaveBeenCalledWith(expect.objectContaining({ member: null }));
  });

  it("says whether a signed-in member owes a check, and nobody else does", async () => {
    const signedOut = make();
    expect(await signedOut.controller.due(req)).toEqual({ due: false });
    const { controller, checks } = make({
      user: { id: "u1", email: "member@kinkord.com", emailVerified: true },
      session: { createdAt: "2026-11-02T08:00:00Z" },
    });
    expect(await controller.due(req)).toEqual({ due: true });
    expect(checks.dueFor).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" }),
      new Date("2026-11-02T08:00:00Z"),
      "102.89.32.1",
    );
  });
});
