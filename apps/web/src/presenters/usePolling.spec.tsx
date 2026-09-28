// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { usePolling } from "./usePolling";

let visibility: DocumentVisibilityState = "visible";
const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("runs at once, then on every interval", async () => {
    const tick = vi.fn(async () => undefined);
    renderHook(() => usePolling(tick, 1000, true));
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(tick).toHaveBeenCalledTimes(4);
  });

  it("asks for nothing while the tab is hidden, and catches up on return", async () => {
    const tick = vi.fn(async () => undefined);
    renderHook(() => usePolling(tick, 1000, true));
    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("does nothing until enabled", async () => {
    const tick = vi.fn(async () => undefined);
    const { rerender } = renderHook(({ on }) => usePolling(tick, 1000, on), {
      initialProps: { on: false },
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(tick).not.toHaveBeenCalled();
    rerender({ on: true });
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("doesn't stack a new request on one still running", async () => {
    let finish: () => void = () => undefined;
    const tick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderHook(() => usePolling(tick, 1000, true));
    await vi.advanceTimersByTimeAsync(3000);
    expect(tick).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(1000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("stops when unmounted", async () => {
    const tick = vi.fn(async () => undefined);
    const { unmount } = renderHook(() => usePolling(tick, 1000, true));
    unmount();
    await vi.advanceTimersByTimeAsync(3000);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
