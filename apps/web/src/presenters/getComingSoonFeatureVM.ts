export interface ComingSoonFeatureVM {
  headline: string;
  constructionLead: string;
  constructionAccent: string;
  subcopy: string;
}

const features: Record<string, ComingSoonFeatureVM> = {
  saved: {
    headline: "SAVED",
    constructionLead: "Saved content is",
    constructionAccent: "coming soon",
    subcopy: "Your private collection of saved posts, profiles and resources is being prepared.",
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
};

export function getComingSoonFeatureVM(feature: string): ComingSoonFeatureVM {
  return (
    features[feature] ?? {
      headline: "COMING SOON",
      constructionLead: "This feature is",
      constructionAccent: "on the way",
      subcopy: "We are still preparing this part of Kinkord.",
    }
  );
}
