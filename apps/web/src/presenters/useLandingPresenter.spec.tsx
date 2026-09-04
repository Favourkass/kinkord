// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLandingPresenter } from "./useLandingPresenter";
import { pwaService } from "@/services/pwa.service";

describe("useLandingPresenter", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(pwaService, "registerServiceWorker").mockResolvedValue(null);
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(false);
    vi.spyOn(pwaService, "isIosDevice").mockReturnValue(false);
    vi.spyOn(pwaService, "isAndroidDevice").mockReturnValue(false);
    vi.spyOn(pwaService, "isOnline").mockReturnValue(true);
  });

  it("provides landing VM data merged with PWA state and onDownload handler", () => {
    const { result } = renderHook(() => useLandingPresenter());

    expect(result.current.brand).toBe("KINKORD");
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.downloadCta.label).toBe("Download Kinkord");
    expect(result.current.ageDisclaimer.lead).toBe("18+ Only.");
    expect(result.current.joinAgeDisclaimer).toBe("You must be 18 years or older to join.");
    expect(result.current.policyLinks).toHaveLength(6);
    expect(result.current.allRightsReserved).toBe("All rights reserved.");
    expect(typeof result.current.onDownload).toBe("function");
    expect(typeof result.current.downloadCta.onClick).toBe("function");
  });

  it("updates downloadCta label when installed", () => {
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(true);
    const { result } = renderHook(() => useLandingPresenter());

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.downloadCta.label).toBe("App Installed");
  });

  it("updates downloadCta label when installing", () => {
    vi.spyOn(pwaService, "getIsInstalling").mockReturnValue(true);
    const { result } = renderHook(() => useLandingPresenter());

    expect(result.current.downloadCta.label).toBe("Installing...");
  });

  it("triggers promptInstall on click when prompt is available", async () => {
    const mockEvent = {} as any;
    pwaService.setDeferredPrompt(mockEvent);
    const triggerSpy = vi.spyOn(pwaService, "triggerInstall").mockResolvedValue("accepted");
    const { result } = renderHook(() => useLandingPresenter());

    await act(async () => {
      result.current.downloadCta.onClick?.();
    });

    expect(triggerSpy).toHaveBeenCalledWith(mockEvent);
  });

  it("shows age gate when age has not been confirmed, and closes it upon confirmation", async () => {
    const { result } = renderHook(() => useLandingPresenter());

    expect(result.current.showAgeGate).toBe(true);

    await act(async () => {
      result.current.onConfirmAge();
    });

    expect(result.current.showAgeGate).toBe(false);
  });
});
