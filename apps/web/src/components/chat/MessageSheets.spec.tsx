// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditMessageSheet from "./EditMessageSheet";
import ForwardSheet, { type ForwardSheetProps } from "./ForwardSheet";
import MessageActionSheet from "./MessageActionSheet";

afterEach(cleanup);

describe("MessageActionSheet", () => {
  it("picks a choice, and closes on Cancel, Escape or a tap outside", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <MessageActionSheet
        title="Delete message?"
        items={[
          { key: "everyone", label: "Delete for everyone", danger: true },
          { key: "me", label: "Delete for me", danger: true },
        ]}
        cancelLabel="Cancel"
        busy={false}
        error="Couldn't do that."
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete for me" }));
    expect(onSelect).toHaveBeenCalledWith("me");
    expect(screen.getByText("Couldn't do that.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("EditMessageSheet", () => {
  it("saves only once the text has changed", () => {
    const onSave = vi.fn();
    render(
      <EditMessageSheet
        id="m1"
        title="Edit message"
        text="hello"
        maxLength={4000}
        saveLabel="Save"
        cancelLabel="Cancel"
        busy={false}
        error={null}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello there" } });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith("hello there");
  });
});

describe("ForwardSheet", () => {
  const props: ForwardSheetProps = {
    title: "Forward to…",
    searchLabel: "Search chats…",
    query: "",
    onQuery: vi.fn(),
    loading: false,
    chats: [
      {
        id: "c2",
        displayName: "Bola",
        avatarUrl: null,
        silver: false,
        organization: false,
        selected: true,
        disabled: false,
        result: { sent: false, error: "This member is no longer on Kinkord." },
      },
      {
        id: "c3",
        displayName: "Chidi",
        avatarUrl: null,
        silver: false,
        organization: false,
        selected: false,
        disabled: true,
        result: null,
      },
    ],
    emptyText: "No chats to forward to.",
    chosenLabel: "1 of 5 chosen",
    sentLabel: "Sent",
    sendLabel: "Forward",
    canSend: true,
    cancelLabel: "Cancel",
    error: null,
    onToggle: vi.fn(),
    onSend: vi.fn(),
    onClose: vi.fn(),
  };

  it("chooses chats, says why one refused, and can't add past the limit", () => {
    render(<ForwardSheet {...props} />);
    expect(screen.getByText("This member is no longer on Kinkord.")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Bola/ }));
    expect(props.onToggle).toHaveBeenCalledWith("c2");
    expect((screen.getByRole("checkbox", { name: /Chidi/ }) as HTMLInputElement).disabled).toBe(
      true,
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bo" } });
    expect(props.onQuery).toHaveBeenCalledWith("bo");
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(props.onSend).toHaveBeenCalled();
  });

  it("says so when there's nowhere to forward to", () => {
    render(<ForwardSheet {...props} chats={[]} />);
    expect(screen.getByText("No chats to forward to.")).toBeTruthy();
  });
});
