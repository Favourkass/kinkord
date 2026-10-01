/**
 * What search engines and link previews see. Written for the searches a
 * Nigerian kinkster makes ("BDSM Nigeria", "kink community Lagos"), so the
 * words people type are the words on the page. Every public page sets its
 * own canonical; the root layout must not, or every page would claim to be
 * the homepage.
 */
export const SITE_URL = "https://kinkord.com";
export const SITE_NAME = "Kinkord";

/** The official accounts, for the Organization's `sameAs`. */
export const SOCIAL_PROFILES = [
  "https://www.instagram.com/kinkordofficial/",
  "https://x.com/kinkordofficial",
];

/** Earlier names of the same community, so searches for them find Kinkord. */
export const FORMER_NAMES = ["BKCN", "BDSM and Kinks Club Nigeria", "Kinkstone"];

export const SEO_COPY = {
  site: {
    title: "Kinkord — BDSM & Kink Community in Nigeria",
    description:
      "Kinkord is a private, 18+ community for BDSM and kink in Nigeria and beyond. Meet verified kinksters in Lagos, Abuja and across the country, learn about consent and safety, and find your people.",
    keywords: [
      "BDSM Nigeria",
      "BDSM community Nigeria",
      "kink community Nigeria",
      "BDSM Lagos",
      "BDSM Abuja",
      "kinksters Nigeria",
      "fetish community Nigeria",
      "consent",
      "kink education",
      "Kinkord",
    ],
  },
  about: {
    title: "About Kinkord — From BDSM & Kinks Club Nigeria to a Global Kink Community",
    description:
      "Kinkord began as BKCN, BDSM and Kinks Club Nigeria: a WhatsApp group for Nigerian kinksters. Meet the people building a safe, consent-first home for kink.",
  },
  team: {
    title: "Meet the Team Behind Kinkord — Nigeria's Kink Community",
    description:
      "The kinksters, kink educators and builders behind Kinkord, the BDSM and kink community that started in Nigeria.",
  },
  contact: {
    title: "Contact Kinkord",
    description:
      "Reach Kinkord for support, questions about the community, or to report a safety concern.",
  },
  invest: {
    title: "Invest in Kinkord — Equity Investment Opportunity",
    description:
      "Kinkord is building the world's kink community, starting in Nigeria. Explore the equity investment opportunity.",
  },
} as const;
