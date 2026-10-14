// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { OTHER_AREA } from "@/services/signupLocation.service";
import { useSignupWizardPresenter } from "./useSignupWizardPresenter";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const patch = vi.fn();
const post = vi.fn();
const get = vi.fn<(...a: unknown[]) => Promise<Record<string, unknown>>>(async () => ({
  phone: "+2348031234567",
}));
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
    get: (...a: unknown[]) => get(...a),
  },
  uploadToPresignedUrl: vi.fn(async () => {}),
}));

// Uploads skip the canvas work: the file goes up as it is.
vi.mock("@/util/image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/util/image")>()),
  buildUploadSet: async (file: File) => ({ original: file, variants: { sm: file, md: file } }),
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
    get.mockReset().mockImplementation(async (path) =>
      path === "/profile/options"
        ? { kinks: ["Bondage"], lookingFor: ["Friendship"] }
        : {
            interests: [],
            lookingFor: [],
            limits: null,
            avatarUrl: null,
            coverUrl: null,
            roles: [],
          },
    );
    patch.mockReset().mockResolvedValue({ avatarUrl: "a", coverUrl: "c" });
    post.mockReset().mockResolvedValue({});
    push.mockReset();
    sendCode.mockReset().mockResolvedValue({
      otpId: "11111111-1111-4111-8111-111111111111",
      sentTo: "tega@kinkord.com",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      resendAfterMs: 60_000,
    });
    verifyCode.mockReset().mockResolvedValue({ verified: true, attemptsLeft: null });
  });

  it("defaults to Nigeria and clears locations when the country changes", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    expect(result.current.stepOne.country).toBe("NG");
    expect(result.current.aboutStep.location.states).toHaveLength(37);
    act(() =>
      result.current.aboutStep.set({
        ...result.current.aboutStep.draft,
        state: "Lagos",
        city: "Ikeja",
      }),
    );
    act(() => result.current.stepOne.setCountry("KE"));
    expect(result.current.aboutStep.draft.state).toBe("");
    expect(result.current.aboutStep.draft.city).toBe("");
    expect(result.current.aboutStep.location.states).toHaveLength(47);
    act(() => result.current.stepOne.setCountry("NG"));
    expect(result.current.aboutStep.location.states).toHaveLength(37);
  });

  it.each([
    ["NG", "Lagos", "Ikeja"],
    ["KE", "Nairobi", "Westlands"],
  ])("clears a dependent town when the parent changes for %s", (country, state, city) => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    act(() => result.current.stepOne.setCountry(country));
    act(() => result.current.aboutStep.selectState(state));
    act(() => result.current.aboutStep.selectArea(city));
    expect(result.current.aboutStep.draft.city).toBe(city);
    act(() => result.current.aboutStep.selectArea(OTHER_AREA));
    expect(result.current.aboutStep.location.customArea).toBe(true);
    expect(result.current.aboutStep.draft.city).toBe("");
    act(() =>
      result.current.aboutStep.set({ ...result.current.aboutStep.draft, city: "New Town" }),
    );
    expect(result.current.aboutStep.draft.city).toBe("New Town");
    expect(result.current.aboutStep.areaValue).toBe(OTHER_AREA);
    act(() => result.current.aboutStep.selectState(state === "Lagos" ? "Delta" : "Kiambu"));
    expect(result.current.aboutStep.draft.city).toBe("");
    expect(result.current.aboutStep.location.customArea).toBe(false);
  });

  it.each([
    ["KE", "Nairobi", "Nairobi"],
    ["NG", "Lagos", "Ikeja"],
  ])("submits the chosen country and region for %s", async (country, state, city) => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    reachCombinedStep(result);
    act(() => result.current.stepOne.setCountry(country));
    fillAccount(result);
    fillAbout(result);
    act(() => result.current.aboutStep.set({ ...result.current.aboutStep.draft, state, city }));
    await act(() => result.current.submitCombinedStep());
    expect(post).toHaveBeenCalledWith(
      "/auth-ext/sign-up",
      expect.objectContaining({ country, state, city }),
    );
    expect(result.current.stage).toBe("email");
  });

  it("submits the selected sexuality with the profile details", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    reachCombinedStep(result);
    fillAccount(result);
    fillAbout(result);
    act(() =>
      result.current.aboutStep.set({ ...result.current.aboutStep.draft, orientation: "Bisexual" }),
    );
    await act(() => result.current.submitCombinedStep());
    expect(post).toHaveBeenCalledWith(
      "/auth-ext/sign-up",
      expect.objectContaining({ orientation: "Bisexual" }),
    );
  });

  it("stores no sexuality when the member goes back to Prefer not to say", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    reachCombinedStep(result);
    fillAccount(result);
    fillAbout(result);
    act(() =>
      result.current.aboutStep.set({ ...result.current.aboutStep.draft, orientation: "Straight" }),
    );
    act(() => result.current.aboutStep.set({ ...result.current.aboutStep.draft, orientation: "" }));
    expect(result.current.aboutStep.sexuality.clearLabel).toBe("Prefer not to say");
    await act(() => result.current.submitCombinedStep());
    expect(post).toHaveBeenCalledWith(
      "/auth-ext/sign-up",
      expect.objectContaining({ orientation: null }),
    );
  });

  it("skips photos and their upload confirmation while saving selected roles", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter("profile"));
    await waitFor(() => expect(get).toHaveBeenCalledWith("/profile"));
    act(() => result.current.profileStep.toggleRole("Acolyte"));
    await act(() => result.current.profileStep.skipPhotos());
    expect(patch).toHaveBeenCalledWith("/profile", {
      roles: ["Acolyte"],
      signupPhotosSkipped: true,
    });
    expect(result.current.stage).toBe("welcome");
  });

  it("does not overwrite existing roles when skipping a resumed photo step without editing roles", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter("profile"));
    await act(() => result.current.profileStep.skipPhotos());
    expect(patch).toHaveBeenCalledWith("/profile", { signupPhotosSkipped: true });
  });

  it("does not complete signup when saving the photo skip fails", async () => {
    patch.mockRejectedValueOnce(new Error("Skip failed"));
    const { result } = renderHook(() => useSignupWizardPresenter("profile"));
    await act(() => result.current.profileStep.skipPhotos());
    expect(result.current.stage).toBe("profile");
    expect(result.current.profileStep.error).toBe("Skip failed");
  });

  it("searches new roles without clearing selected roles", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    act(() => result.current.profileStep.toggleRole("Acolyte"));
    act(() => result.current.profileStep.setRoleSearch("aftercare"));
    expect(result.current.profileStep.roleOptions).toEqual([
      "Aftercare Buddy",
      "Aftercare Specialist",
    ]);
    expect(result.current.profileStep.roles).toEqual(["Acolyte"]);
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
    expect(result.current.topError).toBe("Fill in the fields marked in red above.");
    expect(result.current.firstInvalid).toEqual({ field: "username" });
    expect(post).not.toHaveBeenCalled();
  });

  it("says by the button which fields to fix, and points the screen at the first", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    reachCombinedStep(result);
    fillAccount(result);
    fillAbout(result);
    act(() => {
      result.current.accountStep.set({
        ...result.current.accountStep.draft,
        confirmPassword: "different123",
      });
      result.current.aboutStep.set({ ...result.current.aboutStep.draft, gender: null });
    });

    await act(() => result.current.submitCombinedStep());

    expect(result.current.topError).toBe("Check your password confirmation and gender above.");
    expect(result.current.firstInvalid).toEqual({ field: "confirmPassword" });
    expect(post).not.toHaveBeenCalled();

    // Tapping again with the same mistake scrolls again: a new object each time.
    const first = result.current.firstInvalid;
    await act(() => result.current.submitCombinedStep());
    expect(result.current.firstInvalid).not.toBe(first);
  });

  it("posts account + about and advances to email verification", async () => {
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
      }),
    );
    expect(result.current.stage).toBe("email");
    await waitFor(() => expect(sendCode).toHaveBeenCalledWith("email"));
    expect(sendCode.mock.calls.filter(([channel]) => channel === "email")).toHaveLength(1);

    expect(post.mock.calls[0][1]).not.toHaveProperty("phone");
    act(() => result.current.verifyStep.nextStep());
    expect(result.current.stage).toBe("email");
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

  it("exposes totalSteps as 5", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    expect(result.current.totalSteps).toBe(5);
  });

  describe("email verification", () => {
    beforeEach(() => {
      sendCode.mockReset().mockResolvedValue({
        otpId: "11111111-1111-4111-8111-111111111111",
        sentTo: "tega@kinkord.com",
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAfterMs: 60_000,
      });
      verifyCode.mockReset().mockResolvedValue({ verified: true, attemptsLeft: null });
    });

    it("advances to preferences only after email verification, without SMS", async () => {
      const { result } = renderHook(() => useSignupWizardPresenter());
      reachCombinedStep(result);
      fillAccount(result);
      fillAbout(result);
      await act(() => result.current.submitCombinedStep());
      await waitFor(() => expect(sendCode).toHaveBeenCalledWith("email"));
      act(() => result.current.verifyStep.nextStep());
      expect(result.current.stage).toBe("email");
      act(() => result.current.verifyStep.email.setCode("123456"));
      await act(() => result.current.verifyStep.email.verify());
      act(() => result.current.verifyStep.nextStep());
      expect(result.current.stage).toBe("preferences");
      expect(result.current.step).toBe(4);
      expect(sendCode).not.toHaveBeenCalledWith("phone");
      expect(verifyCode).toHaveBeenCalledWith(
        "email",
        "11111111-1111-4111-8111-111111111111",
        "123456",
      );
    });
  });

  describe("coming back to the email step", () => {
    const meSays = (emailVerified: boolean) => {
      const fallback = get.getMockImplementation();
      get.mockImplementation(async (path) =>
        path === "/me" ? { emailVerified } : fallback!(path),
      );
    };

    it("sends a code to a member the email hold sent back, and waits for it", async () => {
      meSays(false);
      const { result } = renderHook(() => useSignupWizardPresenter("email"));
      await waitFor(() => expect(sendCode).toHaveBeenCalledWith("email"));
      expect(get).toHaveBeenCalledWith("/me");
      expect(result.current.stage).toBe("email");
      expect(result.current.step).toBe(3);
      act(() => result.current.verifyStep.email.setCode("123456"));
      await act(() => result.current.verifyStep.email.verify());
      act(() => result.current.verifyStep.nextStep());
      expect(result.current.stage).toBe("preferences");
    });

    it("moves on without a code when the email was verified meanwhile", async () => {
      meSays(true);
      const { result } = renderHook(() => useSignupWizardPresenter("email"));
      await waitFor(() => expect(result.current.stage).toBe("preferences"));
      expect(sendCode).not.toHaveBeenCalled();
    });
  });

  describe("welcome", () => {
    it("says the email is verified once it was verified here", async () => {
      const { result } = renderHook(() => useSignupWizardPresenter());
      reachCombinedStep(result);
      fillAccount(result);
      fillAbout(result);
      await act(() => result.current.submitCombinedStep());
      await waitFor(() => expect(sendCode).toHaveBeenCalledWith("email"));
      act(() => result.current.verifyStep.email.setCode("123456"));
      await act(() => result.current.verifyStep.email.verify());
      expect(result.current.welcome.emailVerified).toBe(true);
    });

    it.each([true, false])(
      "asks the account whether the email is verified (%s) when that step was done before",
      async (emailVerified) => {
        const fallback = get.getMockImplementation();
        get.mockImplementation(async (path) =>
          path === "/me" ? { emailVerified } : fallback!(path),
        );
        const { result } = renderHook(() => useSignupWizardPresenter("profile"));
        expect(result.current.welcome.emailVerified).toBe(false);
        await act(() => result.current.profileStep.skipPhotos());
        expect(result.current.stage).toBe("welcome");
        await waitFor(() => expect(get).toHaveBeenCalledWith("/me"));
        await waitFor(() => expect(result.current.welcome.emailVerified).toBe(emailVerified));
      },
    );
  });

  describe("preferences step", () => {
    it("edits and saves preferences before advancing to step 5", async () => {
      const { result } = renderHook(() => useSignupWizardPresenter("preferences"));
      await waitFor(() => expect(result.current.preferencesStep.canContinue).toBe(true));
      act(() => result.current.preferencesStep.rows[0].onClick());
      act(() =>
        result.current.preferencesStep.editor?.onDraft({ kind: "multi", value: ["Bondage"] }),
      );
      act(() => result.current.preferencesStep.editor?.onSave());
      expect(result.current.preferencesStep.rows[0].subtitle).toBe("Bondage");
      await act(() => result.current.preferencesStep.submit());
      expect(patch).toHaveBeenCalledWith("/profile", {
        interests: ["Bondage"],
        lookingFor: [],
        limits: null,
      });
      expect(result.current.stage).toBe("profile");
      expect(result.current.step).toBe(5);
    });
    it("keeps the step and draft when the server refuses the save", async () => {
      patch.mockRejectedValueOnce(new Error("Save failed"));
      const { result } = renderHook(() => useSignupWizardPresenter("preferences"));
      await waitFor(() => expect(result.current.preferencesStep.canContinue).toBe(true));
      await act(() => result.current.preferencesStep.submit());
      expect(result.current.stage).toBe("preferences");
      expect(result.current.preferencesStep.error).toBe("Save failed");
    });
    it("reports option loading errors and allows retry", async () => {
      get.mockRejectedValueOnce(new Error("Load failed"));
      const { result } = renderHook(() => useSignupWizardPresenter("preferences"));
      await waitFor(() => expect(result.current.preferencesStep.error).toBe("Load failed"));
      expect(result.current.preferencesStep.canContinue).toBe(false);
      act(() => result.current.preferencesStep.retry());
      await waitFor(() => expect(result.current.preferencesStep.canContinue).toBe(true));
      expect(result.current.preferencesStep.canSkip).toBe(false);
    });
    it("lets the member go on to the photos without preferences when they can't load", async () => {
      get.mockRejectedValue(new Error("Load failed"));
      const { result } = renderHook(() => useSignupWizardPresenter("preferences"));
      await waitFor(() => expect(result.current.preferencesStep.canSkip).toBe(true));
      act(() => result.current.preferencesStep.skip());
      expect(result.current.stage).toBe("profile");
      expect(result.current.step).toBe(5);
      expect(patch).not.toHaveBeenCalled();
    });
  });

  describe("skipping the photos", () => {
    const profileSays = (canSkipPhotos: boolean) => {
      const fallback = get.getMockImplementation();
      get.mockImplementation(async (path) =>
        path === "/profile"
          ? { avatarUrl: null, coverUrl: null, roles: [], canSkipPhotos }
          : fallback!(path),
      );
    };

    it.each([true, false])("is offered only when the profile allows it (%s)", async (allowed) => {
      profileSays(allowed);
      const { result } = renderHook(() => useSignupWizardPresenter("profile"));
      expect(result.current.profileStep.canSkipPhotos).toBe(false);
      await waitFor(() => expect(get).toHaveBeenCalledWith("/profile"));
      await waitFor(() => expect(result.current.profileStep.canSkipPhotos).toBe(allowed));
    });

    it("is asked about on the way through sign-up too", async () => {
      profileSays(true);
      const { result } = renderHook(() => useSignupWizardPresenter("preferences"));
      await waitFor(() => expect(result.current.preferencesStep.canContinue).toBe(true));
      await act(() => result.current.preferencesStep.submit());
      expect(result.current.stage).toBe("profile");
      await waitFor(() => expect(result.current.profileStep.canSkipPhotos).toBe(true));
    });

    it("stops being offered once a profile photo is up", async () => {
      profileSays(true);
      post.mockResolvedValue({
        key: "avatars/u1/a.jpg",
        uploadUrl: "https://s3/put",
        variantUploadUrls: { sm: "https://s3/sm", md: "https://s3/md" },
        maxSizeMb: 5,
      });
      patch.mockResolvedValue({
        avatarUrl: "https://media/a.jpg",
        coverUrl: null,
        canSkipPhotos: false,
      });
      const { result } = renderHook(() => useSignupWizardPresenter("profile"));
      await waitFor(() => expect(result.current.profileStep.canSkipPhotos).toBe(true));
      act(() => result.current.profileStep.confirmation.onConfirmedChange(true));
      const file = new File([new Uint8Array(10)], "avatar.jpg", { type: "image/jpeg" });
      await act(() => result.current.profileStep.uploadImage("avatar", file));
      expect(result.current.profileStep.avatarUrl).toBe("https://media/a.jpg");
      expect(result.current.profileStep.canSkipPhotos).toBe(false);
    });
  });

  describe("coming back to the photo step", () => {
    it("starts from the photo and roles already on file", async () => {
      get.mockResolvedValueOnce({
        phoneVerified: true,
        avatarUrl: "https://media.kinkord.com/avatars/u1/a.jpg",
        coverUrl: null,
        roles: ["Switch"],
      });
      const { result } = renderHook(() => useSignupWizardPresenter("profile"));
      expect(result.current.stage).toBe("profile");
      expect(result.current.profileStep.resumed).toBe(true);

      await waitFor(() =>
        expect(result.current.profileStep.avatarUrl).toBe(
          "https://media.kinkord.com/avatars/u1/a.jpg",
        ),
      );
      expect(get).toHaveBeenCalledWith("/profile");
      expect(result.current.profileStep.coverUrl).toBeNull();
      expect(result.current.profileStep.roles).toEqual(["Switch"]);
    });

    it("still needs both photos before it finishes", async () => {
      get.mockResolvedValueOnce({
        phoneVerified: false,
        avatarUrl: "https://media.kinkord.com/avatars/u1/a.jpg",
        coverUrl: null,
        roles: [],
      });
      const { result } = renderHook(() => useSignupWizardPresenter("profile"));
      await waitFor(() => expect(result.current.profileStep.avatarUrl).not.toBeNull());

      await act(() => result.current.profileStep.submit());

      expect(result.current.profileStep.error).toBe(
        "Profile photo and cover picture are required.",
      );
      expect(result.current.stage).toBe("profile");
      expect(patch).not.toHaveBeenCalled();
    });
  });
});

