// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThreadMessageVM } from "@/domain/chat";
import MessageBubble, { type MessageBubbleProps } from "./MessageBubble";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const message = (over: Partial<ThreadMessageVM> = {}): ThreadMessageVM => ({
  id: "m1",
  clientId: null,
  senderId: "u2",
  body: "hello",
  photo: null,
  time: "10:00",
  day: { key: "2026-09-28", label: "Today", fullLabel: "Monday, 28 September 2026" },
  isOwn: false,
  status: "sent",
  deleted: false,
  edited: false,
  forwarded: false,
  actionable: true,
  ...over,
});

function show(over: Partial<ThreadMessageVM> = {}, props: Partial<MessageBubbleProps> = {}) {
  const onOpenActions = vi.fn();
  const onOpenPhoto = vi.fn();
  const view = render(
    <ul>
      <MessageBubble
        message={message(over)}
        retryLabel="Tap to retry"
        photoLabels={{ alt: "Photo", reveal: "Tap to view", open: "Open photo" }}
        labels={{
          options: "Message options",
          edited: "Edited",
          forwarded: "Forwarded",
          deletedOwn: "You deleted this message",
          deletedOther: "This message was deleted",
        }}
        onOpenActions={onOpenActions}
        onOpenPhoto={onOpenPhoto}
        {...props}
      />
    </ul>,
  );
  const bubble = view.container.querySelector("li > div") as HTMLElement;
  return { ...view, bubble, onOpenActions, onOpenPhoto };
}

describe("MessageBubble", () => {
  it("says a message was deleted, in words for whose it was, with nothing it said", () => {
    show({ deleted: true, body: "" });
    expect(screen.getByText("This message was deleted")).toBeTruthy();
    cleanup();
    show({ deleted: true, body: "", isOwn: true, status: "seen" });
    expect(screen.getByText("You deleted this message")).toBeTruthy();
    // No ticks on a deleted message, as there are on any other of the sender's.
    expect(screen.queryByRole("img", { name: "Seen" })).toBeNull();
    cleanup();
    show({ isOwn: true, status: "seen" });
    expect(screen.getByRole("img", { name: "Seen" })).toBeTruthy();
  });

  it("marks an edited message beside its time, and a forwarded one above it", () => {
    show({ edited: true, forwarded: true });
    expect(screen.getByText("Edited")).toBeTruthy();
    expect(screen.getByText("Forwarded")).toBeTruthy();
  });

  it("opens the menu from its arrow, or a right-click", () => {
    const { bubble, onOpenActions } = show();
    fireEvent.click(screen.getByRole("button", { name: "Message options" }));
    expect(onOpenActions).toHaveBeenLastCalledWith("m1");
    fireEvent.contextMenu(bubble);
    expect(onOpenActions).toHaveBeenCalledTimes(2);
  });

  it("opens the menu when a finger rests on it, and the tap that ends the press opens nothing", () => {
    vi.useFakeTimers();
    const { bubble, onOpenActions, onOpenPhoto } = show({
      photo: { src: "https://m/p_md.jpg", fullSrc: "https://m/p.jpg", hidden: false },
    });
    const photo = screen.getByRole("button", { name: "Open photo" });
    fireEvent.pointerDown(photo, { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(450));
    expect(onOpenActions).toHaveBeenCalledWith("m1");
    fireEvent.pointerUp(photo, { pointerType: "touch" });
    fireEvent.click(photo);
    expect(onOpenPhoto).not.toHaveBeenCalled();
    // A short tap still opens the photo.
    fireEvent.pointerDown(photo, { pointerType: "touch", clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerUp(photo, { pointerType: "touch" });
    fireEvent.click(photo);
    expect(onOpenPhoto).toHaveBeenCalledWith("https://m/p.jpg");
    expect(onOpenActions).toHaveBeenCalledTimes(1);
    expect(bubble).toBeTruthy();
  });

  it("doesn't open the menu when the finger is scrolling", () => {
    vi.useFakeTimers();
    const { bubble, onOpenActions } = show();
    fireEvent.pointerDown(bubble, { pointerType: "touch", clientX: 10, clientY: 10 });
    fireEvent.pointerMove(bubble, { pointerType: "touch", clientX: 10, clientY: 40 });
    act(() => vi.advanceTimersByTime(600));
    expect(onOpenActions).not.toHaveBeenCalled();
  });

  it("has no menu on a bubble still sending", () => {
    const { bubble, onOpenActions } = show({
      actionable: false,
      status: "sending",
      isOwn: true,
      clientId: "tmp",
    });
    expect(screen.queryByRole("button", { name: "Message options" })).toBeNull();
    fireEvent.contextMenu(bubble);
    expect(onOpenActions).not.toHaveBeenCalled();
  });
});
