// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BronzeVerificationPM } from "@/domain/bronzeVerification";

const { router, replace, status, consent, start, resume, withdraw } = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    // One router for every render, as Next.js gives.
    router: { replace },
    replace,
    status: vi.fn(),
    consent: vi.fn(),
    start: vi.fn(),
    resume: vi.fn(),
    withdraw: vi.fn(),
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/bronzeVerification.service", () => ({
  bronzeVerificationApi: { status, consent, start, resume, withdraw },
}));

import { ApiError } from "@/services/apiClient";
import { useBronzeVerificationPresenter } from "./useBronzeVerificationPresenter";

const POLICY = "bronze-2026-10-03-identity-v3";
const pm = (over: Partial<BronzeVerificationPM> = {}): BronzeVerificationPM => ({
  available: true,
  status: "not_started",
  attemptsUsed: 0,
  attemptsRemaining: 3,
  consented: false,
  withdrawable: false,
  policyVersion: POLICY,
  policyUrl: "https://kinkord.com/privacy/verification",
  missing: [],
  photoReadyAt: null,
  resumable: false,
  lastFailure: null,
  ...over,
});
const pending = (over: Partial<BronzeVerificationPM> = {}) =>
  pm({ status: "pending", consented: true, withdrawable: true, attemptsUsed: 1, ...over });

async function loaded() {
  const hook = renderHook(() => useBronzeVerificationPresenter());
  await waitFor(() => expect(hook.result.current.view).not.toBeNull());
  return hook;
}

