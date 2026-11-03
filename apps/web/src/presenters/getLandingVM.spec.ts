import { describe, expect, it } from "vitest";
import { Routes } from "@/constants/Routes";
import { getLandingVM } from "./getLandingVM";

describe("getLandingVM", () => {
  const vm = getLandingVM();

  it("counts all available countries on the landing page", () => {
    expect(vm.membership.countries).toBe("5 countries");
  });

  it("brands the splash with the Kinkord name and tagline", () => {
    expect(vm.brand).toBe("Kinkord");
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
    expect(vm.logo.src).toBe("/brand/kinkord-circle-k.png");
    // The supplied mask artwork has room for a live, accessible headline.
    expect(vm.hero).toMatchObject({
      src: "/brand/landing-gold-mask.png",
      width: 1080,
      height: 724,
    });
    expect(vm.wordmark.src).toBe("/brand/kinkord-mask-wordmark.webp");
    expect(vm.headerTagline).toBe("THE WORLD’S KINK COMMUNITY");
    expect(vm.audienceStatement).toBe(
      "The Global Social Network for Kinksters, Fetishists & BDSM Enthusiasts.",
    );
    expect(vm.audienceLines.map((line) => line.text).join(" ")).toBe(vm.audienceStatement);
    expect(vm.audienceLines.filter((line) => line.highlight).map((line) => line.text)).toEqual([
      "for Kinksters, Fetishists",
    ]);
    expect(vm.logo.alt).not.toHaveLength(0);
    expect(vm.hero.alt).not.toHaveLength(0);
  });

  it("links only the three live social accounts in the requested order", () => {
    expect(vm.socialLinks.map(({ name, href }) => ({ name, href }))).toEqual([
      { name: "Facebook", href: "https://www.facebook.com/share/1Los7dVc57/" },
      { name: "X / Twitter", href: "https://x.com/kinkordofficial" },
      {
        name: "Instagram",
        href: "https://www.instagram.com/kinkordlimited/",
      },
    ]);
  });

  it("includes the 18+ age disclaimer", () => {
    expect(vm.ageDisclaimer.lead).toBe("18+ Only.");
    expect(vm.ageDisclaimer.rest).toContain("18 or older");
    expect(vm.joinAgeDisclaimer).toBe("You must be 18 years or older to join.");
  });

  it("exposes the 8 policy links for the footer buttons", () => {
    expect(vm.policyLinks).toHaveLength(8);
    expect(vm.policyLinks.map((p) => p.label)).toEqual([
      "Privacy Policy",
      "Terms of Service",
      "Community Guidelines",
      "Cookie Policy",
      "Safety & Reporting",
      "Copyright Policy",
      "Invest in Kinkord",
      "Kinkord on WhatsApp",
    ]);
    expect(vm.allRightsReserved).toBe("All rights reserved.");
  });

  it("exposes the age gate modal copy", () => {
    expect(vm.ageGate.title).toBe("AGE VERIFICATION");
    expect(vm.ageGate.badge).toContain("18+ ADULT COMMUNITY");
    expect(vm.ageGate.points).toHaveLength(4);
    expect(vm.ageGate.warning).toContain("Providing a false age");
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
