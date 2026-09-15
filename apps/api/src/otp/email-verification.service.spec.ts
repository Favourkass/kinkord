import { describe, expect, it, vi } from "vitest";
import { EmailVerificationService, maskEmail } from "./email-verification.service";

function makeDb(row: { email: string; verified: boolean } | undefined) {
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
    channel: "email",
    expiresAt: "2026-09-15T12:10:00.000Z",
    resendAfterMs: 60_000,
  })),
  verify: vi.fn(async () => ({ valid: true })),
  ...overrides,
});

describe("maskEmail", () => {
  it("keeps the first and last letter and the whole domain", () => {
    expect(maskEmail("tegamaxwell@kinkord.com")).toBe("t*****l@kinkord.com");
  });

  it("handles very short local parts without giving them away", () => {
    expect(maskEmail("jo@kinkord.com")).toBe("j***@kinkord.com");
  });

  it("leaves anything that is not an address alone", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});

describe("EmailVerificationService", () => {
  it("emails the address on the account, never one from the request", async () => {
    const { db } = makeDb({ email: "tega@kinkord.com", verified: false });
    const codes = otp();
    const service = new EmailVerificationService(db as never, codes as never);

    const result = await service.sendCode("u1");

    expect(codes.send).toHaveBeenCalledWith("u1", "email", "tega@kinkord.com");
    expect(result.sentTo).toBe("t**a@kinkord.com");
  });

  it("does not re-verify an address that is already verified", async () => {
    const { db } = makeDb({ email: "tega@kinkord.com", verified: true });
    const codes = otp();
    const service = new EmailVerificationService(db as never, codes as never);

    await expect(service.sendCode("u1")).rejects.toThrow(/already verified/);
    expect(codes.send).not.toHaveBeenCalled();
  });

  it("marks the account verified once the code checks out", async () => {
    const { db, set } = makeDb({ email: "tega@kinkord.com", verified: false });
    const service = new EmailVerificationService(db as never, otp() as never);

    await expect(service.verify("u1", "otp-1", "123456")).resolves.toEqual({
      verified: true,
      attemptsLeft: null,
    });
    expect(set).toHaveBeenCalledWith({ emailVerified: true });
  });

  it("leaves the account alone on a wrong code and reports the attempts left", async () => {
    const { db, set } = makeDb({ email: "tega@kinkord.com", verified: false });
    const codes = otp({ verify: vi.fn(async () => ({ valid: false, attemptsLeft: 2 })) });
    const service = new EmailVerificationService(db as never, codes as never);

    await expect(service.verify("u1", "otp-1", "000000")).resolves.toEqual({
      verified: false,
      attemptsLeft: 2,
    });
    expect(set).not.toHaveBeenCalled();
  });
});
