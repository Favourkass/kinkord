import type { Metadata } from "next";
import { FORMER_NAMES, SEO_COPY, SITE_NAME, SITE_URL, SOCIAL_PROFILES } from "@/constants/seo";
import { siteJsonLd, toJsonLdScript } from "@/domain/seo";
import { getPageMetadata } from "@/presenters/getPageMetadata";
import HomeScreen from "./HomeScreen";

export const metadata: Metadata = getPageMetadata("/", SEO_COPY.site);

/** Server-rendered, so the homepage can say who Kinkord is to search engines. */
export default function Home() {
  const facts = siteJsonLd({
    url: SITE_URL,
    name: SITE_NAME,
    description: SEO_COPY.site.description,
    logo: `${SITE_URL}/icons/icon-512x512.png`,
    sameAs: SOCIAL_PROFILES,
    alternateNames: FORMER_NAMES,
  });
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(facts) }}
      />
      <HomeScreen />
    </>
  );
}
