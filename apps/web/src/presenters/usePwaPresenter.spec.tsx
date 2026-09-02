// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePwaPresenter } from "./usePwaPresenter";
import { BeforeInstallPromptEvent, pwaService } from "@/services/pwa.service";

describe("usePwaPresenter", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    pwaService.setDeferredPrompt(null);
    pwaService.closeInstallGuide();
    vi.spyOn(pwaService, "registerServiceWorker").mockResolvedValue(null);
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(false);
    vi.spyOn(pwaService, "isIosDevice").mockReturnValue(false);
    vi.spyOn(pwaService, "isOnline").mockReturnValue(true);
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

  it("marks as installable when beforeinstallprompt event is received", () => {
    const { result } = renderHook(() => usePwaPresenter());

    act(() => {
      pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    });

    expect(result.current.isInstallable).toBe(true);
    expect(result.current.canPromptDirectly).toBe(true);
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

  it("dismisses prompt and persists dismissed state", () => {
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);

    const { result } = renderHook(() => usePwaPresenter());
    expect(result.current.isInstallable).toBe(true);

    act(() => {
      result.current.dismissPrompt();
    });

    expect(result.current.isInstallable).toBe(false);
    expect(localStorage.getItem("kinkord_pwa_install_dismissed")).toBe("true");
  });

  it("recognizes iOS installable state when not standalone and not dismissed", () => {
    vi.spyOn(pwaService, "isIosDevice").mockReturnValue(true);
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(false);

    const { result } = renderHook(() => usePwaPresenter());

    expect(result.current.isIos).toBe(true);
    expect(result.current.isInstallable).toBe(true);
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
  });
});
