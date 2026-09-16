// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSignupWizardPresenter } from "./useSignupWizardPresenter";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const patch = vi.fn();
const post = vi.fn();
vi.mock("@/services/apiClient", () => ({
  // ApiError must be exported: verificationErrorMessage does `instanceof ApiError`,
  // which throws outright if the binding is undefined.
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      super(`HTTP ${status}`);
    }
  },
  api: {
    patch: (...a: unknown[]) => patch(...a),
    post: (...a: unknown[]) => post(...a),
    get: vi.fn(),
  },
  uploadToPresignedUrl: vi.fn(async () => {}),
}));

const sendCode = vi.fn();
const verifyCode = vi.fn();
vi.mock("@/services/verification.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/verification.service")>()),
  verificationApi: {
    sendCode: (...a: unknown[]) => sendCode(...a),
    verify: (...a: unknown[]) => verifyCode(...a),
  },
}));

const fillAccount = (result: { current: ReturnType<typeof useSignupWizardPresenter> }) =>
  act(() =>
    result.current.accountStep.set({
      username: "@TegaMaxwell",
      displayName: "Sir T",
      email: "tega@kinkord.com",
      phoneLocal: "0803 123 4567",
      phoneCountryCode: "+234",
      password: "supersecret123",
      confirmPassword: "supersecret123",
    }),
  );

const fillAbout = (result: { current: ReturnType<typeof useSignupWizardPresenter> }) =>
  act(() =>
    result.current.aboutStep.set({
      state: "Delta",
      city: "Sapele",
      dobDay: 4,
      dobMonth: 8,
      dobYear: 1999,
      gender: "male",
    }),
  );

const reachCombinedStep = (result: { current: ReturnType<typeof useSignupWizardPresenter> }) => {
  act(() => {
    result.current.stepOne.setCountry("NG");
    result.current.stepOne.setAgeAttested(true);
    result.current.stepOne.setTermsAccepted(true);
  });
  act(() => result.current.stepOne.submit());
};

