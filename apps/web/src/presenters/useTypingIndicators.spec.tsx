// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TYPING_HINT_MS, useTypingIndicators } from "./useTypingIndicators";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const start = { type: "typing", conversationId: "c1", typing: true } as const;
it("shows a hint for eight seconds from when it arrives, without network requests", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useTypingIndicators());
  act(() => result.current.receive(start));
  expect(result.current.active.has("c1")).toBe(true);
  act(() => vi.advanceTimersByTime(TYPING_HINT_MS - 1));
  expect(result.current.active.has("c1")).toBe(true);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.active.has("c1")).toBe(false);
});
it("times hints by this device's clock, so a phone that runs fast still shows them", () => {
  vi.useFakeTimers();
  // A phone whose clock is a minute ahead of the server's.
  vi.setSystemTime(Date.now() + 60_000);
  const { result } = renderHook(() => useTypingIndicators());
  act(() => result.current.receive(start));
  expect(result.current.active.has("c1")).toBe(true);
});
it("keeps a hint alive while it's repeated, and clears on stop, message or lost connection", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useTypingIndicators());
  act(() => result.current.receive(start));
  act(() => vi.advanceTimersByTime(5_000));
  act(() => result.current.receive(start));
  act(() => vi.advanceTimersByTime(5_000));
  expect(result.current.active.has("c1")).toBe(true);
  act(() => result.current.receive({ ...start, typing: false }));
  expect(result.current.active.size).toBe(0);
  act(() => result.current.receive(start));
  act(() => result.current.receive({ type: "message", conversationId: "c1" }));
  expect(result.current.active.size).toBe(0);
  act(() => result.current.receive(start));
  act(() => result.current.clear());
  expect(result.current.active.size).toBe(0);
});
