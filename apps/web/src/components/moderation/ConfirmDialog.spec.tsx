// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminDialogVM } from "@/presenters/useAdminMemberPresenter";
import ConfirmDialog from "./ConfirmDialog";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

const field = (label: string, value = "") => ({ label, value, set: vi.fn() });

const base = (over: Partial<AdminDialogVM> = {}): AdminDialogVM => ({
  title: "Revoke their verification?",
  body: "Their verified badge goes.",
  confirmLabel: "Revoke",
  cancelLabel: "Cancel",
  destructive: true,
  reason: field("Reason"),
  code: field("Authenticator code"),
  checkbox: null,
  typeToConfirm: null,
  canConfirm: true,
  busy: false,
  error: null,
  confirm: vi.fn(),
  cancel: vi.fn(),
  ...over,
});

/** A page with the button that opens the dialog, as the moderation screens have. */
function Harness({ dialog }: { dialog: AdminDialogVM }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open ? <ConfirmDialog dialog={{ ...dialog, cancel: () => setOpen(false) }} /> : null}
    </>
  );
}

describe("ConfirmDialog", () => {
  afterEach(cleanup);

  it("asks for the code after the reason, as a one-time numeric code", () => {
    render(<ConfirmDialog dialog={base()} />);
    const [reason, code] = [
      screen.getByLabelText("Reason"),
      screen.getByLabelText("Authenticator code"),
    ];
    expect(reason.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(code.getAttribute("inputmode")).toBe("numeric");
    expect(code.getAttribute("autocomplete")).toBe("one-time-code");
    expect(code.hasAttribute("maxlength")).toBe(false);
  });

  it("keeps Tab inside the dialog, and gives focus back to the opener on close", () => {
    render(<Harness dialog={base()} />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Revoke" });
    expect(document.activeElement).toBe(cancel);

    confirm.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByLabelText("Reason"));
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("announces an error, with a link to put it right", () => {
    render(
      <ConfirmDialog
        dialog={base({
          error: "Turn on two-factor first.",
          errorLink: { label: "Security settings", href: "/settings/security" },
        })}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Turn on two-factor first.");
    expect(screen.getByRole("link", { name: "Security settings" }).getAttribute("href")).toBe(
      "/settings/security",
    );
  });

  it("ignores a tap outside once something is typed, so it isn't lost", () => {
    const cancel = vi.fn();
    const { container, rerender } = render(<ConfirmDialog dialog={base({ cancel })} />);
    const backdrop = container.firstElementChild as HTMLElement;

    rerender(
      <ConfirmDialog dialog={base({ cancel, reason: field("Reason", "Confirmed fraud") })} />,
    );
    fireEvent.click(backdrop);
    expect(cancel).not.toHaveBeenCalled();

    rerender(<ConfirmDialog dialog={base({ cancel })} />);
    fireEvent.click(backdrop);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
