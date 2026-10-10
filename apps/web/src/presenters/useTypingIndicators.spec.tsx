// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTypingIndicators } from "./useTypingIndicators";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("expires hints without network requests and never extends them beyond eight seconds", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useTypingIndicators());
  act(() =>
    result.current.receive({
      type: "typing",
      conversationId: "c1",
      typing: true,
      expiresAt: Date.now() + 60000,
    }),
  );
  expect(result.current.active.has("c1")).toBe(true);
  act(() => vi.advanceTimersByTime(8000));
  expect(result.current.active.has("c1")).toBe(false);
});
it("clears on stop, message, or lost connection and ignores expired hints", () => {
  const { result } = renderHook(() => useTypingIndicators());
  const start = () =>
    result.current.receive({
      type: "typing",
      conversationId: "c1",
      typing: true,
      expiresAt: Date.now() + 8000,
    });
  act(start);
  act(() =>
    result.current.receive({
      type: "typing",
      conversationId: "c1",
      typing: false,
      expiresAt: Date.now(),
    }),
  );
  expect(result.current.active.size).toBe(0);
  act(start);
  act(() => result.current.receive({ type: "message", conversationId: "c1" }));
  expect(result.current.active.size).toBe(0);
  act(start);
  act(() => result.current.clear());
  expect(result.current.active.size).toBe(0);
  act(() =>
    result.current.receive({
      type: "typing",
      conversationId: "c1",
      typing: true,
      expiresAt: Date.now() - 1,
    }),
  );
  expect(result.current.active.size).toBe(0);
});
