import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { paymentId, SubscriptionsController } from "./subscriptions.controller";
import type { SubscriptionsService } from "./subscriptions.service";

const req = {
  user: { id: "u1", email: "u1@example.com", emailVerified: true },
} as unknown as AuthedRequest;
const ID = "11111111-1111-4111-8111-111111111111";

function make() {
  const subscriptions = {
    status: vi.fn(async () => ({ plan: "basic" })),
    checkout: vi.fn(async () => ({ id: ID })),
    payment: vi.fn(async () => ({ id: ID })),
    presignReceipt: vi.fn(async () => ({ key: "k", uploadUrl: "u" })),
    submit: vi.fn(async () => ({ id: ID, status: "submitted" })),
  };
  return {
    controller: new SubscriptionsController(subscriptions as unknown as SubscriptionsService),
    subscriptions,
  };
}

describe("SubscriptionsController", () => {
  it("reads the signed-in member's own plan", async () => {
    const { controller, subscriptions } = make();
    await controller.status(req);
    expect(subscriptions.status).toHaveBeenCalledWith("u1");
  });

  it("starts a checkout for a plan it knows", async () => {
    const { controller, subscriptions } = make();
    await controller.checkout(req, { period: "monthly" });
    expect(subscriptions.checkout).toHaveBeenCalledWith("u1", "monthly");
    expect(() => controller.checkout(req, { period: "daily" })).toThrow(BadRequestException);
  });

  it("hands out a receipt slot and takes the proof", async () => {
    const { controller, subscriptions } = make();
    await controller.receiptUploadUrl(req, ID, { contentType: "image/jpeg", contentLength: 9 });
    expect(subscriptions.presignReceipt).toHaveBeenCalledWith("u1", ID, "image/jpeg", 9);
    const proof = {
      reference: "KIN20260924114238",
      amountKobo: 3_364_700,
      senderBankName: "GTBank",
      senderAccountName: "John Doe",
      senderAccountNumber: "0123456789",
      receiptKey: `payments/u1/${ID}/r.jpg`,
    };
    await controller.submit(req, ID, proof);
    expect(subscriptions.submit).toHaveBeenCalledWith("u1", ID, proof);
  });

  it("refuses incomplete proof before it reaches the service", () => {
    const { controller, subscriptions } = make();
    expect(() => controller.submit(req, ID, { reference: "KIN1" })).toThrow(BadRequestException);
    expect(subscriptions.submit).not.toHaveBeenCalled();
  });
});

describe("paymentId", () => {
  it("lets a uuid through and refuses anything else", () => {
    expect(paymentId(ID)).toBe(ID);
    expect(() => paymentId("../etc")).toThrow(BadRequestException);
  });
});
