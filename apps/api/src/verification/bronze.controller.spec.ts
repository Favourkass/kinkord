import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import {
  BronzeAdminController,
  BronzeController,
  DiditCallbackController,
} from "./bronze.controller";
import type { BronzeService } from "./bronze.service";

const req = {
  user: { id: "user-1", twoFactorEnabled: true, email: "member@example.test", emailVerified: true },
  session: { id: "session-1" },
  headers: {},
} as unknown as AuthedRequest;
const ID = "11111111-1111-4111-8111-111111111111";

function service() {
  return {
    status: vi.fn(async () => ({ status: "not_started" })),
    consent: vi.fn(async () => ({ consented: true })),
    withdraw: vi.fn(async () => ({ consented: false })),
    start: vi.fn(async () => ({ provider: "didit" })),
    resume: vi.fn(async () => ({ url: "https://verify.didit.me/s" })),
    diditCallback: vi.fn(() => ({ received: true })),
    reviews: vi.fn(async () => []),
    decideReview: vi.fn(async () => ({ status: "verified" })),
    adminStatus: vi.fn(async () => ({ status: "verified" })),
    revoke: vi.fn(async () => ({ status: "revoked" })),
    reopen: vi.fn(async () => ({ status: "not_started" })),
    stepUp: vi.fn(async () => ({ verifiedUntil: new Date().toISOString() })),
  };
}
const as = (bronze: ReturnType<typeof service>) => bronze as unknown as BronzeService;

describe("verification routes", () => {
  it("act for the signed-in member only", async () => {
    const bronze = service();
    const controller = new BronzeController(as(bronze));
    await controller.status(req);
    await controller.consent(req, { accepted: true, policyVersion: "v3" });
    await controller.withdraw(req);
    await controller.start(req);
    await controller.resume(req);
    expect(bronze.resume).toHaveBeenCalledWith("user-1");
    expect(bronze.status).toHaveBeenCalledWith("user-1");
    expect(bronze.consent).toHaveBeenCalledWith("user-1", true, "v3");
    expect(bronze.withdraw).toHaveBeenCalledWith("user-1");
    expect(bronze.start).toHaveBeenCalledWith("user-1");
  });

  it("refuse a consent that wasn't explicitly given", () => {
    const controller = new BronzeController(as(service()));
    expect(() => controller.consent(req, { accepted: "yes", policyVersion: "v3" })).toThrow(
      BadRequestException,
    );
    expect(() => controller.consent(req, { accepted: true })).toThrow(BadRequestException);
  });

  it("pass Didit's signed bytes through untouched", () => {
    const bronze = service();
    const payload = Buffer.from("signed body");
    new DiditCallbackController(as(bronze)).callback(payload, "v2", "v1", "123");
    expect(bronze.diditCallback).toHaveBeenCalledWith(payload, "v2", "v1", "123");
  });

  it("validate an admin's decision before it reaches the service", async () => {
    const bronze = service();
    const controller = new BronzeAdminController(as(bronze));
    expect(() => controller.decide(req, "not-a-uuid", {})).toThrow(BadRequestException);
    expect(() => controller.decide(req, ID, { decision: "approve", reason: "short" })).toThrow(
      BadRequestException,
    );
    await controller.decide(req, ID, {
      decision: "approve",
      evidenceReference: "didit-1",
      reason: "Photo and ID country checked in Didit.",
    });
    expect(bronze.decideReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", sessionId: "session-1" }),
      expect.objectContaining({ id: ID, decision: "approve" }),
    );
  });

  it("let admins revoke or reopen a member's verification", async () => {
    const bronze = service();
    const controller = new BronzeAdminController(as(bronze));
    await controller.revoke(req, "member-9", { reason: "Confirmed policy breach." });
    await controller.reopen(req, "member-9", { reason: "Support approved another try." });
    expect(bronze.revoke).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", sessionId: "session-1" }),
      "member-9",
      "Confirmed policy breach.",
    );
    expect(bronze.reopen).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", sessionId: "session-1" }),
      "member-9",
      "Support approved another try.",
    );
    expect(() => controller.revoke(req, "", {})).toThrow(BadRequestException);
  });

  it("binds a successful TOTP step-up to the current session", async () => {
    const bronze = service();
    const controller = new BronzeAdminController(as(bronze));
    await controller.stepUp(req, { code: "123456" });
    expect(bronze.stepUp).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", sessionId: "session-1" }),
      "123456",
      expect.any(Headers),
    );
    expect(() => controller.stepUp(req, { code: "123" })).toThrow(BadRequestException);
  });

  it("tells the member page which admin is asking, and whether they're a founder", async () => {
    const bronze = service();
    const controller = new BronzeAdminController(as(bronze));
    await controller.member(req, "member-9");
    expect(bronze.adminStatus).toHaveBeenCalledWith(
      { id: "user-1", twoFactorEnabled: true, sessionId: "session-1", founder: false },
      "member-9",
    );
  });
});
