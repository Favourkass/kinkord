// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AgeGateModal from "./AgeGateModal";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});
afterEach(cleanup);

it("blocks dismissal until an explicit age decision and restores scrolling when removed", () => {
  const confirm = vi.fn();
  const decline = vi.fn();
  const props = {
    open: true,
    title: "Age verification",
    badge: "18+",
    statement: "Adults only",
    confirmLabel: "I am 18 or older",
    declineLabel: "I am under 18",
    onConfirm: confirm,
    onDecline: decline,
  };
  const { rerender } = render(<AgeGateModal {...props} />);
  const dialog = screen.getByRole("dialog", { name: "Age verification" });
  expect(dialog.hasAttribute("open")).toBe(true);
  expect(document.body.style.overflow).toBe("hidden");
  const cancel = new Event("cancel", { bubbles: true, cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  expect(decline).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "I am 18 or older" }));
  expect(confirm).toHaveBeenCalledTimes(1);
  rerender(<AgeGateModal {...props} open={false} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
});