describe("useSignupWizardPresenter", () => {
  beforeEach(() => {
    patch.mockReset().mockResolvedValue({ avatarUrl: "a", coverUrl: "c" });
    post.mockReset().mockResolvedValue({});
    push.mockReset();
  });

  it("blocks step 1 until country + both confirmations are set", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    act(() => result.current.stepOne.submit());
    expect(result.current.stage).toBe("country");
    reachCombinedStep(result);
    expect(result.current.stage).toBe("account");
  });

  it("keeps the combined step in place with field errors when invalid", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    reachCombinedStep(result);

    await act(() => result.current.submitCombinedStep());

    expect(result.current.stage).toBe("account");
    expect(Object.keys(result.current.accountStep.errors).length).toBeGreaterThan(0);
    expect(Object.keys(result.current.aboutStep.errors).length).toBeGreaterThan(0);
    expect(post).not.toHaveBeenCalled();
  });

  it("posts account + about to the combined sign-up endpoint and advances to verify", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    reachCombinedStep(result);
    fillAccount(result);
    fillAbout(result);

    await act(() => result.current.submitCombinedStep());

    expect(post).toHaveBeenCalledWith(
      "/auth-ext/sign-up",
      expect.objectContaining({
        email: "tega@kinkord.com",
        displayName: "Sir T",
        username: "tegamaxwell",
        country: "NG",
        state: "Delta",
        dateOfBirth: "1999-08-04",
        gender: "male",
        phone: "+2348031234567",
      }),
    );
    expect(result.current.stage).toBe("verify");
    // The address was typed moments ago, so the email code goes out on arrival —
    // once, not on every render.
    await waitFor(() => expect(sendCode).toHaveBeenCalledWith("email"));
    expect(sendCode.mock.calls.filter(([c]) => c === "email")).toHaveLength(1);

    act(() => result.current.verifyStep.skip());
    expect(result.current.stage).toBe("profile");
  });

  it("surfaces a server error on the combined step without advancing", async () => {
    post.mockRejectedValue(new Error("Email already exists"));
    const { result } = renderHook(() => useSignupWizardPresenter());
    reachCombinedStep(result);
    fillAccount(result);
    fillAbout(result);

    await act(() => result.current.submitCombinedStep());

    expect(result.current.topError).toBe("Email already exists");
    expect(result.current.stage).toBe("account");
  });

  it("refuses to complete the profile without both images and confirmations", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    await act(() => result.current.profileStep.submit());
    expect(result.current.profileStep.error).toMatch(/required/);
    expect(result.current.stage).toBe("country");
  });

  it("blocks photo selection until the safety confirmation is accepted", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    const file = new File([new Uint8Array(10)], "avatar.jpg", { type: "image/jpeg" });

    await act(() => result.current.profileStep.uploadImage("avatar", file));

    expect(post).not.toHaveBeenCalledWith("/profile/upload-url", expect.anything());
    expect(result.current.profileStep.error).toMatch(/Confirm the Profile & Cover Photo/);
    expect(result.current.profileStep.confirmation.confirmed).toBe(false);

    // The tiles are disabled before the guard can run, so the hint is what the
    // member actually sees.
    expect(result.current.profileStep.lockedHint).toMatch(/enable uploads/);

    act(() => result.current.profileStep.confirmation.onConfirmedChange(true));
    expect(result.current.profileStep.confirmation.confirmed).toBe(true);
    expect(result.current.profileStep.error).toBeNull();
    expect(result.current.profileStep.lockedHint).toBeNull();
  });

  it("exposes totalSteps as 4", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    expect(result.current.totalSteps).toBe(4);
  });

  describe("phone verification", () => {
    beforeEach(() => {
      sendCode.mockReset().mockResolvedValue({
        otpId: "11111111-1111-4111-8111-111111111111",
        sentTo: "+234******4567",
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAfterMs: 60_000,
      });
      verifyCode.mockReset().mockResolvedValue({ verified: true, attemptsLeft: null });
    });

    it("keeps phone verification behind the email next step", async () => {
      const { result } = renderHook(() => useSignupWizardPresenter());
      reachCombinedStep(result);
      fillAccount(result);
      fillAbout(result);

      await act(() => result.current.submitCombinedStep());
      await waitFor(() => expect(sendCode).toHaveBeenCalledWith("email"));
      expect(result.current.verifyStep.channel).toBe("email");

      act(() => result.current.verifyStep.email.setCode("123456"));
      await act(async () => result.current.verifyStep.email.verify());

      expect(result.current.verifyStep.email.verified).toBe(true);
      expect(result.current.verifyStep.channel).toBe("email");
      expect(result.current.stage).toBe("verify");

      act(() => result.current.verifyStep.nextStep());
      expect(result.current.verifyStep.channel).toBe("phone");
      expect(result.current.stage).toBe("verify");
    });

    it("asks the API to text a code and shows the masked number", async () => {
      const { result } = renderHook(() => useSignupWizardPresenter());
      expect(result.current.verifyStep.sent).toBe(false);

      await act(async () => result.current.verifyStep.sendCode());

      expect(sendCode).toHaveBeenCalled();
      expect(result.current.verifyStep.sent).toBe(true);
      expect(result.current.verifyStep.sentTo).toBe("+234******4567");
      // Cooldown starts immediately so the resend link cannot be hammered.
      expect(result.current.verifyStep.canResend).toBe(false);
      expect(result.current.verifyStep.resendIn).toBe(60);
    });

    it("moves on to the profile step once the code checks out", async () => {
      const { result } = renderHook(() => useSignupWizardPresenter());
      await act(async () => result.current.verifyStep.sendCode());
      act(() => result.current.verifyStep.setCode("123456"));
      await act(async () => result.current.verifyStep.verify());

      expect(verifyCode).toHaveBeenCalledWith(
        "phone",
        "11111111-1111-4111-8111-111111111111",
        "123456",
      );
      expect(result.current.verifyStep.verified).toBe(true);
      expect(result.current.stage).toBe("profile");
    });

    it("clears the boxes and says how many tries are left on a wrong code", async () => {
      verifyCode.mockResolvedValueOnce({ verified: false, attemptsLeft: 2 });
      const { result } = renderHook(() => useSignupWizardPresenter());
      await act(async () => result.current.verifyStep.sendCode());
      act(() => result.current.verifyStep.setCode("000000"));
      await act(async () => result.current.verifyStep.verify());

      expect(result.current.verifyStep.error).toMatch(/2 tries left/);
      expect(result.current.verifyStep.code).toBe("");
      // A wrong code must not advance the wizard.
      expect(result.current.stage).not.toBe("profile");
    });

    it("will not call the API with a half-typed code", async () => {
      const { result } = renderHook(() => useSignupWizardPresenter());
      await act(async () => result.current.verifyStep.sendCode());
      act(() => result.current.verifyStep.setCode("12"));
      await act(async () => result.current.verifyStep.verify());

      expect(verifyCode).not.toHaveBeenCalled();
      expect(result.current.verifyStep.error).toMatch(/6-digit/);
    });

    it("surfaces a refusal instead of pretending the code was sent", async () => {
      sendCode.mockRejectedValueOnce(new Error("429"));
      const { result } = renderHook(() => useSignupWizardPresenter());
      act(() => result.current.verifyStep.sendCode());

      await waitFor(() => expect(result.current.verifyStep.error).toBeTruthy());
      expect(result.current.verifyStep.sent).toBe(false);
    });

    it("still lets someone skip verification", () => {
      const { result } = renderHook(() => useSignupWizardPresenter());
      act(() => result.current.verifyStep.skip());
      expect(result.current.stage).toBe("profile");
    });
  });
});
