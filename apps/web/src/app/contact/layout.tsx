import type { Metadata } from "next";
import { SEO_COPY } from "@/constants/seo";
import { getPageMetadata } from "@/presenters/getPageMetadata";

export const metadata: Metadata = getPageMetadata("/contact", SEO_COPY.contact);

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