// A state's towns are fetched once it is picked: every test here serves the
// generated /locations files from disk instead of the network.
const townsFetch = vi.fn(async (url: string) => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  return new Response(readFileSync(resolve(__dirname, "../../public", `.${url}`), "utf8"));
});
beforeEach(() => {
  townsFetch.mockClear();
  vi.stubGlobal("fetch", townsFetch);
  return () => vi.unstubAllGlobals();
});

describe("useSignupWizardPresenter towns", () => {
  it("fetches a state's towns once it is picked", async () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    expect(result.current.aboutStep.location.areas).toEqual([]);
    expect(townsFetch).not.toHaveBeenCalled();
    act(() => result.current.aboutStep.selectState("Oyo"));
    expect(result.current.aboutStep.location.areaEmptyLabel).toMatch(/^Loading/);
    await waitFor(() =>
      expect(result.current.aboutStep.location.areas.map((o) => o.value)).toContain("Bodija"),
    );
    expect(townsFetch).toHaveBeenCalledWith("/locations/NG/oyo.json");
    expect(result.current.aboutStep.location.areaEmptyLabel).toBe("No matching areas");
    // Areas members picked from the older list are still offered.
    expect(result.current.aboutStep.location.areas.map((o) => o.value)).toContain("Oluyole");
  });

  it("keeps a typed town when the same state or Other is picked again", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    act(() => result.current.aboutStep.selectState("Lagos"));
    act(() => result.current.aboutStep.selectArea(OTHER_AREA));
    act(() => result.current.aboutStep.set({ ...result.current.aboutStep.draft, city: "Ikota" }));
    act(() => result.current.aboutStep.selectArea(OTHER_AREA));
    act(() => result.current.aboutStep.selectState("Lagos"));
    expect(result.current.aboutStep.draft.city).toBe("Ikota");
    expect(result.current.aboutStep.location.customArea).toBe(true);
    act(() => result.current.aboutStep.selectState("Delta"));
    expect(result.current.aboutStep.draft.city).toBe("");
    expect(result.current.aboutStep.location.customArea).toBe(false);
  });

  it("takes a searched-for town nobody listed as the custom one", () => {
    const { result } = renderHook(() => useSignupWizardPresenter());
    act(() => result.current.aboutStep.selectState("Lagos"));
    expect(result.current.aboutStep.location.otherArea?.typedLabel("Ikota")).toBe("Use “Ikota”");
    act(() => result.current.aboutStep.location.otherArea?.onTyped("Ikota Villa"));
    expect(result.current.aboutStep.areaValue).toBe(OTHER_AREA);
    expect(result.current.aboutStep.location.customArea).toBe(true);
    expect(result.current.aboutStep.draft.city).toBe("Ikota Villa");
  });
});
