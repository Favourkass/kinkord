import { describe, expect, it } from "vitest";
import { getInvestVM } from "./getInvestVM";

describe("getInvestVM", () => {
  const vm = getInvestVM();

  it("shares the same footer address line as the landing page", () => {
    expect(vm.footer.addressLine).toBe(
      "Temaxiro Limited · 30 Major Bowen Road, Sapele, Delta State, Nigeria",
    );
  });

  it("exposes the WhatsApp contact wiring", () => {
    expect(vm.whatsappUrl).toBeTruthy();
    expect(typeof vm.whatsappUrl).toBe("string");
  });
});
