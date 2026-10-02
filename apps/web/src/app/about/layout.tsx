import type { Metadata } from "next";
import { SEO_COPY } from "@/constants/seo";
import { getPageMetadata } from "@/presenters/getPageMetadata";

export const metadata: Metadata = getPageMetadata("/about", SEO_COPY.about);

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
