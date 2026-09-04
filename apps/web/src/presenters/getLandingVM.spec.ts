import { describe, expect, it } from "vitest";
import { Routes } from "@/constants/Routes";
import { getLandingVM } from "./getLandingVM";

describe("getLandingVM", () => {
  const vm = getLandingVM();

  it("brands the splash with the Kinkord name and tagline", () => {
    expect(vm.brand).toBe("KINKORD");
    expect(vm.tagline).toContain("Where kinksters connect");
    expect(vm.copyright).toBe("© 2026 Kinkord Limited. A Temaxiro Company");
  });

  it("points the auth CTAs at the signup and login routes", () => {
    expect(vm.signUp).toEqual({ label: "SIGN UP", href: Routes.signup });
    expect(vm.signIn).toEqual({ label: "LOGIN", href: Routes.login });
    expect(vm.downloadCta.href).toBe(Routes.signup);
  });

  it("links the secondary navigation to kinkopedia, about and contact", () => {
    expect(vm.navLinks).toEqual([
      { label: "KINKOPEDIA", href: Routes.kinkopedia },
      { label: "ABOUT KINKORD", href: Routes.about },
      { label: "CONTACT US", href: Routes.contact },
    ]);
  });

  it("serves the redesign assets from public/brand", () => {
    expect(vm.logo.src).toBe("/brand/logo-badge.png");
    expect(vm.hero.src).toBe("/brand/hero-trio.jpg");
    expect(vm.logo.alt).not.toHaveLength(0);
    expect(vm.hero.alt).not.toHaveLength(0);
  });

  it("includes the 18+ age disclaimer", () => {
    expect(vm.ageDisclaimer.lead).toBe("18+ Only.");
    expect(vm.ageDisclaimer.rest).toContain("18 or older");
    expect(vm.joinAgeDisclaimer).toBe("You must be 18 years or older to join.");
  });

  it("exposes the 6 policy links for the footer buttons", () => {
    expect(vm.policyLinks).toHaveLength(6);
    expect(vm.policyLinks.map((p) => p.label)).toEqual([
      "Privacy Policy",
      "Terms of Service",
      "Community Guidelines",
      "Cookie Policy",
      "Safety & Reporting",
      "Copyright Policy",
    ]);
    expect(vm.allRightsReserved).toBe("All rights reserved.");
  });

  it("exposes the age gate modal copy", () => {
    expect(vm.ageGate.title).toBe("AGE VERIFICATION");
    expect(vm.ageGate.badge).toContain("18+ ADULT COMMUNITY");
    expect(vm.ageGate.points).toHaveLength(4);
    expect(vm.ageGate.warning).toContain("Providing false age information");
    expect(vm.ageGate.confirmLabel).toContain("18 OR OLDER");
    expect(vm.ageGate.declineLabel).toContain("UNDER 18");
  });

  it("exposes the adult badge design copy", () => {
    expect(vm.adultBadge.age).toBe("18+");
    expect(vm.adultBadge.label).toBe("ONLY");
    expect(vm.adultBadge.line1).toBe("Kinkord is an adult Community.");
    expect(vm.adultBadge.line2).toBe("You must be 18 years or older to join.");
  });
});
