// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import BodyText from "./BodyText";
import { formattedBodyParts } from "@/domain/text-format";
afterEach(cleanup);
it("renders safe bold, italic, underlined text and verified mentions", () => {
  const { container } = render(
    <p>
      <BodyText
        parts={formattedBodyParts(
          "**Bold @riley** *Italic* __Underlined__ <img src=x>",
          [{ handle: "riley", username: "riley" }],
          (u) => `/u/${u}`,
        )}
      />
    </p>,
  );
  expect(screen.getByText("Bold", { exact: false }).closest("strong")).toBeTruthy();
  expect(screen.getByText("Italic").closest("em")).toBeTruthy();
  expect(screen.getByText("Underlined").closest("u")).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toBe("/u/riley");
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain("<img src=x>");
});
