// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
  },
}));

import { pushService } from "./push.service";

type Permission = "default" | "granted" | "denied";

/** A browser that can do push, with the permission and subscription a test wants. */
function fakeBrowser(
  opts: { permission?: Permission; existing?: string; answer?: Permission } = {},
) {
  const sub = (endpoint: string) => ({
    endpoint,
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: vi.fn(async () => {
      current = null;
      return true;
    }),
  });
  let current: ReturnType<typeof sub> | null = opts.existing ? sub(opts.existing) : null;
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = sub("https://push.example/new");
      return current;
    }),
  };
  const notification = {
    permission: opts.permission ?? "default",
    requestPermission: vi.fn(async () => {
      notification.permission = opts.answer ?? "granted";
      return notification.permission;
    }),
  };
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", {
    value: { ready: Promise.resolve({ pushManager }) },
    configurable: true,
  });
  return { pushManager, notification, subscription: () => current };
}

describe("pushService", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ publicKey: "S2luaw" });
    post.mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    delete (navigator as unknown as Record<string, unknown>).userAgent;
  });

  it("is unsupported in a browser without service workers", async () => {
    await expect(pushService.state()).resolves.toBe("unsupported");
  });

  it("knows an Android phone, where a member turns on pop-up notifications themselves", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 14; TECNO KJ7) AppleWebKit/537.36 Chrome/128.0 Mobile",
      configurable: true,
    });
    expect(pushService.isAndroid()).toBe(true);
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });
    expect(pushService.isAndroid()).toBe(false);
  });

  it("asks iPhone Safari to install the app first", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });
    await expect(pushService.state()).resolves.toBe("install");
  });

  it("turns on: asks permission, subscribes with the server's key, and tells the API", async () => {
    const b = fakeBrowser();
    await expect(pushService.enable()).resolves.toBe("on");
    expect(b.notification.requestPermission).toHaveBeenCalled();
    const options = b.pushManager.subscribe.mock.calls[0] as unknown as [
      { userVisibleOnly: boolean; applicationServerKey: Uint8Array },
    ];
    expect(options[0].userVisibleOnly).toBe(true);
    expect(Array.from(options[0].applicationServerKey)).toEqual([75, 105, 110, 107]);
    expect(post).toHaveBeenCalledWith("/push/subscriptions", {
      endpoint: "https://push.example/new",
      expirationTime: null,
      keys: { p256dh: "p", auth: "a" },
    });
  });

  it("reuses the device's existing subscription", async () => {
    const b = fakeBrowser({ existing: "https://push.example/old" });
    await pushService.enable();
    expect(b.pushManager.subscribe).not.toHaveBeenCalled();
    expect(post.mock.calls[0][1]).toMatchObject({ endpoint: "https://push.example/old" });
  });

  it("stays blocked, and asks the API nothing, when the member says no", async () => {
    fakeBrowser({ answer: "denied" });
    await expect(pushService.enable()).resolves.toBe("blocked");
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("turns off: the API forgets the device, then the browser unsubscribes", async () => {
    const b = fakeBrowser({ permission: "granted", existing: "https://push.example/old" });
    const sub = b.subscription();
    await expect(pushService.disable()).resolves.toBe("off");
    expect(post).toHaveBeenCalledWith("/push/subscriptions/remove", {
      endpoint: "https://push.example/old",
    });
    expect(sub?.unsubscribe).toHaveBeenCalled();
  });

  it("re-sends the subscription on each visit, only with permission", async () => {
    fakeBrowser({ permission: "granted", existing: "https://push.example/old" });
    await pushService.sync();
    expect(post).toHaveBeenCalledWith("/push/subscriptions", expect.anything());

    post.mockClear();
    fakeBrowser({ permission: "default", existing: "https://push.example/old" });
    await pushService.sync();
    expect(post).not.toHaveBeenCalled();
  });

  it("never holds up logout", async () => {
    fakeBrowser({ permission: "granted", existing: "https://push.example/old" });
    post.mockRejectedValue(new Error("offline"));
    await expect(pushService.forgetDevice()).resolves.toBeUndefined();
  });
});
