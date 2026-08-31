import ComingSoonScreen from "@/components/landing/ComingSoonScreen";
import { Routes } from "@/constants/Routes";
import { getLandingVM } from "@/presenters/getLandingVM";

export const metadata = {
  title: "Kinkopedia — Kinkord",
  description: "The Kinkord education library on consent, safety and lifestyle knowledge.",
};

export default function KinkopediaPage() {
  const { logo } = getLandingVM();

  return (
    <ComingSoonScreen
      logo={logo}
      title="KINKOPEDIA"
      note="The kink education library is being written. It launches with the platform."
      back={{ label: "BACK TO HOME", href: Routes.home }}
    />
  );
}
