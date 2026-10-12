import type { Metadata } from "next";
import VerificationPrivacyPage from "@/components/pages/VerificationPrivacyPage";
import { getVerificationPrivacyVM } from "@/presenters/getVerificationPrivacyVM";

export const metadata: Metadata = {
  title: "Identity Verification Privacy Notice | Kinkord",
  description:
    "How Kinkord and Didit handle ID, selfie and profile-photo information when you verify your identity.",
  // Keep the draft out of search results until Kinkord's legal sign-off.
  robots: { index: false, follow: false },
};

export default function VerificationPrivacyRoute() {
  return <VerificationPrivacyPage {...getVerificationPrivacyVM()} />;
}
