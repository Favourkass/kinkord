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
    expect(typeof result.current.onDownload).toBe("function");
    expect(typeof result.current.downloadCta.onClick).toBe("function");
  });

  it("updates downloadCta label when installed", () => {
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(true);
    const { result } = renderHook(() => useLandingPresenter());

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.downloadCta.label).toBe("App Installed");
  });

  it("triggers downloadApp on click", async () => {
    const triggerSpy = vi.spyOn(pwaService, "triggerInstall");
    const { result } = renderHook(() => useLandingPresenter());

    await act(async () => {
      result.current.downloadCta.onClick?.();
    });

    expect(triggerSpy).not.toHaveBeenCalled(); // No deferredPrompt, so it opened guide instead
  });
});
