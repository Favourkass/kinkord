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
  LANDING_PLATFORM_OVERVIEW,
  LANDING_MEMBERS,
  MOBILE_LANDING_CONTENT,
  POLICY_LINKS,
} from "@/constants/landing";
import { AVAILABLE_COUNTRIES } from "@/constants/members";
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
    wordmark: { src: "/brand/kinkord-mask-wordmark.png", alt: "Kinkord", width: 720, height: 232 },
    hero: {
      src: "/brand/hero-trio.jpg",
      alt: "Three community members in black satin against a dark satin backdrop",
    },
    mobileHero: {
      src: "/brand/topa.jpeg",
      alt: "Five adult community members in black outfits against a black and gold background.",
      width: 720,
      height: 1080,
    },
    mobileContent: MOBILE_LANDING_CONTENT,
    platformOverview: LANDING_PLATFORM_OVERVIEW,
    membership: {
      ...LANDING_MEMBERS,
      count: String(LANDING_MEMBERS.unavailable),
      countries: `${AVAILABLE_COUNTRIES.length} ${LANDING_MEMBERS.countriesLabel}`,
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
