// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deviceId,
  deviceReport,
  isNativeFunction,
  locationCheckService,
  readPosition,
} from "./locationCheck.service";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: (...a: unknown[]) => put(...a),
  },
}));

const geolocationAnswering = (
  answer: (ok: PositionCallback, fail: PositionErrorCallback) => void,
) =>
  ({
    getCurrentPosition: vi.fn((ok: PositionCallback, fail: PositionErrorCallback) =>
      answer(ok, fail),
    ),
  }) as unknown as Geolocation;

const failing = (code: number) =>
  geolocationAnswering((_ok, fail) =>
    fail({
      code,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError),
  );

describe("readPosition", () => {
  it("passes on a fresh fix", async () => {
    const geo = geolocationAnswering((ok) =>
      ok({ coords: { latitude: 6.52, longitude: 3.38, accuracy: 25 } } as GeolocationPosition),
    );
    expect(await readPosition(geo)).toEqual({ status: "ok", lat: 6.52, lng: 3.38, accuracy: 25 });
    expect(geo.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ maximumAge: 0, enableHighAccuracy: true }),
    );
  });

  it("gives up on a prompt nobody answers", async () => {
    vi.useFakeTimers();
    const silent = geolocationAnswering(() => undefined);
    const reading = readPosition(silent);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await reading).toEqual({ status: "timeout" });
    vi.useRealTimers();
  });

  it("says why there's no fix", async () => {
    expect(await readPosition(failing(1))).toEqual({ status: "denied" });
    expect(await readPosition(failing(2))).toEqual({ status: "unavailable" });
    expect(await readPosition(failing(3))).toEqual({ status: "timeout" });
    expect(await readPosition(undefined)).toEqual({ status: "unsupported" });
  });
});

describe("isNativeFunction", () => {
  it("tells the browser's own functions from ones a script put there", () => {
    expect(isNativeFunction(Math.max)).toBe(true);
    expect(isNativeFunction(() => 1)).toBe(false);
    expect(isNativeFunction(undefined)).toBe(false);
  });

  it("sees through a bound fake, which also prints as native code", () => {
    const bound = Math.max.bind(null);
    expect(isNativeFunction(bound)).toBe(true);
    expect(isNativeFunction(bound, "max")).toBe(false);
    expect(isNativeFunction(Math.max, "max")).toBe(true);
  });
});

describe("deviceReport", () => {
  it("reports the clock's zone, automation, and whether geolocation is the browser's own", () => {
    const report = deviceReport({
      webdriver: true,
      geolocation: { getCurrentPosition: () => undefined },
    } as unknown as Navigator);
    expect(report.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(report).toMatchObject({ automation: true, geolocationNative: false });
  });

  it("notices a geolocation override set on the object itself", () => {
    const geolocation = Object.create(null) as Geolocation;
    Object.defineProperty(geolocation, "getCurrentPosition", { value: Math.max, enumerable: true });
    expect(
      deviceReport({ webdriver: false, geolocation } as unknown as Navigator).geolocationNative,
    ).toBe(false);
  });

  it("doesn't call a browser without geolocation tampered with", () => {
    expect(deviceReport({ webdriver: false } as unknown as Navigator).geolocationNative).toBe(true);
  });
});

describe("deviceId", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("makes one id and keeps it", () => {
    const first = deviceId();
    expect(first).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(deviceId()).toBe(first);
  });

  it("replaces a kept value that isn't an id", () => {
    localStorage.setItem("kinkord_device_id", "<script>");
    expect(deviceId()).not.toBe("<script>");
  });

  it("goes without when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(deviceId()).toBeNull();
  });
});

describe("locationCheckService", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset().mockResolvedValue({ id: "check-1" });
    put.mockReset();
  });

  it("reads the mode", async () => {
    get.mockResolvedValue({ mode: "watch" });
    expect(await locationCheckService.mode()).toBe("watch");
    expect(get).toHaveBeenCalledWith("/location-check/mode");
  });

  it("sends the GPS reading, the device's signals and its id", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: geolocationAnswering((ok) =>
        ok({ coords: { latitude: 5.6, longitude: -0.19, accuracy: 40 } } as GeolocationPosition),
      ),
    });
    await locationCheckService.check("GH", { joining: true });
    expect(post).toHaveBeenCalledWith("/location-check", {
      country: "GH",
      joining: true,
      gps: { status: "ok", lat: 5.6, lng: -0.19, accuracy: 40 },
      device: expect.objectContaining({ timezone: expect.any(String), automation: false }),
      deviceId: expect.any(String),
    });
  });

  it("records Not now", async () => {
    await locationCheckService.skip("NG");
    expect(post).toHaveBeenCalledWith("/location-check/skip", {
      country: "NG",
      joining: false,
      deviceId: expect.any(String),
    });
  });

  it("asks whether a check is due", async () => {
    get.mockResolvedValue({ due: true });
    expect(await locationCheckService.due()).toBe(true);
    expect(get).toHaveBeenCalledWith("/location-check/due");
  });

  it("serves the founders' page", async () => {
    await locationCheckService.summary();
    expect(get).toHaveBeenCalledWith("/admin/location-checks/summary?days=7");
    await locationCheckService.list({
      before: "2026-11-02T12:00:00.000Z",
      decision: "mismatch",
      limit: 50,
    });
    expect(get).toHaveBeenLastCalledWith(
      "/admin/location-checks?limit=50&before=2026-11-02T12%3A00%3A00.000Z&decision=mismatch",
    );
    await locationCheckService.list();
    expect(get).toHaveBeenLastCalledWith("/admin/location-checks");
    await locationCheckService.setMode("enforce");
    expect(put).toHaveBeenCalledWith("/admin/location-checks/mode", { mode: "enforce" });
  });
});
