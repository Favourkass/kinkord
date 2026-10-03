// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { status, consent, submitLocation, refreshResidence, startFinancial } = vi.hoisted(() => ({
  status: vi.fn(),
  consent: vi.fn(),
  submitLocation: vi.fn(),
  refreshResidence: vi.fn(),
  startFinancial: vi.fn(),
}));
vi.mock("@/services/kyc.service", () => ({
  kycApi: { status, consent, submitLocation, refreshResidence, startFinancial },
}));

import { useKycPresenter } from "./useKycPresenter";

const progress = {
  status: "in_progress",
  fullKycVerified: false,
  locationPolicyVersion: "location-v1",
  residencePolicyVersion: "residence-v1",
  financialPolicyVersion: "financial-v1",
  consents: { location: false, residence: false, financial: false },
  stages: [
    {
      key: "identity" as const,
      title: "Identity",
      description: "Government ID and live biometric",
      available: true,
      status: "passed" as const,
      expiresAt: null,
    },
  ],
};

describe("useKycPresenter", () => {
  beforeEach(() => {
    status.mockReset().mockResolvedValue(progress);
    consent.mockReset().mockResolvedValue({});
    submitLocation.mockReset().mockResolvedValue({ status: "passed" });
    refreshResidence.mockReset().mockResolvedValue({ status: "passed" });
    startFinancial.mockReset().mockResolvedValue({ url: "https://mono.example/connect" });
  });

  it("maps stage status and requires explicit location consent", async () => {
    const { result } = renderHook(() => useKycPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view?.stages[0].statusLabel).toBe("Complete");

    act(() => result.current.captureLocation());
    await waitFor(() => expect(result.current.error).toContain("Confirm the location consent"));
    expect(consent).not.toHaveBeenCalled();
  });

  it("records residence consent and reuses completed Didit evidence", async () => {
    const { result } = renderHook(() => useKycPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setResidenceConsentAccepted(true));
    act(() => result.current.recordResidenceConsent());
    await waitFor(() => expect(refreshResidence).toHaveBeenCalledOnce());
    expect(consent).toHaveBeenCalledWith("residence", "residence-v1");
  });
});
