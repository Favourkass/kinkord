// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MessageComposer from "./MessageComposer";
afterEach(cleanup);
const base = { placeholder: "Message…", sendLabel: "Send", maxLength: 4000 };
it("preserves multiline messages and sends only on explicit action", () => {
  const send = vi.fn();
  render(<MessageComposer {...base} onSend={send} />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Hello\nHow are you?" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(send).toHaveBeenCalledWith("Hello\nHow are you?");
  expect((input as HTMLTextAreaElement).value).toBe("");
});
it("inserts emoji at the selection and respects the character limit", () => {
  render(
    <MessageComposer
      {...base}
      maxLength={5}
      onSend={vi.fn()}
      emoji={{ label: "Emoji", options: ["😊"] }}
    />,
  );
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Hey" } });
  input.setSelectionRange(3, 3);
  fireEvent.click(screen.getByRole("button", { name: "Emoji" }));
  fireEvent.click(screen.getByRole("button", { name: "😊" }));
  expect(input.value).toBe("Hey😊");
  input.setSelectionRange(5, 5);
  fireEvent.click(screen.getByRole("button", { name: "😊" }));
  expect(input.value).toBe("Hey😊");
});
it("keeps photo restrictions and upload blocking enforced", () => {
  const locked = vi.fn(),
    send = vi.fn();
  const photo = {
    allowed: false,
    draft: null,
    addLabel: "Add photo",
    removeLabel: "Remove",
    uploadingLabel: "Uploading",
    onPick: vi.fn(),
    onRemove: vi.fn(),
    onLocked: locked,
  };
  const view = render(<MessageComposer {...base} onSend={send} photo={photo} />);
  fireEvent.click(screen.getByRole("button", { name: "Add photo" }));
  expect(locked).toHaveBeenCalledOnce();
  view.rerender(
    <MessageComposer
      {...base}
      onSend={send}
      photo={{
        ...photo,
        allowed: true,
        draft: { previewUrl: "/test.jpg", uploading: true, error: null },
      }}
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "caption" } });
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });
  expect(send).not.toHaveBeenCalled();
});
