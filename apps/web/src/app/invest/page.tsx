import type { Metadata } from "next";
import { SEO_COPY } from "@/constants/seo";
import { getPageMetadata } from "@/presenters/getPageMetadata";
import InvestPage from "@/components/pages/InvestPage";
import { getInvestVM } from "@/presenters/getInvestVM";

export const metadata: Metadata = getPageMetadata("/invest", SEO_COPY.invest);

export default function InvestRoute() {
  const vm = getInvestVM();
  return <InvestPage {...vm} />;
}
