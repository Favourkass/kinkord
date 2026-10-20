// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useAppBadgePresenter } from "./useAppBadgePresenter";

const sync = vi.fn();
const stopInbox = vi.fn();
const stopChat = vi.fn();
let onInbox: (() => void) | null = null;
vi.mock("@/services/app-badge.service", () => ({ appBadgeService: { sync: () => sync() } }));
vi.mock("@/services/notifications.service", () => ({
  listenForInboxChanges: (fn: () => void) => {
    onInbox = fn;
    return stopInbox;
  },
}));
vi.mock("@/services/chat.service", () => ({ listenForChatRead: () => stopChat }));

beforeEach(() => {
  for (const f of [sync, stopInbox, stopChat]) f.mockReset();
  onInbox = null;
});
afterEach(cleanup);

describe("useAppBadgePresenter", () => {
  it("does nothing for a signed-out visitor", () => {
    renderHook(() => useAppBadgePresenter(false, 3, 2));
    expect(sync).not.toHaveBeenCalled();
    expect(onInbox).toBeNull();
  });

  it("syncs the launcher badge now, on inbox changes and on returning to the app", () => {
    renderHook(() => useAppBadgePresenter(true, 3, 2));
    expect(sync).toHaveBeenCalledTimes(1);
    onInbox?.();
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    expect(sync).toHaveBeenCalledTimes(4);
  });

  it("re-syncs when the counts change, and stops listening when it leaves", () => {
    const { rerender, unmount } = renderHook(
      ({ messages }) => useAppBadgePresenter(true, messages, 0),
      { initialProps: { messages: 1 } },
    );
    rerender({ messages: 2 });
    expect(sync).toHaveBeenCalledTimes(2);
    unmount();
    expect(stopInbox).toHaveBeenCalled();
    expect(stopChat).toHaveBeenCalled();
    window.dispatchEvent(new Event("focus"));
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
