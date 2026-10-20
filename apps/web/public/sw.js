// Kinkord Service Worker
const CACHE_NAME = "kinkord-pwa-v6";
const OFFLINE_URL = "/offline";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/icons/icon-192x192.png",
  "/icons/push-icon-v2.png",
  "/icons/badge-96x96.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/icon.svg",
  "/brand/logo-badge.png",
  "/brand/logo.png",
  "/favicon.ico",
];

// Install: Cache offline fallback and core static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Activate: Clean up previous cache versions and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key !== "kinkord-badge-config") {
              return caches.delete(key);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: Strategy depending on request type
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests or browser-extension schemes
  if (request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // Never cache API calls or auth routes in the service worker
  if (url.pathname.startsWith("/api/") || url.pathname.includes("/auth/")) {
    return;
  }

  // HTML navigation requests: Network-First with fallback to /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return cache.match(OFFLINE_URL);
      }),
    );
    return;
  }

  // Static assets (images, icons, fonts): Stale-While-Revalidate
  if (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
  }
});

// Launcher badges use the authenticated backend total. Configuration survives worker restarts.
const BADGE_CONFIG_CACHE = "kinkord-badge-config";
const BADGE_CONFIG_URL = new URL("/__badge_config__", self.location.origin).href;
async function applyAppBadge(count) {
  try {
    if (count > 0) await self.navigator.setAppBadge?.(count);
    else await self.navigator.clearAppBadge?.();
  } catch { /* Launcher support and permissions vary by device. */ }
}
let appBadgeRevision = 0;
async function refreshAppBadge() {
  const mine = ++appBadgeRevision;
  try {
    const cache = await caches.open(BADGE_CONFIG_CACHE);
    const config = await cache.match(BADGE_CONFIG_URL);
    if (!config) return;
    const { url } = await config.json();
    const response = await fetch(url, { credentials: "include", cache: "no-store" });
    if (response.status === 401) { if (mine === appBadgeRevision) { await cache.delete(BADGE_CONFIG_URL); await applyAppBadge(0); } return; }
    if (!response.ok) return;
    const data = await response.json();
    if (mine === appBadgeRevision && Number.isSafeInteger(data.count) && data.count >= 0) await applyAppBadge(data.count);
  } catch { /* Offline: a later push or foreground refresh retries. */ }
}
self.addEventListener("message", (event) => {
  if (event.data?.type !== "kinkord:app-badge") return;
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const cache = await caches.open(BADGE_CONFIG_CACHE);
    const url = event.data.url;
    if (url && ["http:", "https:"].includes(new URL(url).protocol)) {
      await cache.put(BADGE_CONFIG_URL, new Response(JSON.stringify({ url })));
      // Fetch again rather than applying a possibly stale page's count.
      await refreshAppBadge();
    } else {
      ++appBadgeRevision;
      await cache.delete(BADGE_CONFIG_URL);
      await applyAppBadge(0);
    }
  })());
});

// Web Push notifications (VAPID)
// Every push shows a notification: Safari cancels a site's push after a few
// that show nothing. One for the page a member already has open and focused
// arrives silently. Each inbox row has its own tag, so separate events stay
// separate; a chat's messages share one row, so they replace each other and
// alert again. The browser/OS still controls banners and Do Not Disturb.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const url = new URL(data.url || "/", self.location.origin).href;
  const options = {
    body: data.body || "New activity on Kinkord",
    icon: "/icons/push-icon-v2.png",
    // The status-bar icon. Android draws only its transparency, as a white
    // silhouette: the full-colour app icon came out as a blank square (and
    // with no badge Chrome shows its own logo), so this is the K in its ring,
    // white on transparent, like the marks X and Instagram show up there.
    badge: "/icons/badge-96x96.png",
    tag: data.notificationId ? `notification-${data.notificationId}` : undefined,
    data: { url, notificationId: data.notificationId },
  };

  event.waitUntil(refreshAppBadge());
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      // Refreshing open tabs must never stop the notification.
      .catch(() => [])
      .then((windows) => {
        for (const client of windows) {
          try {
            client.postMessage({ type: "kinkord:notification" });
          } catch {
            // A tab that is closing; the others still refresh.
          }
        }
        const watching = windows.some(
          (w) =>
            w.focused &&
            w.visibilityState === "visible" &&
            new URL(w.url).pathname === new URL(url).pathname,
        );
        // Chrome refuses a silent notification that vibrates or renotifies.
        const alert = watching
          ? { ...options, silent: true, renotify: false }
          : {
              ...options,
              silent: false,
              renotify: Boolean(options.tag),
              vibrate: [200, 100, 200],
            };
        return self.registration.showNotification(data.title || "Kinkord", alert);
      }),
  );
});

// Tap: bring an open Kinkord window to that screen, or open one there.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const id = event.notification.data?.notificationId;
  const url = id
    ? new URL(`/notifications?open=${encodeURIComponent(id)}`, self.location.origin).href
    : event.notification.data?.url || new URL("/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        try {
          // Only a window this worker controls can be moved; others just open fresh.
          if (open.url !== url) await open.navigate(url);
          return await open.focus();
        } catch {
          return self.clients.openWindow(url);
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
