// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ViewedNotificationRow from "./ViewedNotificationRow";
let top = 10;
let visibility = "visible";
let intersect: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility as DocumentVisibilityState,
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    x: 0,
    y: top,
    top,
    bottom: top + 80,
    left: 0,
    right: 300,
    width: 300,
    height: 80,
    toJSON: () => ({}),
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: () => void) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  top = 10;
  visibility = "visible";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const props = {
  id: "n1",
  createdAt: "2026-10-19T10:00:00Z",
  activityCount: 2,
  unread: true,
  className: "",
};
it("reports only foreground rows at least half visible, after a brief view", async () => {
  const viewed = vi.fn().mockResolvedValue(undefined);
  top = 2000;
  render(
    <ul>
      <ViewedNotificationRow {...props} onViewed={viewed}>
        Request
      </ViewedNotificationRow>
    </ul>,
  );
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(viewed).not.toHaveBeenCalled();
  top = 10;
  visibility = "hidden";
  act(() => intersect());
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(viewed).not.toHaveBeenCalled();
  visibility = "visible";
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await act(async () => vi.advanceTimersByTimeAsync(250));
  expect(viewed).toHaveBeenCalledExactlyOnceWith("n1", props.createdAt, 2);
});
it("doesn't read a row scrolled past before it could be viewed", async () => {
  const viewed = vi.fn().mockResolvedValue(undefined);
  render(
    <ul>
      <ViewedNotificationRow {...props} onViewed={viewed}>
        Request
      </ViewedNotificationRow>
    </ul>,
  );
  await act(async () => vi.advanceTimersByTimeAsync(100));
  top = 2000;
  act(() => intersect());
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(viewed).not.toHaveBeenCalled();
});
it("retries offline failures, and re-observes a newer notification version", async () => {
  const viewed = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  const { rerender } = render(
    <ul>
      <ViewedNotificationRow {...props} onViewed={viewed}>
        Request
      </ViewedNotificationRow>
    </ul>,
  );
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(viewed).toHaveBeenCalledTimes(2);
  rerender(
    <ul>
      <ViewedNotificationRow {...props} activityCount={3} onViewed={viewed}>
        Request
      </ViewedNotificationRow>
    </ul>,
  );
  await act(async () => vi.advanceTimersByTimeAsync(250));
  expect(viewed).toHaveBeenLastCalledWith("n1", props.createdAt, 3);
});

it("does not read rows obscured by a drawer or modal", async () => {
  const viewed = vi.fn().mockResolvedValue(undefined);
  const descriptor = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => document.body,
  });
  try {
    render(
      <ul>
        <ViewedNotificationRow {...props} onViewed={viewed}>
          Request
        </ViewedNotificationRow>
      </ul>,
    );
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(viewed).not.toHaveBeenCalled();
  } finally {
    if (descriptor) Object.defineProperty(document, "elementFromPoint", descriptor);
    else Reflect.deleteProperty(document, "elementFromPoint");
  }
});
