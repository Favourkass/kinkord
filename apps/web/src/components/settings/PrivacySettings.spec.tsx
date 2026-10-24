// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PrivacySettings from "./PrivacySettings";

describe("PrivacySettings responsive copies", () => {
  it("keeps the selected radio checked in both mobile and desktop trees", () => {
    const props = {
      title: "Read Receipts",
      backHref: "/settings/privacy",
      description: "Mutual audiences",
      loading: false,
      saving: false,
      error: null,
      notice: null,
      onRetry: vi.fn(),
      fields: [
        {
          key: "readReceipts",
          icon: "✓✓",
          label: "Read Receipts",
          hint: null,
          unavailable: false,
          audienceLabel: "Kinkordians",
          expanded: true,
          onToggle: vi.fn(),
          options: [{ value: "members", label: "Kinkordians", selected: true, onSelect: vi.fn() }],
        },
      ],
    };
    render(
      <>
        <PrivacySettings {...props} />
        <PrivacySettings {...props} />
      </>,
    );
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(2);
    expect(radios.every((radio) => radio.checked)).toBe(true);
    expect(radios[0].name).not.toBe(radios[1].name);
  });
});
