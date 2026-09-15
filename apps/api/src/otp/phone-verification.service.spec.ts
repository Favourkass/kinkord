import { describe, expect, it, vi } from "vitest";
import { PhoneVerificationService, maskPhone } from "./phone-verification.service";

function makeDb(row: { phone: string | null; verified: boolean } | undefined) {
  const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  return {
    set,
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(async () => (row ? [row] : [])) })),
      })),
      update: vi.fn(() => ({ set })),
    },
  };
}

const otp = (overrides: Partial<Record<"send" | "verify", unknown>> = {}) => ({
  send: vi.fn(async () => ({
    id: "otp-1",
    channel: "sms",
    expiresAt: "2026-09-15T12:10:00.000Z",
    resendAfterMs: 60_000,
  })),
  verify: vi.fn(async () => ({ valid: true })),
  ...overrides,
});

describe("maskPhone", () => {
  it("shows the country code and last four digits only", () => {
    expect(maskPhone("+2349127883266")).toBe("+234******3266");
  });
});

describe("PhoneVerificationService", () => {
  it("texts the number on the member's own profile, never one from the request", async () => {
    const { db } = makeDb({ phone: "+2349127883266", verified: false });
    const codes = otp();
    const service = new PhoneVerificationService(db as never, codes as never);

    const result = await service.sendCode("u1");

    expect(codes.send).toHaveBeenCalledWith("u1", "sms", "+2349127883266");
    expect(result.sentTo).toBe("+234******3266");
    expect(result.otpId).toBe("otp-1");
  });

  it("asks for a number first when the profile has none", async () => {
    const { db } = makeDb({ phone: null, verified: false });
    const service = new PhoneVerificationService(db as never, otp() as never);

    await expect(service.sendCode("u1")).rejects.toThrow(/Add a phone number/);
  });

  it("does not re-verify a number that is already verified", async () => {
    const { db } = makeDb({ phone: "+2349127883266", verified: true });
    const codes = otp();
    const service = new PhoneVerificationService(db as never, codes as never);

    await expect(service.sendCode("u1")).rejects.toThrow(/already verified/);
    expect(codes.send).not.toHaveBeenCalled();
  });

  it("flips the profile to verified once the code checks out", async () => {
    const { db, set } = makeDb({ phone: "+2349127883266", verified: false });
    const service = new PhoneVerificationService(db as never, otp() as never);

    await expect(service.verify("u1", "otp-1", "123456")).resolves.toEqual({
      verified: true,
      attemptsLeft: null,
    });
    expect(set).toHaveBeenCalledWith({ phoneVerified: true });
  });

  it("leaves the profile alone on a wrong code and reports the attempts left", async () => {
    const { db, set } = makeDb({ phone: "+2349127883266", verified: false });
    const codes = otp({ verify: vi.fn(async () => ({ valid: false, attemptsLeft: 2 })) });
    const service = new PhoneVerificationService(db as never, codes as never);

    await expect(service.verify("u1", "otp-1", "000000")).resolves.toEqual({
      verified: false,
      attemptsLeft: 2,
    });
    expect(set).not.toHaveBeenCalled();
  });
});
