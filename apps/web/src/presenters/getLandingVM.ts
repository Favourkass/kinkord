import {
  ADULT_BADGE,
  AGE_DISCLAIMER_LEAD,
  AGE_DISCLAIMER_TEXT,
  AGE_GATE_MODAL,
  ALL_RIGHTS_RESERVED,
  BRAND_NAME,
  BRAND_TAGLINE,
  COPYRIGHT_LINE,
  JOIN_AGE_DISCLAIMER,
  POLICY_LINKS,
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
    signIn: { label: "LOGIN", href: Routes.login },
    ageDisclaimer: {
      lead: AGE_DISCLAIMER_LEAD,
      rest: AGE_DISCLAIMER_TEXT,
    },
    joinAgeDisclaimer: JOIN_AGE_DISCLAIMER,
    navLinks: [
      { label: "KINKOPEDIA", href: Routes.kinkopedia },
      { label: "ABOUT KINKORD", href: Routes.about },
      { label: "CONTACT US", href: Routes.contact },
    ],
    policyLinks: POLICY_LINKS.map((p) => ({ ...p })),
    adultBadge: { ...ADULT_BADGE },
    ageGate: { ...AGE_GATE_MODAL },
    copyright: COPYRIGHT_LINE,
    allRightsReserved: ALL_RIGHTS_RESERVED,
  };
}

export type LandingVM = ReturnType<typeof getLandingVM>;
