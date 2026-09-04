import {
  AGE_DISCLAIMER_LEAD,
  AGE_DISCLAIMER_TEXT,
  BRAND_NAME,
  BRAND_TAGLINE,
  COPYRIGHT_LINE,
} from "@/constants/landing";
import { Routes } from "@/constants/Routes";

export interface SplashAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export function getLandingVM() {
  const downloadCta: SplashAction = { label: "Download Kinkord", href: Routes.signup };
  return {
    logo: { src: "/brand/logo-badge.png", alt: "Kinkord" },
    hero: {
      src: "/brand/hero-trio.jpg",
      alt: "Three community members in black satin against a dark satin backdrop",
    },
    downloadCta,
    brand: BRAND_NAME,
    tagline: BRAND_TAGLINE,
    signUp: { label: "SIGN UP", href: Routes.signup },
    signIn: { label: "login", href: Routes.login },
    ageDisclaimer: {
      lead: AGE_DISCLAIMER_LEAD,
      rest: AGE_DISCLAIMER_TEXT,
    },
    navLinks: [
      { label: "KINKOPEDIA", href: Routes.kinkopedia },
      { label: "ABOUT KINKORD", href: Routes.about },
      { label: "CONTACT US", href: Routes.contact },
    ],
    copyright: COPYRIGHT_LINE,
  };
}

export type LandingVM = ReturnType<typeof getLandingVM>;
