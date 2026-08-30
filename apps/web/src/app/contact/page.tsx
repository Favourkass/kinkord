import ComingSoonScreen from "@/components/landing/ComingSoonScreen";
import { Routes } from "@/constants/Routes";
import { getLandingVM } from "@/presenters/getLandingVM";

export const metadata = {
  title: "Contact Us — Kinkord",
  description: "How to reach the Kinkord team.",
};

export default function ContactPage() {
  const { logo } = getLandingVM();

  return (
    <ComingSoonScreen
      logo={logo}
      title="CONTACT US"
      note="Support channels open at launch. Kinkord Limited · 30 Major Bowen Road, Sapele, Delta State, Nigeria."
      back={{ label: "BACK TO HOME", href: Routes.home }}
    />
  );
}
