import { describe, expect, it } from "vitest";
import { getFooterVM } from "./getFooterVM";

describe("getFooterVM", () => {
  const vm = getFooterVM();

  it("exposes the legal links with labels and hrefs", () => {
    expect(vm.links.length).toBeGreaterThan(0);
    for (const link of vm.links) {
      expect(link.label).not.toHaveLength(0);
      expect(link.href).not.toHaveLength(0);
    }
  });

  it("maps socials to name and href only", () => {
    expect(vm.socials.length).toBeGreaterThan(0);
    for (const social of vm.socials) {
      expect(Object.keys(social).sort()).toEqual(["href", "name"]);
    }
  });

  it("combines company name and address into one line", () => {
    expect(vm.addressLine).toContain("Temaxiro Limited");
    expect(vm.addressLine).toContain("Sapele");
  });
});
