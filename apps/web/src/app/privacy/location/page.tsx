import type { Metadata } from "next";
import VerificationPrivacyPage from "@/components/pages/VerificationPrivacyPage";
import { getLocationPrivacyVM } from "@/presenters/getLocationPrivacyVM";

export const metadata: Metadata = {
  title: "Location Check Notice | Kinkord",
  description: "Why Kinkord checks the country you're in, what it looks at, and what it keeps.",
  // Keep it out of search results until Kinkord's legal sign-off, like the verification notice.
  robots: { index: false, follow: false },
};

/** The same notice layout as identity verification's; every word comes from the VM. */
export default function LocationPrivacyRoute() {
  return <VerificationPrivacyPage {...getLocationPrivacyVM()} />;
}
