import { BRAND_NAME, BRAND_TAGLINE, COPYRIGHT_LINE } from "@/constants/landing";
import { Routes } from "@/constants/Routes";

export function getLandingVM() {
  return {
    logo: { src: "/brand/logo-badge.png", alt: "Kinkord" },
    hero: {
      src: "/brand/hero-trio.jpg",
      alt: "Three community members in black satin against a dark satin backdrop",
    },
    downloadCta: { label: "Download Kinkord", href: Routes.signup },
    brand: BRAND_NAME,
    tagline: BRAND_TAGLINE,
    signUp: { label: "SIGN UP", href: Routes.signup },
    signIn: { label: "SIGN IN", href: Routes.login },
    navLinks: [
      { label: "KINKOPEDIA", href: Routes.kinkopedia },
      { label: "ABOUT KINKORD", href: Routes.about },
      { label: "CONTACT US", href: Routes.contact },
    ],
    copyright: COPYRIGHT_LINE,
  };
}

export type LandingVM = ReturnType<typeof getLandingVM>;
