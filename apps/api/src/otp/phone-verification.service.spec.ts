import { ConflictException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { PhoneVerificationService, maskPhone } from "./phone-verification.service";

/**
 * Selects answer in order: the member's own profile row, then the accounts
 * that already have the number verified (none unless given).
 */
function makeDb(
  row: { phone: string | null; verified: boolean } | undefined,
  verifiedElsewhere: Array<{ userId: string }> = [],
) {
  const answers = [row ? [row] : [], verifiedElsewhere];
  const where = vi.fn(async (_clause: unknown) => answers.shift());
  const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  return {
    set,
    where,
    db: {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })),
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

  it("only accepts a code texted to the number on the profile now", async () => {
    const { db } = makeDb({ phone: "+2349127883266", verified: false });
    const codes = otp();
    const service = new PhoneVerificationService(db as never, codes as never);
    await service.verify("u1", "otp-1", "123456");
    expect(codes.verify).toHaveBeenCalledWith("u1", "otp-1", "123456", {
      channel: "sms",
      destination: "+2349127883266",
    });
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

  it("refuses a number already verified on another account, once the code proves it's theirs", async () => {
    const { db, set, where } = makeDb({ phone: "+2349127883266", verified: false }, [
      { userId: "u2" },
    ]);
    const service = new PhoneVerificationService(db as never, otp() as never);

    const attempt = service.verify("u1", "otp-1", "123456");
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow("This number is already verified on another account.");
    expect(set).not.toHaveBeenCalled();
    // Only another account's verified copy counts; unverified ones are anyone's typing.
    const lookup = new PgDialect().sqlToQuery(where.mock.calls[1][0] as never);
    expect(lookup.sql).toBe(
      '("profile"."phone" = $1 and "profile"."phone_verified" = $2 and "profile"."user_id" <> $3)',
    );
    expect(lookup.params).toEqual(["+2349127883266", true, "u1"]);
  });

  it("says nothing about other accounts to someone without the right code", async () => {
    const { db, where } = makeDb({ phone: "+2349127883266", verified: false }, [{ userId: "u2" }]);
    const codes = otp({ verify: vi.fn(async () => ({ valid: false, attemptsLeft: 2 })) });
    const service = new PhoneVerificationService(db as never, codes as never);

    await expect(service.verify("u1", "otp-1", "000000")).resolves.toEqual({
      verified: false,
      attemptsLeft: 2,
    });
    expect(where).toHaveBeenCalledTimes(1);
  });
});
