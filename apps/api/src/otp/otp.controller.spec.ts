import { describe, expect, it, vi } from "vitest";
import { OtpController } from "./otp.controller";

const req = (id: string) => ({ user: { id } }) as never;

const phone = () => ({
  sendCode: vi.fn(async () => ({
    otpId: "0f1c8b1e-1111-4111-8111-111111111111",
    sentTo: "+234******3266",
    expiresAt: "2026-09-15T13:20:00.000Z",
    resendAfterMs: 60_000,
  })),
  verify: vi.fn(async () => ({ verified: true, attemptsLeft: null })),
});

describe("OtpController", () => {
  it("never passes a destination — the number comes from the session's own profile", async () => {
    const service = phone();
    const controller = new OtpController(service as never);

    await controller.sendCode(req("u1"));

    expect(service.sendCode).toHaveBeenCalledWith("u1");
    expect(service.sendCode).toHaveBeenCalledTimes(1);
  });

  it("verifies with the caller's id, not anything from the body", async () => {
    const service = phone();
    const controller = new OtpController(service as never);

    await controller.verify(req("u1"), {
      otpId: "0f1c8b1e-1111-4111-8111-111111111111",
      code: "123456",
      userId: "someone-else",
    });

    expect(service.verify).toHaveBeenCalledWith(
      "u1",
      "0f1c8b1e-1111-4111-8111-111111111111",
      "123456",
    );
  });

  it("rejects a code that is not six digits", () => {
    const service = phone();
    const controller = new OtpController(service as never);

    expect(() =>
      controller.verify(req("u1"), {
        otpId: "0f1c8b1e-1111-4111-8111-111111111111",
        code: "12345",
      }),
    ).toThrow(/6-digit/);
    expect(service.verify).not.toHaveBeenCalled();
  });

  it("rejects a challenge id that is not a uuid", () => {
    const service = phone();
    const controller = new OtpController(service as never);

    expect(() => controller.verify(req("u1"), { otpId: "not-a-uuid", code: "123456" })).toThrow();
    expect(service.verify).not.toHaveBeenCalled();
  });
});
