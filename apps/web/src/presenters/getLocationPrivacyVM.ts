import { LOCATION_PRIVACY_COPY } from "@/constants/locationCheck";
import { Routes } from "@/constants/Routes";
import type { VerificationPrivacyVM } from "./getVerificationPrivacyVM";

/** Display-ready copy for the public location check notice (/privacy/location). */
export function getLocationPrivacyVM(): VerificationPrivacyVM {
  const copy = LOCATION_PRIVACY_COPY;
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
