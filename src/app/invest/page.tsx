import type { Metadata } from "next";
import InvestPage from "@/components/pages/InvestPage";

export const metadata: Metadata = {
  title: "Invest in Kinkord — Equity Investment Opportunity",
  description:
    "Join Kinkord's limited equity investment round. Build the world's largest kink community and ecosystem through education, community, and commerce.",
  openGraph: {
    title: "Invest in Kinkord",
    description:
      "Limited equity investment opportunity for members and supporters of the Kinkord vision.",
    type: "website",
  },
};

export default function InvestRoute() {
  return <InvestPage />;
}
