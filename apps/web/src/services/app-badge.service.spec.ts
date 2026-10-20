// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { appBadgeService } from "./app-badge.service";
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./apiClient", () => ({ api: { get } }));
const set = vi.fn().mockResolvedValue(undefined);
const clear = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  get.mockReset();
  set.mockClear();
  clear.mockClear();
  Object.defineProperty(navigator, "setAppBadge", { configurable: true, value: set });
  Object.defineProperty(navigator, "clearAppBadge", { configurable: true, value: clear });
});
afterEach(() => vi.restoreAllMocks());
it("sets the supported launcher badge from the authoritative backend total, clearing at zero", async () => {
  get.mockResolvedValueOnce({ count: 4 }).mockResolvedValueOnce({ count: 0 });
  await appBadgeService.sync();
  expect(set).toHaveBeenCalledWith(4);
  await appBadgeService.sync();
  expect(clear).toHaveBeenCalledOnce();
});
it("ignores stale replies after a more recent read or logout", async () => {
  let resolve!: (value: { count: number }) => void;
  get.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const old = appBadgeService.sync();
  await appBadgeService.clear();
  resolve({ count: 9 });
  await old;
  expect(set).not.toHaveBeenCalled();
});
it("preserves the last badge while offline and tolerates unsupported launchers", async () => {
  get.mockRejectedValueOnce(new Error("offline"));
  await expect(appBadgeService.sync()).resolves.toBeUndefined();
  expect(clear).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "setAppBadge", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "clearAppBadge", { configurable: true, value: undefined });
  get.mockResolvedValue({ count: 1 });
  await expect(appBadgeService.sync()).resolves.toBeUndefined();
});