describe("useBronzeVerificationPresenter", () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("location", { ...window.location, assign });
    assign.mockReset();
    replace.mockReset();
    status.mockReset().mockResolvedValue(pm());
    consent.mockReset().mockResolvedValue(pm({ consented: true }));
    start.mockReset().mockResolvedValue({
      attemptId: "a1",
      provider: "didit",
      url: "https://verify.didit.me/session/abc",
    });
    resume.mockReset().mockResolvedValue({ url: "https://verify.didit.me/session/abc" });
    withdraw.mockReset().mockResolvedValue(pm());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("needs the consent box ticked, then records consent and sends the member to Didit", async () => {
    const { result } = await loaded();
    expect(result.current.view?.consent?.text).toContain("biometric");
    expect(result.current.view?.start?.enabled).toBe(false);
    expect(result.current.view?.start?.hint).toMatch(/Tick the box/);

    act(() => result.current.view?.consent?.onChange(true));
    expect(result.current.view?.start?.enabled).toBe(true);
    expect(result.current.view?.start?.hint).toBeNull();
    await act(async () => result.current.view?.start?.onClick());

    expect(consent).toHaveBeenCalledWith(POLICY);
    expect(start).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("https://verify.didit.me/session/abc");
  });

  it("won't open a link that isn't Didit's", async () => {
    start.mockResolvedValue({ attemptId: "a1", provider: "didit", url: "https://evil.example/x" });
    status.mockResolvedValue(pm({ consented: true }));
    const { result } = await loaded();
    await act(async () => result.current.view?.start?.onClick());
    expect(assign).not.toHaveBeenCalled();
    expect(result.current.view?.actionError).toMatch(/don't recognise/);
  });

  it("shows the API's reason when a check can't start", async () => {
    status.mockResolvedValue(pm({ consented: true }));
    start.mockRejectedValue(new ApiError(409, { message: "Verification is already in progress." }));
    const { result } = await loaded();
    await act(async () => result.current.view?.start?.onClick());
    expect(result.current.view?.actionError).toBe("Verification is already in progress.");
  });

  it("never agrees to consent wording this page doesn't have", async () => {
    status.mockResolvedValue(pm({ policyVersion: "bronze-2027-01-01-v4" }));
    const { result } = await loaded();
    expect(result.current.view?.consent).toBeNull();
    expect(result.current.view?.outdatedPage).toMatch(/Refresh/);
    expect(result.current.view?.start?.enabled).toBe(false);
  });

  it("asks before withdrawing consent, then shows the result", async () => {
    status.mockResolvedValue(pm({ consented: true, withdrawable: true, status: "verified" }));
    const { result } = await loaded();
    expect(result.current.view?.badgeHint?.href).toBe("/profile/edit/privacy");
    // Accurate whether or not the member has hidden their badge.
    expect(result.current.view?.status.detail).not.toMatch(/profile shows/);

    act(() => result.current.view?.withdraw?.onClick());
    expect(withdraw).not.toHaveBeenCalled();
    expect(result.current.view?.withdrawConfirm?.body).toMatch(/You can verify again later/);
    expect(result.current.view?.withdrawConfirm?.busyLabel).toBe("Withdrawing…");
    await act(async () => result.current.view?.withdrawConfirm?.onConfirm());

    expect(withdraw).toHaveBeenCalledTimes(1);
    expect(result.current.view?.status.label).toBe("Not verified");
    expect(result.current.view?.withdraw).toBeNull();
    expect(result.current.view?.notice).toBe(
      "Consent withdrawn. Anything Didit held for you is being erased.",
    );
  });

  it("tells rejected or revoked members that verifying again goes through support", async () => {
    for (const closed of ["rejected", "revoked"] as const) {
      status.mockResolvedValue(pm({ status: closed, consented: true, withdrawable: true }));
      const { result, unmount } = await loaded();
      act(() => result.current.view?.withdraw?.onClick());
      expect(result.current.view?.withdrawConfirm?.body).toMatch(/contact support/);
      expect(result.current.view?.withdrawConfirm?.body).not.toMatch(/verify again later/);
      unmount();
    }
  });

  it("keeps withdrawal visible after the privacy notice version changes", async () => {
    status.mockResolvedValue(
      pm({ consented: false, withdrawable: true, policyVersion: "bronze-2027-01-01-v4" }),
    );
    const { result } = await loaded();
    expect(result.current.view?.withdraw).not.toBeNull();
  });

  it("lists what the profile still needs and holds the button, saying why", async () => {
    status.mockResolvedValue(pm({ missing: ["profilePhoto", "gender"] }));
    const { result } = await loaded();
    expect(result.current.view?.needs?.items).toHaveLength(2);
    expect(result.current.view?.start?.visible).toBe(true);
    expect(result.current.view?.start?.enabled).toBe(false);
    expect(result.current.view?.start?.hint).toMatch(/to your profile first/);
  });

  it("never asks a member who can't start a check to change their profile", async () => {
    // A verified photo older than 90 days still counts as missing for a new check.
    for (const settled of [
      "verified",
      "pending",
      "manual_review",
      "rejected",
      "revoked",
    ] as const) {
      status.mockResolvedValue(pm({ status: settled, missing: ["profilePhoto"] }));
      const { result, unmount } = await loaded();
      expect(result.current.view?.needs).toBeNull();
      unmount();
    }
  });

  it("says when verification isn't switched on yet", async () => {
    status.mockResolvedValue(pm({ available: false }));
    const { result } = await loaded();
    expect(result.current.view?.unavailable).toBe("Verification isn't open yet.");
    expect(result.current.view?.start).toBeNull();
  });

  it("still lets a verified member withdraw while verification is off", async () => {
    status.mockResolvedValue(
      pm({ available: false, status: "verified", consented: true, withdrawable: true }),
    );
    const { result } = await loaded();
    expect(result.current.view?.status.label).toBe("Verified");
    expect(result.current.view?.unavailable).toBeNull();
    expect(result.current.view?.withdraw).not.toBeNull();
  });

  it("says why the last check didn't pass", async () => {
    status.mockResolvedValue(pm({ status: "failed", attemptsUsed: 1, lastFailure: "birth_date" }));
    const { result } = await loaded();
    expect(result.current.view?.status.failure).toMatch(
      /^The birth date on your ID doesn't match your profile\./,
    );
  });

  it("gives a general reason for one this page doesn't know, and none once it no longer applies", async () => {
    status.mockResolvedValue(
      pm({
        status: "rejected",
        lastFailure: "new_reason" as string as BronzeVerificationPM["lastFailure"],
      }),
    );
    const first = await loaded();
    expect(first.result.current.view?.status.failure).toMatch(/^Your check couldn't be completed/);
    first.unmount();

    status.mockResolvedValue(pm({ status: "verified", lastFailure: "face" }));
    const { result } = await loaded();
    expect(result.current.view?.status.failure).toBeNull();
  });

  it("shows a status this page doesn't know plainly instead of breaking", async () => {
    status.mockResolvedValue(pm({ status: "on_hold" as string as BronzeVerificationPM["status"] }));
    const { result } = await loaded();
    expect(result.current.view?.status).toMatchObject({
      label: "Status unavailable",
      tone: "neutral",
      failure: null,
    });
  });

  it("offers to continue a check the member left midway, instead of saying Didit is checking", async () => {
    status.mockResolvedValue(pending({ resumable: true }));
    const { result } = await loaded();
    expect(result.current.view?.status.detail).not.toMatch(/Didit is checking/);
    expect(result.current.view?.resume?.label).toBe("Continue verification");

    await act(async () => result.current.view?.resume?.onClick());
    expect(resume).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("https://verify.didit.me/session/abc");
    expect(result.current.view?.resume?.label).toBe("Opening Didit…");
  });

  it("doesn't offer to continue while Didit is checking", async () => {
    status.mockResolvedValue(pending());
    const { result } = await loaded();
    expect(result.current.view?.resume).toBeNull();
    expect(result.current.view?.status.detail).toMatch(/Didit is checking/);
  });

  it("won't continue to a link that isn't Didit's", async () => {
    status.mockResolvedValue(pending({ resumable: true }));
    resume.mockResolvedValue({ url: "https://evil.example/x" });
    const { result } = await loaded();
    await act(async () => result.current.view?.resume?.onClick());
    expect(assign).not.toHaveBeenCalled();
    expect(result.current.view?.actionError).toMatch(/don't recognise/);
  });

  it("just reloads the status when there's nothing left to continue", async () => {
    status.mockResolvedValueOnce(pending({ resumable: true })).mockResolvedValue(
      pm({
        status: "failed",
        attemptsUsed: 1,
        consented: true,
        lastFailure: "expired",
      }),
    );
    resume.mockRejectedValue(new ApiError(409, { message: "Nothing to resume." }));
    const { result } = await loaded();
    await act(async () => result.current.view?.resume?.onClick());
    await waitFor(() => expect(result.current.view?.status.label).toBe("Not passed"));
    expect(status).toHaveBeenCalledTimes(2);
    expect(result.current.view?.actionError).toBeNull();
    expect(result.current.view?.resume).toBeNull();
  });

  it("offers a retry when the status can't be loaded", async () => {
    status.mockRejectedValueOnce(new ApiError(0, "offline")).mockResolvedValue(pm());
    const { result } = renderHook(() => useBronzeVerificationPresenter());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.retryLabel).toBe("Try again");

    act(() => result.current.error?.onRetry());
    expect(result.current).toMatchObject({ loading: true, error: null });
    await waitFor(() => expect(result.current.view).not.toBeNull());
    expect(status).toHaveBeenCalledTimes(2);
  });

  it("sends a signed-out member to log in", async () => {
    status.mockRejectedValue(new ApiError(401, { message: "no session" }));
    renderHook(() => useBronzeVerificationPresenter());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  describe("while Didit is checking", () => {
    let visibility: DocumentVisibilityState = "visible";
    const setVisibility = (next: DocumentVisibilityState) =>
      act(() => {
        visibility = next;
        document.dispatchEvent(new Event("visibilitychange"));
      });
    /** Moves the clock on and returns how many times the status has been loaded. */
    const after = async (ms: number) => {
      await act(async () => vi.advanceTimersByTimeAsync(ms));
      return status.mock.calls.length;
    };

    beforeEach(() => {
      vi.useFakeTimers();
      visibility = "visible";
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibility,
      });
      status.mockResolvedValue(pending());
    });
    afterEach(() => {
      cleanup();
      vi.useRealTimers();
    });

    it("checks back after 15s, 30s and 60s, then every 2 minutes", async () => {
      renderHook(() => useBronzeVerificationPresenter());
      expect(await after(0)).toBe(1);
      expect(await after(14_999)).toBe(1);
      expect(await after(1)).toBe(2);
      expect(await after(29_999)).toBe(2);
      expect(await after(1)).toBe(3);
      expect(await after(59_999)).toBe(3);
      expect(await after(1)).toBe(4);
      expect(await after(119_999)).toBe(4);
      expect(await after(1)).toBe(5);
      expect(await after(120_000)).toBe(6);
    });

    it("asks nothing while the tab is hidden, and looks again on return", async () => {
      renderHook(() => useBronzeVerificationPresenter());
      expect(await after(0)).toBe(1);
      expect(await after(20_000)).toBe(2);
      setVisibility("hidden");
      expect(await after(10 * 60_000)).toBe(2);

      setVisibility("visible");
      expect(await after(0)).toBe(3);
      // The slow-down starts over from 15 seconds.
      expect(await after(15_000)).toBe(4);
    });

    it("stops once the status leaves pending", async () => {
      status
        .mockResolvedValueOnce(pending())
        .mockResolvedValue(pm({ status: "verified", consented: true, withdrawable: true }));
      const { result } = renderHook(() => useBronzeVerificationPresenter());
      expect(await after(0)).toBe(1);
      expect(await after(15_000)).toBe(2);
      expect(result.current.view?.status.label).toBe("Verified");
      expect(await after(10 * 60_000)).toBe(2);
    });

    it("doesn't let a check still on its way overwrite a withdrawal", async () => {
      const { result } = renderHook(() => useBronzeVerificationPresenter());
      expect(await after(0)).toBe(1);
      // The next check is slow to answer, and answers with what was true before.
      let answer: (value: BronzeVerificationPM) => void = () => undefined;
      status.mockReturnValueOnce(
        new Promise<BronzeVerificationPM>((resolve) => {
          answer = resolve;
        }),
      );
      expect(await after(15_000)).toBe(2);

      act(() => result.current.view?.withdraw?.onClick());
      await act(async () => result.current.view?.withdrawConfirm?.onConfirm());
      expect(result.current.view?.status.label).toBe("Not verified");

      await act(async () => answer(pending()));
      expect(result.current.view?.status.label).toBe("Not verified");
      expect(result.current.view?.notice).toMatch(/Consent withdrawn/);
    });
  });
});
