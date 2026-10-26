// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import NotificationSettings from "./NotificationSettings";

afterEach(cleanup);
const base = {
  title: "Notifications",
  backLabel: "← Settings",
  backHref: "/settings",
  description: "Choose what reaches your phone.",
  rhythm: "Bundled every two hours.",
  loadingLabel: "Loading…",
  retryLabel: "Retry",
  loading: false,
  error: null,
  notice: null,
  onRetry: vi.fn(),
};

it("shows each kind as a labelled switch that reports its state", () => {
  const onToggle = vi.fn();
  render(
    <NotificationSettings
      {...base}
      rows={[
        {
          key: "likes",
          label: "Likes and reposts",
          hint: "Bundled.",
          on: false,
          busy: false,
          disabled: false,
          onToggle,
        },
      ]}
    />,
  );
  const toggle = screen.getByRole("switch", { name: "Likes and reposts" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(toggle);
  expect(onToggle).toHaveBeenCalledOnce();
  expect(screen.getByText("Bundled every two hours.")).toBeTruthy();
});
