// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

let pathname = "/home";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
const getSession = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: { getSession: (...a: unknown[]) => getSession(...a) },
}));

const { usePwaPresenter } = await import("./usePwaPresenter");
const { pwaService } = await import("@/services/pwa.service");
type BeforeInstallPromptEvent = import("@/services/pwa.service").BeforeInstallPromptEvent;

const signedIn = { data: { user: { id: "u1" } } };

describe("usePwaPresenter", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    pathname = "/home";
    getSession.mockReset().mockResolvedValue(signedIn);
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

  it("marks as installable when beforeinstallprompt event is received", async () => {
    const { result } = renderHook(() => usePwaPresenter());

    act(() => {
      pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    });

    await waitFor(() => expect(result.current.isInstallable).toBe(true));
    expect(result.current.canPromptDirectly).toBe(true);
  });

  it("never covers a page for a signed-out visitor, and offers once they sign in", async () => {
    getSession.mockResolvedValue({ data: null });
    pathname = "/";
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    const { result, rerender } = renderHook(() => usePwaPresenter());
    expect(getSession).not.toHaveBeenCalled();
    expect(result.current.isInstallable).toBe(false);

    getSession.mockResolvedValue(signedIn);
    pathname = "/home";
    rerender();
    await waitFor(() => expect(result.current.isInstallable).toBe(true));
  });

  it("offers the landing animation to guests even without a native install event", () => {
    getSession.mockResolvedValue({ data: null });
    pathname = "/";
    const landing = renderHook(() => usePwaPresenter({ landing: true }));
    const global = renderHook(() => usePwaPresenter());
    expect(landing.result.current.isInstallable).toBe(true);
    expect(global.result.current.isInstallable).toBe(false);
    expect(getSession).not.toHaveBeenCalled();
    act(() => landing.result.current.dismissPrompt());
    expect(landing.result.current.isInstallable).toBe(false);
    const nextVisit = renderHook(() => usePwaPresenter({ landing: true }));
    expect(nextVisit.result.current.isInstallable).toBe(false);
  });

  it("synchronizes dismissal across existing presenter instances", async () => {
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);
    const first = renderHook(() => usePwaPresenter({ landing: true }));
    const second = renderHook(() => usePwaPresenter());
    await waitFor(() => expect(second.result.current.isInstallable).toBe(true));
    act(() => first.result.current.dismissPrompt());
    expect(second.result.current.isInstallable).toBe(false);
  });

  it("does not offer the landing animation inside the installed app", () => {
    vi.spyOn(pwaService, "isStandalone").mockReturnValue(true);
    const { result } = renderHook(() => usePwaPresenter({ landing: true }));
    expect(result.current.isInstallable).toBe(false);
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

  it("puts the prompt off for a week across visits, not the old banner's for good", async () => {
    localStorage.setItem("kinkord_pwa_install_dismissed", "true");
    pwaService.setDeferredPrompt({} as BeforeInstallPromptEvent);

    const { result } = renderHook(() => usePwaPresenter());
    await waitFor(() => expect(result.current.isInstallable).toBe(true));

    act(() => {
      result.current.dismissPrompt();
    });

    expect(result.current.isInstallable).toBe(false);
    const nextVisit = renderHook(() => usePwaPresenter());
    await waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(nextVisit.result.current.isInstallable).toBe(false);
    expect(Number(localStorage.getItem("kinkord_pwa_install_snoozed_until"))).toBeGreaterThan(
      Date.now() + 6 * 86_400_000,
    );
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
