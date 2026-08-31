// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSignupWizardPresenter } from "./useSignupWizardPresenter";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const signUp = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: { signUp: { email: (...a: unknown[]) => signUp(...a) } },
}));

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

describe("useSignupWizardPresenter", () => {
  beforeEach(() => {
    signUp.mockReset().mockResolvedValue({ data: {}, error: null });
    patch.mockReset().mockResolvedValue({ avatarUrl: "a", coverUrl: "c" });
    post.mockReset();
  });

  it("blocks step 1 until country + both confirmations are set", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    act(() => result.current.stepOne.submit());
    expect(result.current.stage).toBe("country");
    act(() => {
      result.current.stepOne.setCountry("NG");
      result.current.stepOne.setAgeAttested(true);
      result.current.stepOne.setTermsAccepted(true);
    });
    act(() => result.current.stepOne.submit());
    expect(result.current.stage).toBe("account");
  });

  it("keeps invalid account drafts on the account stage with field errors", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    act(() => result.current.accountStep.submit());
    expect(result.current.stage).toBe("country"); // unchanged; also errors recorded
    expect(Object.keys(result.current.accountStep.errors).length).toBeGreaterThan(0);
  });

  it("signs up with normalized username and posts wizard data to the profile", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    act(() => {
      result.current.stepOne.setCountry("NG");
      result.current.stepOne.setAgeAttested(true);
      result.current.stepOne.setTermsAccepted(true);
    });
    act(() => result.current.stepOne.submit());
    fillAccount(result);
    act(() => result.current.accountStep.submit());
    expect(result.current.stage).toBe("about");

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
    await act(() => result.current.aboutStep.submit());

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ username: "tegamaxwell", ageAttested: true, name: "Sir T" }),
    );
    expect(patch).toHaveBeenCalledWith(
      "/profile",
      expect.objectContaining({
        country: "NG",
        state: "Delta",
        dateOfBirth: "1999-08-04",
        phone: "+2348031234567",
      }),
    );
    expect(result.current.stage).toBe("verify");

    act(() => result.current.verifyStep.skip());
    expect(result.current.stage).toBe("profile");
  });

  it("refuses to complete the profile without both images and confirmations", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    await act(() => result.current.profileStep.submit());
    expect(result.current.profileStep.error).toMatch(/required/);
    expect(result.current.stage).toBe("country");
  });
});
