// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { communityStatsService } from "@/services/communityStats.service";
import { act, cleanup, renderHook } from "@testing-library/react";
import { ageGateService } from "@/services/ageGate.service";
import { useLandingPresenter } from "./useLandingPresenter";
import { BeforeInstallPromptEvent, pwaService } from "@/services/pwa.service";

describe("useLandingPresenter", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  beforeEach(() => {
    ageGateService.reset();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(communityStatsService, "read").mockResolvedValue(null);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    // Reset shared singleton state between tests.
    pwaService.setDeferredPrompt(null);
    pwaService.closeInstallGuide();
    vi.spyOn(pwaService, "registerServiceWorker").mockResolvedValue(null);
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(false);
    vi.spyOn(pwaService, "isIosDevice").mockReturnValue(false);
    vi.spyOn(pwaService, "isAndroidDevice").mockReturnValue(false);
    vi.spyOn(pwaService, "isOnline").mockReturnValue(true);
  });

  it("provides landing VM data merged with PWA state and onDownload handler", () => {
    const { result } = renderHook(() => useLandingPresenter());

    expect(result.current.brand).toBe("Kinkord");
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.downloadCta.label).toBe("Download Kinkord");
    expect(result.current.ageDisclaimer.lead).toBe("18+ Only.");
    expect(result.current.joinAgeDisclaimer).toBe("You must be 18 years or older to join.");
    expect(result.current.policyLinks).toHaveLength(8);
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

  it("fires the native install prompt on click when one is available", async () => {
    const mockEvent = {} as unknown as BeforeInstallPromptEvent;
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
  it("uses the live count and refreshes only while the page is visible", async () => {
    vi.useFakeTimers();
    const read = vi.mocked(communityStatsService.read).mockResolvedValue({ members: 12487 });
    const { result, unmount } = renderHook(() => useLandingPresenter());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.membership.count).toBe("12,487");
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(read).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    read.mockResolvedValue({ members: 12488 });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.membership.count).toBe("12,488");
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("shows an honest placeholder when the count is unavailable", async () => {
    const { result } = renderHook(() => useLandingPresenter());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.membership.count).toBe("—");
  });
});
