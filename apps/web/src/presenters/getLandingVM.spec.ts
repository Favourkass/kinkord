import { describe, expect, it } from "vitest";
import { getLandingVM } from "./getLandingVM";

describe("getLandingVM", () => {
  const vm = getLandingVM();

  it("drives the countdown from LAUNCH_DATE (Dec 28, 2027)", () => {
    expect(vm.hero.launchDateIso).toBe(new Date("2027-12-28T15:00:00+01:00").toISOString());
    expect(vm.hero.launchNote).toContain("December 28, 2027");
    expect(vm.finalCta.launchNote).toContain("December 28, 2027");
  });

  it("exposes the registered company address line in the footer", () => {
    expect(vm.footer.addressLine).toBe(
      "Temaxiro Limited · 30 Major Bowen Road, Sapele, Delta State, Nigeria",
    );
  });

  it("maps footer links and socials as display-ready arrays", () => {
    expect(vm.footer.links.length).toBeGreaterThan(0);
    expect(vm.footer.socials.every((s) => s.name && s.href !== undefined)).toBe(true);
  });
});
