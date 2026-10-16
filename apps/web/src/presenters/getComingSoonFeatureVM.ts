import { COMING_SOON_COPY } from "@/constants/comingSoon";

export interface ComingSoonFeatureVM {
  headline: string;
  constructionLead: string;
  constructionAccent: string;
  subcopy: string;
}

/** The slugs that have a "coming soon" screen; any other is a 404. */
export const COMING_SOON_FEATURES = Object.keys(COMING_SOON_COPY);

/** Copy for one unfinished feature, or null for a slug that isn't one. */
export function getComingSoonFeatureVM(feature: string): ComingSoonFeatureVM | null {
  return Object.hasOwn(COMING_SOON_COPY, feature)
    ? COMING_SOON_COPY[feature as keyof typeof COMING_SOON_COPY]
    : null;
}
