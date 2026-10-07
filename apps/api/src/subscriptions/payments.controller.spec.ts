import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { PaymentsController } from "./payments.controller";
import type { PaymentsService } from "./payments.service";

const asMember = (email: string) =>
  ({ user: { id: "a1", email, emailVerified: true } }) as unknown as AuthedRequest;
const founder = asMember("maxihandsome@gmail.com");
const staff = asMember("staff@example.com");
const ID = "11111111-1111-4111-8111-111111111111";

const settings = {
  bankName: "UBA",
  accountName: "Kinkord Ltd",
  accountNumber: "1028154254",
  monthlyKobo: 560_000,
  yearlyKobo: 3_360_000,
  monthlyUsdCents: 400,
  yearlyUsdCents: 2400,
};

function make() {
  const payments = {
    list: vi.fn(async () => []),
    verify: vi.fn(async () => ({ id: ID, silverUntil: "x" })),
    reject: vi.fn(async () => ({ id: ID })),
    settings: vi.fn(async () => ({})),
    updateSettings: vi.fn(async () => ({})),
  };
  return {
    controller: new PaymentsController(payments as unknown as PaymentsService),
    payments,
  };
}

describe("PaymentsController", () => {
  it("lists proofs waiting for a decision unless asked for another state", async () => {
    const { controller, payments } = make();
    await controller.list({});
    expect(payments.list).toHaveBeenCalledWith("submitted", undefined);
    await controller.list({ status: "verified", q: "John" });
    expect(payments.list).toHaveBeenLastCalledWith("verified", "John");
    expect(() => controller.list({ status: "everything" })).toThrow(BadRequestException);
  });

  it("verifies and rejects as the signed-in admin", async () => {
    const { controller, payments } = make();
    await controller.verify(staff, ID);
    expect(payments.verify).toHaveBeenCalledWith("a1", ID);
    await controller.reject(staff, ID, { reason: "Wrong amount" });
    expect(payments.reject).toHaveBeenCalledWith("a1", ID, "Wrong amount");
    expect(() => controller.reject(staff, ID, {})).toThrow(BadRequestException);
    expect(() => controller.verify(staff, "not-a-payment")).toThrow(BadRequestException);
  });

  it("shows the settings to every admin, editable only by the founders", async () => {
    const { controller, payments } = make();
    await controller.settings(staff);
    expect(payments.settings).toHaveBeenLastCalledWith(false);
    await controller.settings(founder);
    expect(payments.settings).toHaveBeenLastCalledWith(true);
  });

  it("lets only the founders change where members pay", async () => {
    const { controller, payments } = make();
    expect(() => controller.updateSettings(staff, settings)).toThrow(ForbiddenException);
    expect(payments.updateSettings).not.toHaveBeenCalled();
    await controller.updateSettings(founder, settings);
    expect(payments.updateSettings).toHaveBeenCalledWith("a1", settings);
  });
});
