// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PhotoConfirmation from "./PhotoConfirmation";

const copy = {
  title: "Photo confirmation",
  intro: "Confirm before uploading.",
  affirmation: "I confirm that:",
  requirements: ["No minors.", "Every person consented."],
  warning: "Violations may result in account suspension.",
  confirmLabel: "I Confirm",
};

afterEach(cleanup);

describe("PhotoConfirmation", () => {
  it("renders every requirement and emits checkbox changes", () => {
    const onConfirmedChange = vi.fn();
    render(<PhotoConfirmation {...copy} confirmed={false} onConfirmedChange={onConfirmedChange} />);

    expect(screen.getByRole("heading", { name: copy.title })).toBeTruthy();
    for (const requirement of copy.requirements) {
      expect(screen.getByText(requirement)).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("checkbox", { name: copy.confirmLabel }));
    expect(onConfirmedChange).toHaveBeenCalledWith(true);
  });

  it("disables confirmation while an upload is in progress", () => {
    render(<PhotoConfirmation {...copy} confirmed disabled onConfirmedChange={vi.fn()} />);

    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: copy.confirmLabel,
      }).disabled,
    ).toBe(true);
  });
});
