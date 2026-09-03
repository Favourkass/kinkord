export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = "accepted" | "dismissed" | "failed";

export class PwaService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstallGuideOpen = false;
  private isInstalledViaPrompt = false;
  private promptSubscribers = new Set<() => void>();
  private guideSubscribers = new Set<() => void>();
  private globalListenerAttached = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.attachGlobalListeners();
    }
  }

  /**
   * Attaches window event listeners for PWA lifecycle events.
   */
  attachGlobalListeners(): void {
    if (typeof window === "undefined" || this.globalListenerAttached) {
      return;
    }

    const syncEarlyPrompt = () => {
      const early = (window as unknown as { __kinkord_pwa_prompt?: BeforeInstallPromptEvent | null }).__kinkord_pwa_prompt;
      if (early && !this.deferredPrompt) {
        this.deferredPrompt = early;
        this.notifyPromptSubscribers();
      }
    };

    syncEarlyPrompt();

    window.addEventListener("kinkord:prompt-ready", syncEarlyPrompt);

    window.addEventListener("beforeinstallprompt", (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent;
      promptEvent.preventDefault?.();
      this.deferredPrompt = promptEvent;
      (window as unknown as { __kinkord_pwa_prompt?: BeforeInstallPromptEvent | null }).__kinkord_pwa_prompt = promptEvent;
      this.notifyPromptSubscribers();
    });

    window.addEventListener("appinstalled", () => {
      this.deferredPrompt = null;
      (window as unknown as { __kinkord_pwa_prompt?: BeforeInstallPromptEvent | null }).__kinkord_pwa_prompt = null;
      this.isInstalledViaPrompt = true;
      this.isInstallGuideOpen = false;
      this.notifyPromptSubscribers();
      this.notifyGuideSubscribers();
    });

    this.globalListenerAttached = true;
  }

  getDeferredPrompt(): BeforeInstallPromptEvent | null {
    if (!this.deferredPrompt && typeof window !== "undefined") {
      const early = (window as unknown as { __kinkord_pwa_prompt?: BeforeInstallPromptEvent | null }).__kinkord_pwa_prompt;
      if (early) {
        this.deferredPrompt = early;
      }
    }
    return this.deferredPrompt;
  }

  setDeferredPrompt(prompt: BeforeInstallPromptEvent | null): void {
    this.deferredPrompt = prompt;
    this.notifyPromptSubscribers();
  }

  subscribePrompt(callback: () => void): () => void {
    this.promptSubscribers.add(callback);
    return () => {
      this.promptSubscribers.delete(callback);
    };
  }

  private notifyPromptSubscribers(): void {
    this.promptSubscribers.forEach((cb) => cb());
  }

  getIsInstallGuideOpen(): boolean {
    return this.isInstallGuideOpen;
  }

  openInstallGuide(): void {
    this.isInstallGuideOpen = true;
    this.notifyGuideSubscribers();
  }

  closeInstallGuide(): void {
    this.isInstallGuideOpen = false;
    this.notifyGuideSubscribers();
  }

  subscribeGuide(callback: () => void): () => void {
    this.guideSubscribers.add(callback);
    return () => {
      this.guideSubscribers.delete(callback);
    };
  }

  private notifyGuideSubscribers(): void {
    this.guideSubscribers.forEach((cb) => cb());
  }

  getIsInstalled(): boolean {
    return this.isStandalone() || this.isInstalledViaPrompt;
  }

  /**
   * Triggers native prompt if available, or opens the install guide modal.
   */
  async downloadApp(): Promise<InstallOutcome> {
    if (this.deferredPrompt) {
      const outcome = await this.triggerInstall(this.deferredPrompt);
      if (outcome === "accepted") {
        return "accepted";
      }
    }

    this.openInstallGuide();
    return "failed";
  }

  /**
   * Registers the service worker in supported browser environments.
   */
  async registerServiceWorker(swUrl = "/sw.js"): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: "/",
      });
      return registration;
    } catch {
      return null;
    }
  }

  /**
   * Determines if the app is currently running in standalone (installed) mode.
   */
  isStandalone(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    const isMediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
    const isNavStandalone = Boolean(
      (window.navigator as unknown as { standalone?: boolean })?.standalone
    );

    return isMediaStandalone || isNavStandalone;
  }

  /**
   * Detects if the current client is an iOS device (iPhone/iPad/iPod).
   */
  isIosDevice(): boolean {
    if (typeof window === "undefined" || !navigator.userAgent) {
      return false;
    }

    const ua = navigator.userAgent;
    const isIosUa = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isIpadOs =
      typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      (navigator.maxTouchPoints ?? 0) > 1;

    return isIosUa || isIpadOs;
  }

  /**
   * Detects if the current client is an Android device.
   */
  isAndroidDevice(): boolean {
    if (typeof window === "undefined" || !navigator.userAgent) {
      return false;
    }

    return /Android/i.test(navigator.userAgent);
  }

  /**
   * Checks whether the browser is currently online.
   */
  isOnline(): boolean {
    if (typeof window === "undefined") {
      return true;
    }
    return navigator.onLine !== false;
  }

  /**
   * Subscribes to window online and offline events. Returns an unsubscribe cleanup function.
   */
  addNetworkStatusListener(onOnline: () => void, onOffline: () => void): () => void {
    if (typeof window === "undefined") {
      return () => {};
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }

  /**
   * Captures the browser's `beforeinstallprompt` event.
   */
  setupInstallPromptListener(
    onPromptAvailable: (event: BeforeInstallPromptEvent) => void
  ): () => void {
    if (typeof window === "undefined") {
      return () => {};
    }

    const handler = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent;
      // Prevent automatic browser banner so we can trigger custom prompt
      promptEvent.preventDefault?.();
      this.deferredPrompt = promptEvent;
      this.notifyPromptSubscribers();
      onPromptAvailable(promptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }

  private isInstalling = false;

  getIsInstalling(): boolean {
    return this.isInstalling;
  }

  private setIsInstalling(value: boolean): void {
    this.isInstalling = value;
    this.notifyPromptSubscribers();
  }

  /**
   * Triggers the deferred install prompt.
   */
  async triggerInstall(event: BeforeInstallPromptEvent | null): Promise<InstallOutcome> {
    if (!event || typeof event.prompt !== "function" || this.isInstalling) {
      return "failed";
    }

    try {
      this.setIsInstalling(true);
      await event.prompt();
      const choice = await event.userChoice;
      // Invalidate deferredPrompt immediately so it is never called twice
      this.deferredPrompt = null;
      if (typeof window !== "undefined") {
        (window as unknown as { __kinkord_pwa_prompt?: BeforeInstallPromptEvent | null }).__kinkord_pwa_prompt = null;
      }
      if (choice.outcome === "accepted") {
        this.isInstalledViaPrompt = true;
      }
      this.notifyPromptSubscribers();
      return choice.outcome;
    } catch {
      this.deferredPrompt = null;
      if (typeof window !== "undefined") {
        (window as unknown as { __kinkord_pwa_prompt?: BeforeInstallPromptEvent | null }).__kinkord_pwa_prompt = null;
      }
      this.notifyPromptSubscribers();
      return "failed";
    } finally {
      this.setIsInstalling(false);
    }
  }
}

export const pwaService = new PwaService();
