/**
 * Push notifications on this device: what state they're in, and the pure
 * bits the service needs. The browser itself is read in services/push.service.
 */
export type PushState =
  /** This browser can't do push. */
  | "unsupported"
  /** iPhone or iPad in Safari: only Kinkord added to the Home Screen can get push. */
  | "install"
  /** The member said no; only the browser's settings can undo that. */
  | "blocked"
  | "off"
  | "on";

export interface PushEnvironment {
  supported: boolean;
  isIos: boolean;
  standalone: boolean;
  permission: "default" | "granted" | "denied";
  subscribed: boolean;
}

export function pushStateOf(env: PushEnvironment): PushState {
  if (env.isIos && !env.standalone) return "install";
  if (!env.supported) return "unsupported";
  if (env.permission === "denied") return "blocked";
  return env.permission === "granted" && env.subscribed ? "on" : "off";
}

/** Whether to show the "turn on notifications" card: only when it can help, and until dismissed. */
export function shouldPromptForPush(state: PushState | null, dismissed: boolean): boolean {
  return !dismissed && (state === "off" || state === "install");
}

/** A base64url VAPID key as the bytes PushManager.subscribe wants. */
export function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
