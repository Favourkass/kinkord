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
it("finds places however they are spelled and shows the first 50 matches", () => {
  const towns = [
    { value: "Lang’ata", label: "Lang’ata" },
    ...Array.from({ length: 120 }, (_, i) => ({ value: `Town ${i}`, label: `Town ${i}` })),
  ];
  render(
    <SearchSelectField {...props} options={towns} moreLabel="Keep typing" onChange={vi.fn()} />,
  );
  fireEvent.click(screen.getByLabelText("State"));
  expect(screen.getAllByRole("option")).toHaveLength(50);
  expect(screen.getByText("Keep typing")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "langata" } });
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Lang’ata"]);
  expect(screen.queryByText("Keep typing")).toBeNull();
});

it("keeps Other pinned under any search, and takes a typed place", () => {
  const change = vi.fn();
  const typed = vi.fn();
  const other = {
    value: "__other__",
    label: "Other state",
    typedLabel: (q: string) => `Use “${q}”`,
    onTyped: typed,
  };
  const { rerender } = render(<SearchSelectField {...props} other={other} onChange={change} />);
  fireEvent.click(screen.getByLabelText("State"));
  fireEvent.click(screen.getByRole("option", { name: "Other state" }));
  expect(change).toHaveBeenCalledWith("__other__");
  rerender(<SearchSelectField {...props} value="__other__" other={other} onChange={change} />);
  expect(screen.getByLabelText("State").textContent).toContain("Other state");
  fireEvent.click(screen.getByLabelText("State"));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "  Nowhere Town " } });
  expect(screen.getByText("No matching states")).toBeTruthy();
  fireEvent.click(screen.getByRole("option", { name: "Use “Nowhere Town”" }));
  expect(typed).toHaveBeenCalledWith("Nowhere Town");
  fireEvent.click(screen.getByLabelText("State"));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "tex" } });
  // Arrow past the matches onto the pinned row.
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  expect(typed).toHaveBeenLastCalledWith("tex");
});

it("keeps the search focused when an option is pressed, so iPhone taps land", () => {
  render(<SearchSelectField {...props} onChange={vi.fn()} />);
  fireEvent.click(screen.getByLabelText("State"));
  // fireEvent returns false when the default (moving focus) was prevented.
  expect(fireEvent.mouseDown(screen.getByRole("option", { name: "Texas" }))).toBe(false);
});
