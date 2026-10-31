import {
  ADULT_BADGE,
  AGE_DISCLAIMER_LEAD,
  AGE_DISCLAIMER_TEXT,
  AGE_GATE_MODAL,
  ALL_RIGHTS_RESERVED,
  BRAND_NAME,
  LANDING_WORDMARK,
  LANDING_HEADER_TAGLINE,
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
    wordmark: LANDING_WORDMARK,
    headerTagline: LANDING_HEADER_TAGLINE,
    hero: {
      src: "/brand/landing-connections.png",
      alt: "Two adult community members connecting through messages in a warm, gold-lit setting.",
      width: 1080,
      height: 809,
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
