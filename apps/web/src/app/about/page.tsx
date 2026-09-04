import ComingSoonScreen from "@/components/landing/ComingSoonScreen";
import { Routes } from "@/constants/Routes";
import { getLandingVM } from "@/presenters/getLandingVM";

export const metadata = {
  title: "About Kinkord",
  description: "What Kinkord is and who builds it.",
};

export default function AboutPage() {
  const { logo, tagline, ageDisclaimer } = getLandingVM();

  return (
    <ComingSoonScreen
      logo={logo}
      title="ABOUT KINKORD"
      note={`${tagline} Built by Kinkord Limited, a Temaxiro company.`}
      back={{ label: "BACK TO HOME", href: Routes.home }}
      ageDisclaimer={ageDisclaimer}
    />
  );
}
