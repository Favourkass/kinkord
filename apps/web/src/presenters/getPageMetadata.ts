import type { Metadata } from "next";
import { SITE_NAME } from "@/constants/seo";

/** What a link to Kinkord previews with, until there's a purpose-made share image. */
const PREVIEW_IMAGE = { url: "/icons/icon-512x512.png", width: 512, height: 512, alt: SITE_NAME };

/**
 * A public page's title, description, canonical address and link preview, from
 * one copy entry. Next.js replaces (not merges) a parent's `openGraph`, so every
 * page sets all of it, not just what differs.
 */
export function getPageMetadata(
  path: string,
  copy: { title: string; description: string },
): Metadata {
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_NG",
      url: path,
      title: copy.title,
      description: copy.description,
      images: [PREVIEW_IMAGE],
    },
    twitter: { card: "summary", title: copy.title, description: copy.description },
  };
}
