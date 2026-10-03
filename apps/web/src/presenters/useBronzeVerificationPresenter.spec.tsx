// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BronzeVerificationPM } from "@/domain/bronzeVerification";

const { router, replace, status, consent, start, withdraw } = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    // One router for every render, as Next.js gives.
    router: { replace },
    replace,
    status: vi.fn(),
    consent: vi.fn(),
    start: vi.fn(),
    withdraw: vi.fn(),
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/bronzeVerification.service", () => ({
  bronzeVerificationApi: { status, consent, start, withdraw },
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
  policyVersion: POLICY,
  policyUrl: "https://kinkord.com/privacy/verification",
  missing: [],
  photoReadyAt: null,
  ...over,
});

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
    withdraw.mockReset().mockResolvedValue(pm());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("needs the consent box ticked, then records consent and sends the member to Didit", async () => {
    const { result } = await loaded();
    expect(result.current.view?.consent?.text).toContain("biometric");
    expect(result.current.view?.start?.enabled).toBe(false);

    act(() => result.current.view?.consent?.onChange(true));
    expect(result.current.view?.start?.enabled).toBe(true);
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
    status.mockResolvedValue(pm({ consented: true, status: "verified" }));
    const { result } = await loaded();
    expect(result.current.view?.badgeHint?.href).toBe("/profile/edit/privacy");

    act(() => result.current.view?.withdraw?.onClick());
    expect(withdraw).not.toHaveBeenCalled();
    await act(async () => result.current.view?.withdrawConfirm?.onConfirm());

    expect(withdraw).toHaveBeenCalledTimes(1);
    expect(result.current.view?.status.label).toBe("Not verified");
    expect(result.current.view?.withdraw).toBeNull();
    expect(result.current.view?.notice).toMatch(/withdrawn/);
  });

  it("lists what the profile still needs and holds the button", async () => {
    status.mockResolvedValue(pm({ missing: ["profilePhoto", "gender"] }));
    const { result } = await loaded();
    expect(result.current.view?.needs?.items).toHaveLength(2);
    expect(result.current.view?.start?.visible).toBe(true);
    expect(result.current.view?.start?.enabled).toBe(false);
  });

  it("says when verification isn't switched on yet", async () => {
    status.mockResolvedValue(pm({ available: false }));
    const { result } = await loaded();
    expect(result.current.view?.unavailable).toMatch(/isn't open yet/);
    expect(result.current.view?.start).toBeNull();
  });

  it("sends a signed-out member to log in", async () => {
    status.mockRejectedValue(new ApiError(401, { message: "no session" }));
    renderHook(() => useBronzeVerificationPresenter());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
