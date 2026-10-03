// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useHomePresenter } from "./useHomePresenter";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };
let pathname = "/home";
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => pathname }));

const signOut = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: { signOut: (...a: unknown[]) => signOut(...a) },
}));

// Push is its own service; here we only check the shell keeps it in step.
const order: string[] = [];
const pushSync = vi.fn(async () => undefined);
const forgetDevice = vi.fn(async () => void order.push("forget"));
vi.mock("@/services/push.service", () => ({
  pushService: { sync: () => pushSync(), forgetDevice: () => forgetDevice() },
}));

const apiGet = vi.fn();
vi.mock("@/services/apiClient", () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super(`API ${status}`);
    }
  }
  return { api: { get: (...a: unknown[]) => apiGet(...a) }, ApiError };
});

const me = { id: "u1", name: "Tega Maxwell", username: "tegamaxwell" };
const profile = { displayName: "SIR T", avatarUrl: "https://s3/avatar.jpg" };
const stats = { members: 128 };

const routeGet = (path: unknown) => {
  if (path === "/notifications/unread-count") return Promise.resolve({ count: 0 });
  if (path === "/me") return Promise.resolve(me);
  if (path === "/profile") return Promise.resolve(profile);
  if (path === "/community/stats") return Promise.resolve(stats);
  return Promise.reject(new Error(`unexpected ${String(path)}`));
};

describe("useHomePresenter", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    signOut.mockReset().mockImplementation(async () => void order.push("signOut"));
    order.length = 0;
    pushSync.mockClear();
    forgetDevice.mockClear();
    apiGet.mockReset().mockImplementation(routeGet);
    pathname = "/home";
  });

  it("greets by first name and exposes drawer identity + member count", async () => {
    const { result } = renderHook(() => useHomePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.greeting).toBe("Hi Tega, Welcome");
    expect(result.current.name).toBe("SIR T");
    expect(result.current.handle).toBe("@tegamaxwell");
    expect(result.current.avatarUrl).toBe("https://s3/avatar.jpg");
    expect(result.current.membersCount).toBe("128");
    expect(result.current.verified).toBe(false);
  });

  it("redirects to login when the session is gone", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValue(new ApiError(401, {}));
    const { result } = renderHook(() => useHomePresenter());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(result.current.error).toBeNull();
  });

  it("opens and closes the drawer, and signs out to login", async () => {
    const { result } = renderHook(() => useHomePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.openDrawer());
    expect(result.current.drawerOpen).toBe(true);
    act(() => result.current.closeDrawer());
    expect(result.current.drawerOpen).toBe(false);
    act(() => result.current.toggleSettingsMenu());
    expect(result.current.settingsMenuOpen).toBe(true);
    act(() => {
      void result.current.logout();
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(signOut).toHaveBeenCalled();
    // The device is forgotten while still signed in, then the session ends.
    expect(order).toEqual(["forget", "signOut"]);
  });

  it("keeps this device's notification subscription current once signed in", async () => {
    const { result } = renderHook(() => useHomePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(pushSync).toHaveBeenCalledTimes(1);
  });

  it("opens the settings accordion on a settings child route", async () => {
    pathname = "/settings/security";
    const { result } = renderHook(() => useHomePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settingsMenuOpen).toBe(true);
  });

  it("surfaces a friendly error on non-auth failures", async () => {
    apiGet.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useHomePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/Could not load/);
  });
});
