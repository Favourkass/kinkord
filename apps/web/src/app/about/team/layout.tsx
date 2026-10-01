import type { Metadata } from "next";
import { SEO_COPY } from "@/constants/seo";
import { getPageMetadata } from "@/presenters/getPageMetadata";

export const metadata: Metadata = getPageMetadata("/about/team", SEO_COPY.team);

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
