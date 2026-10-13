// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SearchSelectField from "./SearchSelectField";
afterEach(cleanup);
const props = {
  label: "State",
  value: "",
  options: [
    { value: "California", label: "California" },
    { value: "Texas", label: "Texas" },
  ],
  placeholder: "Select state",
  searchPlaceholder: "Search states",
  emptyLabel: "No matching states",
};
it("filters options and selects a matching state", () => {
  const change = vi.fn();
  render(<SearchSelectField {...props} onChange={change} />);
  fireEvent.click(screen.getByLabelText("State"));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "tex" } });
  expect(screen.queryByRole("option", { name: "California" })).toBeNull();
  fireEvent.click(screen.getByRole("option", { name: "Texas" }));
  expect(change).toHaveBeenCalledWith("Texas");
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("supports keyboard selection and an empty search", () => {
  const change = vi.fn();
  render(<SearchSelectField {...props} onChange={change} />);
  fireEvent.click(screen.getByLabelText("State"));
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  expect(change).toHaveBeenCalledWith("Texas");
  fireEvent.click(screen.getByLabelText("State"));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzzz" } });
  expect(screen.getByText("No matching states")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
});
