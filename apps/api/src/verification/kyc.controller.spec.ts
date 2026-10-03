import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { KycController, KycReviewController, MonoCallbackController } from "./kyc.controller";
import type { KycFinancialService } from "./kyc-financial.service";
import type { KycLocationService } from "./kyc-location.service";
import type { KycReviewService } from "./kyc-review.service";
import type { KycService } from "./kyc.service";

const req = { user: { id: "user-1", email: "member@example.com" } } as unknown as AuthedRequest;

describe("KYC controllers", () => {
  it("validates and delegates consent, location and financial starts", async () => {
    const kyc = {
      status: vi.fn(async () => ({})),
      consent: vi.fn(async () => ({})),
      refreshResidence: vi.fn(async () => ({ status: "passed" })),
    };
    const location = { capture: vi.fn(async () => ({ status: "passed" })) };
    const financial = { start: vi.fn(async () => ({ url: "https://mono.example" })) };
    const controller = new KycController(
      kyc as unknown as KycService,
      location as unknown as KycLocationService,
      financial as unknown as KycFinancialService,
    );
    await controller.consent(req, { category: "location", policyVersion: "location-v1" });
    await controller.locationEvidence(req, { latitude: 6.3, longitude: 5.6, accuracyMetres: 10 });
    await controller.residenceRefresh(req);
    await controller.financialAttempt(req);
    expect(kyc.consent).toHaveBeenCalledWith("user-1", "location", "location-v1");
    expect(location.capture).toHaveBeenCalledWith("user-1", {
      latitude: 6.3,
      longitude: 5.6,
      accuracyMetres: 10,
    });
    expect(financial.start).toHaveBeenCalledWith(req.user);
    expect(kyc.refreshResidence).toHaveBeenCalledWith("user-1");
    expect(() => controller.locationEvidence(req, { latitude: 1000 })).toThrow(BadRequestException);
  });

  it("passes Mono's shared secret to the financial service", async () => {
    const financial = { webhook: vi.fn(async () => ({ received: true })) };
    const controller = new MonoCallbackController(financial as unknown as KycFinancialService);
    await controller.callback({ event: "account_updated" }, "secret");
    expect(financial.webhook).toHaveBeenCalledWith({ event: "account_updated" }, "secret");
  });

  it("rejects malformed review decisions", async () => {
    const reviews = { list: vi.fn(async () => []), decide: vi.fn(async () => ({})) };
    const controller = new KycReviewController(reviews as unknown as KycReviewService);
    expect(() => controller.decide(req, "bad-id", { decision: "approve" })).toThrow(
      BadRequestException,
    );
    expect(reviews.decide).not.toHaveBeenCalled();
  });
});
