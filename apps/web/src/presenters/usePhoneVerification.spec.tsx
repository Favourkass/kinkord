// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePhoneVerification } from "./usePhoneVerification";

const sendCode = vi.fn();
const verifyCode = vi.fn();
vi.mock("@/services/phoneVerification.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/phoneVerification.service")>()),
  phoneVerificationApi: {
    sendCode: (...a: unknown[]) => sendCode(...a),
    verify: (...a: unknown[]) => verifyCode(...a),
  },
}));

const OTP_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  sendCode.mockReset().mockResolvedValue({
    otpId: OTP_ID,
    sentTo: "+234******3266",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    resendAfterMs: 60_000,
  });
  verifyCode.mockReset().mockResolvedValue({ verified: true, attemptsLeft: null });
});

describe("usePhoneVerification", () => {
  it("starts with nothing sent and no number to show", () => {
    const { result } = renderHook(() => usePhoneVerification());
    expect(result.current.sent).toBe(false);
    expect(result.current.phone).toBeNull();
    expect(result.current.verified).toBe(false);
  });

  it("sends a code and mirrors the API's cooldown", async () => {
    const { result } = renderHook(() => usePhoneVerification());
    await act(async () => result.current.sendCode());

    expect(result.current.sent).toBe(true);
    expect(result.current.phone).toBe("+234******3266");
    expect(result.current.resendIn).toBe(60);
    expect(result.current.canResend).toBe(false);
  });

  it("calls back once the code checks out", async () => {
    const onVerified = vi.fn();
    const { result } = renderHook(() => usePhoneVerification(onVerified));
    await act(async () => result.current.sendCode());
    act(() => result.current.setCode("123456"));
    await act(async () => result.current.verify());

    expect(verifyCode).toHaveBeenCalledWith(OTP_ID, "123456");
    expect(result.current.verified).toBe(true);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("clears the boxes and reports the tries left on a wrong code", async () => {
    verifyCode.mockResolvedValueOnce({ verified: false, attemptsLeft: 2 });
    const onVerified = vi.fn();
    const { result } = renderHook(() => usePhoneVerification(onVerified));
    await act(async () => result.current.sendCode());
    act(() => result.current.setCode("000000"));
    await act(async () => result.current.verify());

    expect(result.current.error).toMatch(/2 tries left/);
    expect(result.current.code).toBe("");
    expect(result.current.verified).toBe(false);
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("does not call the API with a half-typed code", async () => {
    const { result } = renderHook(() => usePhoneVerification());
    await act(async () => result.current.sendCode());
    act(() => result.current.setCode("12"));
    await act(async () => result.current.verify());

    expect(verifyCode).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/6-digit/);
  });

  it("does nothing if verify is pressed before a code was ever sent", async () => {
    const { result } = renderHook(() => usePhoneVerification());
    act(() => result.current.setCode("123456"));
    await act(async () => result.current.verify());

    expect(verifyCode).not.toHaveBeenCalled();
  });

  it("reports a refusal rather than pretending the code was sent", async () => {
    sendCode.mockRejectedValueOnce(new Error("429"));
    const { result } = renderHook(() => usePhoneVerification());
    act(() => result.current.sendCode());

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.sent).toBe(false);
  });
});
