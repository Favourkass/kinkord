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
    return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
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
      onPromptAvailable(promptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }

  /**
   * Triggers the deferred install prompt.
   */
  async triggerInstall(event: BeforeInstallPromptEvent | null): Promise<InstallOutcome> {
    if (!event || typeof event.prompt !== "function") {
      return "failed";
    }

    try {
      await event.prompt();
      const choice = await event.userChoice;
      return choice.outcome;
    } catch {
      return "failed";
    }
  }
}

export const pwaService = new PwaService();
