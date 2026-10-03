export interface ComingSoonFeatureVM {
  headline: string;
  constructionLead: string;
  constructionAccent: string;
  subcopy: string;
}

/** Menu destinations that aren't built yet, by their /coming-soon/[feature] slug. */
const FEATURES = {
  kinkopedia: {
    headline: "KINKOPEDIA",
    constructionLead: "Kinkopedia is",
    constructionAccent: "coming soon",
    subcopy: "The library on consent, safety and the lifestyle is being written.",
  },
  "kinkcoins-payment": {
    headline: "KINKCOINS & PAYMENT",
    constructionLead: "KinkCoins are",
    constructionAccent: "coming soon",
    subcopy: "Secure wallet and payment features will appear here when they are ready.",
  },
  subscription: {
    headline: "SUBSCRIPTION",
    constructionLead: "Subscriptions are",
    constructionAccent: "coming soon",
    subcopy: "Membership plans and benefits are still being prepared.",
  },
  marketplace: {
    headline: "MARKETPLACE",
    constructionLead: "The marketplace is",
    constructionAccent: "coming soon",
    subcopy: "A dedicated place for approved products and services is on the way.",
  },
  "your-data": {
    headline: "YOUR DATA",
    constructionLead: "Data controls are",
    constructionAccent: "coming soon",
    subcopy: "Download, portability and account-data controls will be available here.",
  },
  "content-experience": {
    headline: "CONTENT & EXPERIENCE",
    constructionLead: "Experience controls are",
    constructionAccent: "coming soon",
    subcopy: "Your content, display and recommendation preferences will live here.",
  },
  "community-safety": {
    headline: "COMMUNITY & SAFETY",
    constructionLead: "Safety controls are",
    constructionAccent: "coming soon",
    subcopy: "Reporting, blocking and community-safety tools are being brought together here.",
  },
} satisfies Record<string, ComingSoonFeatureVM>;

export const COMING_SOON_FEATURES = Object.keys(FEATURES);

/** Copy for one unfinished feature; null for a slug that isn't one (the route 404s). */
export function getComingSoonFeatureVM(feature: string): ComingSoonFeatureVM | null {
  return Object.hasOwn(FEATURES, feature) ? FEATURES[feature as keyof typeof FEATURES] : null;
}
