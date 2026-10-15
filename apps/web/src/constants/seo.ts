/** Global branding for search engines and link previews. Each public page
 * sets its own canonical; the root layout must not claim every page is home. */
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
    title: "Kinkord — The world's kink community",
    description:
      "Kinkord is the world's kink community. An adults-only space to connect, explore your interests, and find your people.",
    keywords: [
      "BDSM community",
      "global kink community",
      "kink community",
      "kinksters",
      "fetish community",
      "consent",
      "kink education",
      "Kinkord",
    ],
  },
  about: {
    title: "About Kinkord — The World's Kink Community",
    description:
      "Discover Kinkord, a global community for kinksters. Meet the people building a safe, consent-first home for kink.",
  },
  team: {
    title: "Meet the Team Behind Kinkord — The World's Kink Community",
    description:
      "Meet the kinksters, educators and builders behind Kinkord, the world's kink community.",
  },
  contact: {
    title: "Contact Kinkord",
    description:
      "Reach Kinkord for support, questions about the community, or to report a safety concern.",
  },
  invest: {
    title: "Invest in Kinkord — Equity Investment Opportunity",
    description:
      "Kinkord is building the world's kink community. Explore the equity investment opportunity.",
  },
} as const;
