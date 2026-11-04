import {
  ADULT_BADGE,
  AGE_DISCLAIMER_LEAD,
  AGE_DISCLAIMER_TEXT,
  AGE_GATE_MODAL,
  ALL_RIGHTS_RESERVED,
  BRAND_NAME,
  LANDING_WORDMARK,
  LANDING_HEADER_TAGLINE,
  LANDING_AUDIENCE_STATEMENT,
  LANDING_AUDIENCE_LINES,
  BRAND_TAGLINE,
  COPYRIGHT_LINE,
  JOIN_AGE_DISCLAIMER,
  LANDING_PLATFORM_OVERVIEW,
  LANDING_MEMBERS,
  LANDING_MISSION,
  LANDING_WHY_JOIN,
  LANDING_SAFE_KINK,
  MOBILE_LANDING_CONTENT,
  POLICY_LINKS,
  SOCIALS,
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
    logo: { src: "/brand/kinkord-circle-k.png", alt: "Kinkord" },
    wordmark: LANDING_WORDMARK,
    headerTagline: LANDING_HEADER_TAGLINE,
    audienceStatement: LANDING_AUDIENCE_STATEMENT,
    audienceLines: LANDING_AUDIENCE_LINES,
    hero: {
      src: "/brand/landing-gold-accessories.png",
      alt: "A gold masquerade mask, black leather collar and braided flogger against a black background.",
      width: 1280,
      height: 721,
    },
    mobileContent: MOBILE_LANDING_CONTENT,
    platformOverview: LANDING_PLATFORM_OVERVIEW,
    mission: LANDING_MISSION,
    whyJoin: LANDING_WHY_JOIN,
    safeKink: LANDING_SAFE_KINK,
    membership: {
      ...LANDING_MEMBERS,
      count: String(LANDING_MEMBERS.unavailable),
      countries: `${AVAILABLE_COUNTRIES.length} ${LANDING_MEMBERS.countriesLabel}`,
    },
    downloadCta,
    brand: BRAND_NAME,
    tagline: BRAND_TAGLINE,
    signUp: { label: "Sign Up", href: Routes.signup },
    signIn: { label: "Log In", href: Routes.login },
    ageDisclaimer: {
      lead: AGE_DISCLAIMER_LEAD,
      rest: AGE_DISCLAIMER_TEXT,
    },
    joinAgeDisclaimer: JOIN_AGE_DISCLAIMER,
    navLinks: [
      { label: "Kinkopedia", href: Routes.kinkopedia, emoji: "📖" },
      { label: "About Kinkord", href: Routes.about, emoji: "i" },
      { label: "Contact Us", href: Routes.contact, emoji: "✉️" },
    ],
    policyLinks: POLICY_LINKS.map((p) => ({ ...p })),
    adultBadge: { ...ADULT_BADGE },
    ageGate: { ...AGE_GATE_MODAL },
    socialLinks: SOCIALS.filter((social) => social.href !== null).map((social) => ({ ...social })),
    copyright: COPYRIGHT_LINE,
    allRightsReserved: ALL_RIGHTS_RESERVED,
  };
}

export type LandingVM = ReturnType<typeof getLandingVM>;
