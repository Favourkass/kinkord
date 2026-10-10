// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import PresenceDot from "./PresenceDot";
afterEach(cleanup);
it.each([
  ["online", "bg-app-online"],
  ["away", "bg-amber-400"],
  ["offline", "bg-app-muted"],
] as const)("shows an accessible %s indicator", (status, color) => {
  render(<PresenceDot online={status === "online"} status={status} label={status} />);
  expect(screen.getByRole("img", { name: status }).className).toContain(color);
});
