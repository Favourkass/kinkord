// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLandingPresenter } from "./useLandingPresenter";
import { BeforeInstallPromptEvent, pwaService } from "@/services/pwa.service";

describe("useLandingPresenter", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
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

    expect(result.current.brand).toBe("KINKORD");
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.downloadCta.label).toBe("Download Kinkord");
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

  it("opens the install guide on click when no native prompt is available", async () => {
    const { result } = renderHook(() => useLandingPresenter());

    await act(async () => {
      result.current.downloadCta.onClick?.();
    });

    expect(pwaService.getIsInstallGuideOpen()).toBe(true);
  });
});
