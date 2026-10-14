import { Routes } from "@/constants/Routes";
import { VERIFICATION_PRIVACY_COPY } from "@/constants/verificationPrivacy";

export interface VerificationPrivacySectionVM {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface VerificationPrivacyVM {
  homeHref: string;
  contactHref: string;
  brand: string;
  contactLabel: string;
  eyebrow: string;
  headline: { lead: string; accent: string };
  lead: string;
  effectiveDate: string;
  choice: { title: string; body: string };
  onThisPage: string;
  sections: VerificationPrivacySectionVM[];
  provider: { id: string; title: string; body: string; linkLabel: string; href: string };
  help: { title: string; body: string; cta: string };
  footer: string;
}

/** Display-ready copy for the public identity verification privacy notice. */
export function getVerificationPrivacyVM(): VerificationPrivacyVM {
  const copy = VERIFICATION_PRIVACY_COPY;
  return {
    homeHref: Routes.home,
    contactHref: Routes.contact,
    brand: copy.brand,
    contactLabel: copy.contactLabel,
    eyebrow: copy.eyebrow,
    headline: { ...copy.headline },
    lead: copy.lead,
    effectiveDate: copy.effectiveDate,
    choice: { ...copy.choice },
    onThisPage: copy.onThisPage,
    sections: copy.sections.map((section) => ({
      id: section.id,
      title: section.title,
      paragraphs: [...section.paragraphs],
    })),
    provider: { ...copy.provider },
    help: { ...copy.help },
    footer: copy.footer,
  };
}
