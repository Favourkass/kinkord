// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

let pathname = "/home";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { usePwaPresenter } = await import("./usePwaPresenter");
const { pwaService } = await import("@/services/pwa.service");
const { ageGateService } = await import("@/services/ageGate.service");
type BeforeInstallPromptEvent = import("@/services/pwa.service").BeforeInstallPromptEvent;

describe("usePwaPresenter", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    ageGateService.reset();
    pathname = "/home";
    pwaService.setDeferredPrompt(null);
    pwaService.closeInstallGuide();
    vi.spyOn(pwaService, "registerServiceWorker").mockResolvedValue(null);
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(false);
    vi.spyOn(pwaService, "isIosDevice").mockReturnValue(false);
    vi.spyOn(pwaService, "isOnline").mockReturnValue(true);
    vi.spyOn(pwaService, "isSlowOrSavingData").mockReturnValue(false);
    vi.spyOn(pwaService, "preloadImage").mockResolvedValue();
  });

  it("initializes with default states and registers service worker", () => {
    const registerSpy = vi.spyOn(pwaService, "registerServiceWorker");
    const { result } = renderHook(() => usePwaPresenter());

    expect(registerSpy).toHaveBeenCalled();
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isIos).toBe(false);
    expect(result.current.isInstallable).toBe(false);
  });

  it("marks as installable when beforeinstallprompt event is received", async () => {
    const { result } = renderHook(() => usePwaPresenter());

    act(() => {
      pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    });

    await waitFor(() => expect(result.current.isInstallable).toBe(true));
    expect(result.current.canPromptDirectly).toBe(true);
  });

  it("shows on the landing page once the visitor has answered the age question", async () => {
    pathname = "/";
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    const { result } = renderHook(() => usePwaPresenter());
    expect(result.current.isInstallable).toBe(false);
    // The card's still is fetched while the question is up, so it's there when it opens.
    expect(pwaService.preloadImage).toHaveBeenCalledWith("/brand/kinkord-install-still.webp");

    act(() => ageGateService.confirm());
    await waitFor(() => expect(result.current.isInstallable).toBe(true));
  });

  it("shows to signed-out visitors anywhere else, without the age question", async () => {
    pathname = "/login";
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    const { result } = renderHook(() => usePwaPresenter());
    await waitFor(() => expect(result.current.isInstallable).toBe(true));
  });

  it("handles promptInstall trigger and updates isInstalled when accepted", async () => {
    const mockEvent = {} as BeforeInstallPromptEvent;
    pwaService.setDeferredPrompt(mockEvent);

    const triggerSpy = vi.spyOn(pwaService, "triggerInstall").mockImplementation(async () => {
      pwaService.setDeferredPrompt(null);
      vi.spyOn(pwaService, "isStandalone").mockReturnValue(true);
      return "accepted";
    });

    const { result } = renderHook(() => usePwaPresenter());

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(triggerSpy).toHaveBeenCalledWith(mockEvent);
  });

  it("puts the prompt off for this visit only: the next visit asks again", async () => {
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    const { result } = renderHook(() => usePwaPresenter());
    await waitFor(() => expect(result.current.isInstallable).toBe(true));

    act(() => result.current.dismissPrompt());
    expect(result.current.isInstallable).toBe(false);
    // Another page in the same visit: still put off.
    expect(renderHook(() => usePwaPresenter()).result.current.isInstallable).toBe(false);

    sessionStorage.clear(); // a new visit
    const nextVisit = renderHook(() => usePwaPresenter());
    await waitFor(() => expect(nextVisit.result.current.isInstallable).toBe(true));
  });

  it("asks again after tapping install, if the app isn't installed on the next visit", async () => {
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    vi.spyOn(pwaService, "downloadApp").mockResolvedValue("dismissed");
    const { result } = renderHook(() => usePwaPresenter());
    await act(async () => {
      await result.current.downloadApp();
    });
    expect(result.current.isInstallable).toBe(false);
    sessionStorage.clear();
    const nextVisit = renderHook(() => usePwaPresenter());
    await waitFor(() => expect(nextVisit.result.current.isInstallable).toBe(true));
  });

  it("stays away for good after Don't show again", async () => {
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    const { result } = renderHook(() => usePwaPresenter());
    await waitFor(() => expect(result.current.isInstallable).toBe(true));
    act(() => result.current.neverShowPrompt());
    expect(result.current.isInstallable).toBe(false);
    sessionStorage.clear();
    expect(renderHook(() => usePwaPresenter()).result.current.isInstallable).toBe(false);
  });

  it("forgets the old week's snooze, so it shows again", async () => {
    localStorage.setItem("kinkord_pwa_install_snoozed_until", String(Date.now() + 86_400_000));
    localStorage.setItem("kinkord_pwa_install_dismissed", "true");
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    const { result } = renderHook(() => usePwaPresenter());
    await waitFor(() => expect(result.current.isInstallable).toBe(true));
    expect(localStorage.getItem("kinkord_pwa_install_snoozed_until")).toBeNull();
  });

  it("plays the motion, except on a data saver or 2G, where the still stays", () => {
    const { result } = renderHook(() => usePwaPresenter());
    expect(result.current.installArtwork).toMatchObject({
      still: "/brand/kinkord-install-still.webp",
      motion: "/brand/kinkord-install.mp4",
    });
    vi.spyOn(pwaService, "isSlowOrSavingData").mockReturnValue(true);
    expect(renderHook(() => usePwaPresenter()).result.current.installArtwork.motion).toBeNull();
  });

  it("recognizes iOS installable state when not standalone and not dismissed", async () => {
    vi.spyOn(pwaService, "isIosDevice").mockReturnValue(true);
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(false);

    const { result } = renderHook(() => usePwaPresenter());

    expect(result.current.isIos).toBe(true);
    await waitFor(() => expect(result.current.isInstallable).toBe(true));
  });

  it("tracks offline/online state changes", () => {
    let onOfflineCallback: (() => void) | null = null;
    let onOnlineCallback: (() => void) | null = null;

    vi.spyOn(pwaService, "addNetworkStatusListener").mockImplementation((onOnline, onOffline) => {
      onOnlineCallback = onOnline;
      onOfflineCallback = onOffline;
      return () => {};
    });

    const isOnlineSpy = vi.spyOn(pwaService, "isOnline").mockReturnValue(true);

    const { result } = renderHook(() => usePwaPresenter());
    expect(result.current.isOffline).toBe(false);

    act(() => {
      isOnlineSpy.mockReturnValue(false);
      if (onOfflineCallback) onOfflineCallback();
    });
    expect(result.current.isOffline).toBe(true);

    act(() => {
      isOnlineSpy.mockReturnValue(true);
      if (onOnlineCallback) onOnlineCallback();
    });
    expect(result.current.isOffline).toBe(false);
  });

  it("handles openInstallGuide and closeInstallGuide", () => {
    const { result } = renderHook(() => usePwaPresenter());
    expect(result.current.showInstallGuide).toBe(false);

    act(() => {
      result.current.openInstallGuide();
    });
    expect(result.current.showInstallGuide).toBe(true);

    act(() => {
      result.current.closeInstallGuide();
    });
    expect(result.current.showInstallGuide).toBe(false);
  });

  it("downloadApp triggers direct prompt when deferredPrompt is present", async () => {
    const mockEvent = {} as BeforeInstallPromptEvent;
    pwaService.setDeferredPrompt(mockEvent);
    const triggerSpy = vi.spyOn(pwaService, "triggerInstall").mockResolvedValue("accepted");

    const { result } = renderHook(() => usePwaPresenter());
    expect(result.current.canPromptDirectly).toBe(true);

    await act(async () => {
      await result.current.downloadApp();
    });

    expect(triggerSpy).toHaveBeenCalledWith(mockEvent);
    expect(result.current.showInstallGuide).toBe(false);
  });

  it("downloadApp opens install guide when no deferredPrompt is available", async () => {
    const { result } = renderHook(() => usePwaPresenter());
    expect(result.current.canPromptDirectly).toBe(false);

    await act(async () => {
      await result.current.downloadApp();
    });

    expect(result.current.showInstallGuide).toBe(true);
  });

  it("downloadApp opens install guide when direct prompt is dismissed/failed", async () => {
    const mockEvent = {} as BeforeInstallPromptEvent;
    pwaService.setDeferredPrompt(mockEvent);
    vi.spyOn(pwaService, "triggerInstall").mockResolvedValue("dismissed");

    const { result } = renderHook(() => usePwaPresenter());

    await act(async () => {
      await result.current.downloadApp();
    });

    expect(result.current.showInstallGuide).toBe(true);
    act(() => result.current.closeInstallGuide());
    expect(result.current.isInstallable).toBe(false);
  });

  it("never offers installation inside the installed app", () => {
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(true);
    vi.spyOn(pwaService, "isIosDevice").mockReturnValue(true);
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    const { result } = renderHook(() => usePwaPresenter());
    expect(result.current.isInstallable).toBe(false);
  });
});
