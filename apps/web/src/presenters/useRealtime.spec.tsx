// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { RealtimeEventPM } from "@/domain/realtime";

let hear: ((e: RealtimeEventPM) => void) | null = null;
let setStatus: ((live: boolean) => void) | null = null;
const stop = vi.fn();
vi.mock("@/services/realtime.service", () => ({
  realtime: {
    listen: (onEvent: (e: RealtimeEventPM) => void, onStatus: (live: boolean) => void) => {
      hear = onEvent;
      setStatus = onStatus;
      onStatus(false);
      return stop;
    },
  },
}));

import { useRealtime } from "./useRealtime";

describe("useRealtime", () => {
  afterEach(cleanup);

  it("hands events to the latest handler and reports whether it's live", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ fn }) => useRealtime(fn), {
      initialProps: { fn: first },
    });
    expect(result.current.live).toBe(false);

    act(() => setStatus?.(true));
    expect(result.current.live).toBe(true);

    rerender({ fn: second });
    act(() => hear?.({ type: "message", conversationId: "c1" }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ type: "message", conversationId: "c1" });
  });

  it("holds off connecting until enabled", () => {
    hear = null;
    const fn = vi.fn();
    const { result, rerender } = renderHook(({ on }) => useRealtime(fn, on), {
      initialProps: { on: false },
    });
    expect(hear).toBeNull();
    expect(result.current.live).toBe(false);
    rerender({ on: true });
    act(() => hear?.({ type: "notification" }));
    expect(fn).toHaveBeenCalledWith({ type: "notification" });
  });

  it("stops listening when the screen goes away", () => {
    const { unmount } = renderHook(() => useRealtime(() => undefined));
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
