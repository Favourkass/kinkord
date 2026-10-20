import { api } from "./apiClient";

let revision = 0;
const badgeUrl = () =>
  new URL(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/notifications/app-badge-count`,
    location.origin,
  ).href;

/** Backend total, shared by open pages and the installed PWA. Never double-count message alerts. */
export const appBadgeService = {
  async sync() {
    const mine = ++revision;
    try {
      const { count } = await api.get<{ count: number }>("/notifications/app-badge-count");
      if (mine !== revision) return;
      await this.apply(count, true);
    } catch {
      /* Keep the last known badge while offline. */
    }
  },
  async clear() {
    ++revision;
    await this.apply(0, false);
  },
  async apply(count: number, enabled: boolean) {
    const n = navigator;
    const total = Math.max(0, Math.floor(count));
    try {
      if (total) await n.setAppBadge?.(total);
      else await n.clearAppBadge?.();
    } catch {
      /* Not supported by this launcher/browser or permission denied. */
    }
    const send = (worker: ServiceWorker | null | undefined) =>
      worker?.postMessage({
        type: "kinkord:app-badge",
        count: total,
        url: enabled ? badgeUrl() : null,
      });
    const controller = navigator.serviceWorker?.controller;
    if (controller) send(controller);
    // First installation can finish after logout; only send the current state.
    else {
      const mine = revision;
      void navigator.serviceWorker?.ready
        .then((registration) => {
          if (mine === revision) send(registration.active);
        })
        .catch(() => undefined);
    }
  },
};
