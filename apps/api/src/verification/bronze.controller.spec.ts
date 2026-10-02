import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import {
  BronzeController,
  BronzeReviewController,
  DiditCallbackController,
  SmileIdCallbackController,
} from "./bronze.controller";
import type { BronzeService } from "./bronze.service";

const req = { user: { id: "user-1", email: "reviewer@kinkord.com" } } as unknown as AuthedRequest;

function service() {
  return {
    status: vi.fn(async () => ({ status: "not_started" })),
    consent: vi.fn(async () => ({ consented: true })),
    start: vi.fn(async () => ({ provider: "didit" })),
    smileCallback: vi.fn(async () => ({ received: true })),
    diditCallback: vi.fn(async () => ({ received: true })),
    reviews: vi.fn(async () => []),
    decideReview: vi.fn(async () => ({ status: "verified" })),
  };
}

describe("bronze verification controllers", () => {
  it("delegates member status, consent and attempt creation", async () => {
    const bronze = service();
    const controller = new BronzeController(bronze as unknown as BronzeService);
    await controller.status(req);
    await controller.consent(req, { accepted: true, policyVersion: "identity-v1" });
    await controller.start(req);
    expect(bronze.status).toHaveBeenCalledWith("user-1");
    expect(bronze.consent).toHaveBeenCalledWith("user-1", true, "identity-v1");
    expect(bronze.start).toHaveBeenCalledWith("user-1");
  });

  it("passes provider callbacks without reshaping signed input", async () => {
    const bronze = service();
    const smile = new SmileIdCallbackController(bronze as unknown as BronzeService);
    const didit = new DiditCallbackController(bronze as unknown as BronzeService);
    const payload = Buffer.from("signed body");
    await smile.callback({ job_id: "job-1" });
    await didit.callback(payload, "v2", "v1", "timestamp");
    expect(bronze.smileCallback).toHaveBeenCalledWith({ job_id: "job-1" });
    expect(bronze.diditCallback).toHaveBeenCalledWith(payload, "v2", "v1", "timestamp");
  });

  it("validates reviewer decisions before calling the service", async () => {
    const bronze = service();
    const controller = new BronzeReviewController(bronze as unknown as BronzeService);
    expect(() => controller.decide(req, "not-a-uuid", {})).toThrow(BadRequestException);
    const id = "11111111-1111-4111-8111-111111111111";
    await controller.decide(req, id, {
      decision: "approve",
      profileFaceMatches: true,
      evidenceReference: "didit-1",
      reason: "Evidence confirms the member.",
    });
    expect(bronze.decideReview).toHaveBeenCalledWith(
      req.user,
      expect.objectContaining({ id, decision: "approve" }),
    );
  });
});
