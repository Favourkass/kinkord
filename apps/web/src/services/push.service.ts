/**
 * Push notifications through the browser: permission, the PushManager
 * subscription, and telling the API which device to send to. The service
 * worker (public/sw.js) shows what arrives.
 */
import { keyBytes, pushStateOf, type PushState } from "@/domain/push";
import { api } from "./apiClient";

/** The service worker is registered on page load; don't wait forever if it isn't. */
const READY_TIMEOUT_MS = 5_000;

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) return false;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS asks for desktop sites, so it reports as a Mac with a touchscreen.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
}

function standalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ]);
}

async function current(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export const pushService = {
  /**
   * Android decides per app whether a notification pops up over the screen
   * ("Pop on screen", "Floating notifications" on some phones). A website can't
   * turn that on, so on Android the app shows members where to.
   */
  isAndroid,

  async state(): Promise<PushState> {
    const ok = supported();
    const sub = ok ? await current() : null;
    return pushStateOf({
      supported: ok,
      isIos: isIos(),
      standalone: standalone(),
      permission: ok ? Notification.permission : "default",
      subscribed: Boolean(sub),
    });
  },

  /** Must run from a tap: browsers only show the permission prompt for one. */
  async enable(): Promise<PushState> {
    if (!supported()) return this.state();
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return this.state();
    const reg = await registration();
    if (!reg) return "unsupported";
    const { publicKey } = await api.get<{ publicKey: string }>("/push/key");
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }));
    await api.post("/push/subscriptions", sub.toJSON());
    return "on";
  },

  async disable(): Promise<PushState> {
    const sub = await current();
    if (sub) {
      await api.post("/push/subscriptions/remove", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    return this.state();
  },

  /**
   * On each visit: hands the API this device's subscription again, so a
   * browser that quietly rotated it keeps getting notifications.
   */
  async sync(): Promise<void> {
    if (!supported() || Notification.permission !== "granted") return;
    const sub = await current();
    if (sub) await api.post("/push/subscriptions", sub.toJSON());
  },

  /** On logout: the next person on this phone doesn't get the last one's notifications. */
  async forgetDevice(): Promise<void> {
    try {
      await this.disable();
    } catch {
      // Logging out must not wait on this.
    }
  },

  /** A notification to the member's own devices, to show it works. */
  async test(): Promise<number> {
    return (await api.post<{ sent: number }>("/push/test", {})).sent;
  },
};
