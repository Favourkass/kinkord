// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSignupWizardPresenter } from "./useSignupWizardPresenter";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const patch = vi.fn();
const post = vi.fn();
vi.mock("@/services/apiClient", () => ({
  api: {
    patch: (...a: unknown[]) => patch(...a),
    post: (...a: unknown[]) => post(...a),
    get: vi.fn(),
  },
  uploadToPresignedUrl: vi.fn(async () => {}),
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

  it("exposes totalSteps as 4", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    expect(result.current.totalSteps).toBe(4);
  });
});
