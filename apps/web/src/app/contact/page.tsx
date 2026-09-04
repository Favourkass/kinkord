import ComingSoonScreen from "@/components/landing/ComingSoonScreen";
import { Routes } from "@/constants/Routes";
import { getLandingVM } from "@/presenters/getLandingVM";

export const metadata = {
  title: "Contact Us — Kinkord",
  description: "How to reach the Kinkord team.",
};

export default function ContactPage() {
  const { logo, ageDisclaimer } = getLandingVM();

  return (
    <ComingSoonScreen
      logo={logo}
      title="CONTACT US"
      note="Support channels open at launch. Kinkord · The World's Kink Community."
      back={{ label: "BACK TO HOME", href: Routes.home }}
      ageDisclaimer={ageDisclaimer}
    />
  );
}
