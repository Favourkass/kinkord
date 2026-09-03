// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BeforeInstallPromptEvent, PwaService } from "./pwa.service";

describe("PwaService", () => {
  let pwaService: PwaService;

  beforeEach(() => {
    pwaService = new PwaService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerServiceWorker", () => {
    it("returns null if serviceWorker is not supported in navigator", async () => {
      const origSW = navigator.serviceWorker;
      Object.defineProperty(navigator, "serviceWorker", {
        value: undefined,
        configurable: true,
      });

      const res = await pwaService.registerServiceWorker();
      expect(res).toBeNull();

      Object.defineProperty(navigator, "serviceWorker", {
        value: origSW,
        configurable: true,
      });
    });

    it("registers serviceWorker successfully when supported", async () => {
      const mockRegistration = { scope: "/" } as ServiceWorkerRegistration;
      const registerMock = vi.fn().mockResolvedValue(mockRegistration);

      Object.defineProperty(navigator, "serviceWorker", {
        value: { register: registerMock },
        configurable: true,
      });

      const res = await pwaService.registerServiceWorker("/sw.js");
      expect(registerMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
      expect(res).toBe(mockRegistration);
    });

    it("handles registration rejection gracefully returning null", async () => {
      const registerMock = vi.fn().mockRejectedValue(new Error("SW failed"));

      Object.defineProperty(navigator, "serviceWorker", {
        value: { register: registerMock },
        configurable: true,
      });

      const res = await pwaService.registerServiceWorker();
      expect(res).toBeNull();
    });
  });

  describe("isStandalone", () => {
    it("returns true when display-mode matches standalone", () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(pwaService.isStandalone()).toBe(true);
    });

    it("returns false in standard browser tab", () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(pwaService.isStandalone()).toBe(false);
    });
  });

  describe("isIosDevice", () => {
    it("identifies iPhone user agent", () => {
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      );
      expect(pwaService.isIosDevice()).toBe(true);
    });

    it("identifies Android user agent as not iOS", () => {
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7)",
      );
      expect(pwaService.isIosDevice()).toBe(false);
    });
  });

  describe("isAndroidDevice", () => {
    it("identifies Android user agent", () => {
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7)",
      );
      expect(pwaService.isAndroidDevice()).toBe(true);
    });

    it("identifies iPhone user agent as not Android", () => {
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      );
      expect(pwaService.isAndroidDevice()).toBe(false);
    });
  });

  describe("isOnline", () => {
    it("checks navigator.onLine", () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      expect(pwaService.isOnline()).toBe(true);

      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      expect(pwaService.isOnline()).toBe(false);
    });
  });

  describe("addNetworkStatusListener", () => {
    it("adds and removes event listeners for online and offline", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const removeSpy = vi.spyOn(window, "removeEventListener");

      const onOnline = vi.fn();
      const onOffline = vi.fn();

      const unsubscribe = pwaService.addNetworkStatusListener(onOnline, onOffline);
      expect(addSpy).toHaveBeenCalledWith("online", onOnline);
      expect(addSpy).toHaveBeenCalledWith("offline", onOffline);

      unsubscribe();
      expect(removeSpy).toHaveBeenCalledWith("online", onOnline);
      expect(removeSpy).toHaveBeenCalledWith("offline", onOffline);
    });
  });

  describe("setupInstallPromptListener & triggerInstall", () => {
    it("attaches beforeinstallprompt and prevents default", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const onPromptAvailable = vi.fn();

      const unsubscribe = pwaService.setupInstallPromptListener(onPromptAvailable);
      expect(addSpy).toHaveBeenCalledWith("beforeinstallprompt", expect.any(Function));

      unsubscribe();
    });

    it("triggers install prompt and returns userChoice outcome", async () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      } as unknown as BeforeInstallPromptEvent;

      const outcome = await pwaService.triggerInstall(mockEvent);
      expect(mockEvent.prompt).toHaveBeenCalled();
      expect(outcome).toBe("accepted");
    });

    it("clears deferredPrompt even when user dismisses the prompt", async () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
      } as unknown as BeforeInstallPromptEvent;

      pwaService.setDeferredPrompt(mockEvent);
      expect(pwaService.getDeferredPrompt()).toBe(mockEvent);

      const outcome = await pwaService.triggerInstall(mockEvent);
      expect(outcome).toBe("dismissed");
      expect(pwaService.getDeferredPrompt()).toBeNull();
      expect(pwaService.getIsInstalling()).toBe(false);
    });

    it("returns 'failed' if event is null or prompt fails", async () => {
      const outcome = await pwaService.triggerInstall(null);
      expect(outcome).toBe("failed");
    });
  });

  describe("guide and prompt store methods", () => {
    it("handles guide open, close, and subscription", () => {
      const listener = vi.fn();
      const unsub = pwaService.subscribeGuide(listener);

      expect(pwaService.getIsInstallGuideOpen()).toBe(false);

      pwaService.openInstallGuide();
      expect(pwaService.getIsInstallGuideOpen()).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);

      pwaService.closeInstallGuide();
      expect(pwaService.getIsInstallGuideOpen()).toBe(false);
      expect(listener).toHaveBeenCalledTimes(2);

      unsub();
      pwaService.openInstallGuide();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("handles prompt set and subscription", () => {
      const listener = vi.fn();
      const unsub = pwaService.subscribePrompt(listener);

      expect(pwaService.getDeferredPrompt()).toBeNull();

      const mockEvent = {} as BeforeInstallPromptEvent;
      pwaService.setDeferredPrompt(mockEvent);
      expect(pwaService.getDeferredPrompt()).toBe(mockEvent);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      pwaService.setDeferredPrompt(null);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("downloadApp triggers direct prompt when deferredPrompt is available", async () => {
      const mockEvent = {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      } as unknown as BeforeInstallPromptEvent;

      pwaService.setDeferredPrompt(mockEvent);

      const outcome = await pwaService.downloadApp();
      expect(outcome).toBe("accepted");
      expect(pwaService.getDeferredPrompt()).toBeNull();
      expect(pwaService.getIsInstalled()).toBe(true);
    });

    it("downloadApp opens install guide when deferredPrompt is not available", async () => {
      pwaService.setDeferredPrompt(null);

      const outcome = await pwaService.downloadApp();
      expect(outcome).toBe("failed");
      expect(pwaService.getIsInstallGuideOpen()).toBe(true);
    });
  });
});
