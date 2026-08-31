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
    expect(vm.signIn).toEqual({ label: "SIGN IN", href: Routes.login });
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
});
