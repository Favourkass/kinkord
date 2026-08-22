import {
  COMMUNITY_FEATURES,
  COMPANY_ADDRESS,
  COMPANY_NAME,
  COUNTRIES,
  EDUCATION_TOPICS,
  FOOTER_LINKS,
  LAUNCH_DATE,
  SOCIALS,
  STATS,
  WHY_FEATURES,
} from "@/constants/landing";
import { INVEST_WHATSAPP_URL } from "@/constants/invest";
import { Routes } from "@/constants/Routes";

export function getLandingVM() {
  return {
    hero: {
      brand: "KINKORD",
      label: "Coming Soon",
      launchDateIso: LAUNCH_DATE.toISOString(),
      launchNote: "Launching December 28, 2027",
      headline: "Welcome to Kinkord",
      subcopy:
        "A global luxury lifestyle community for adults built on consent, education, connection and expression.",
      primaryCtaLabel: "Join Kinkord",
      primaryCtaHref: "#join",
      secondaryCtaLabel: "Explore More",
      secondaryCtaHref: "#about",
    },
    stats: {
      eyebrow: "Our Community",
      stats: STATS.map((s) => ({ ...s })),
      countriesLabel: "Global Reach",
      countries: [...COUNTRIES],
    },
    why: {
      eyebrow: "The Platform",
      title: "Why Kinkord?",
      features: [...WHY_FEATURES],
      footnote:
        "Built for adults seeking safe, informed and respectful exploration within the global kink lifestyle community.",
    },
    education: {
      topics: [...EDUCATION_TOPICS],
    },
    community: {
      features: [...COMMUNITY_FEATURES],
    },
    investTeaser: {
      href: Routes.invest,
      whatsappUrl: INVEST_WHATSAPP_URL,
    },
    finalCta: {
      launchDateIso: LAUNCH_DATE.toISOString(),
      launchNote: "December 28, 2027",
    },
    footer: {
      links: FOOTER_LINKS.map((l) => ({ ...l })),
      socials: SOCIALS.map((s) => ({ name: s.name, href: s.href })),
      addressLine: `${COMPANY_NAME} \u00b7 ${COMPANY_ADDRESS}`,
    },
  };
}

export type LandingVM = ReturnType<typeof getLandingVM>;
