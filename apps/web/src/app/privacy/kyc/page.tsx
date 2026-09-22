import type { Metadata } from "next";
import VerificationPrivacyPage from "@/components/pages/VerificationPrivacyPage";
import { getVerificationPrivacyVM } from "@/presenters/getVerificationPrivacyVM";

export const metadata: Metadata = {
  title: "Kinkord KYC Privacy Notice | Kinkord",
  description: "How Kinkord handles identity, biometric, location, residence and financial KYC information.",
  robots: { index: true, follow: true },
};

export default function KycPrivacyRoute() {
  return <VerificationPrivacyPage {...getVerificationPrivacyVM()} />;
}
