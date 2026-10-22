// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import MultiSelectField from "./MultiSelectField";
afterEach(cleanup);
function Example() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <MultiSelectField
      label="Roles"
      max={5}
      selected={selected}
      options={["One", "Two", "Three", "Four", "Five", "Six"]}
      query=""
      searchLabel="Search roles"
      onQuery={() => {}}
      onToggle={(value) =>
        setSelected((current) =>
          current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
        )
      }
    />
  );
}
it("keeps selected chips visible, blocks a sixth choice and lets a removed choice be replaced", () => {
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: "Roles" }));
  for (const name of ["One", "Two", "Three", "Four", "Five"])
    fireEvent.click(screen.getByRole("option", { name }));
  expect((screen.getByRole("option", { name: "Six" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Remove One" }));
  fireEvent.click(screen.getByRole("option", { name: "Six" }));
  fireEvent.keyDown(screen.getByLabelText("Search roles"), { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(screen.getByRole("button", { name: "Remove Six" })).toBeTruthy();
  expect(screen.getByText("5 / 5 selected")).toBeTruthy();
});
