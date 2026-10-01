import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/seo";

/**
 * Everything may be crawled: the members' area is kept out of results by its
 * `X-Robots-Tag: noindex` header (next.config.ts), which a crawler can only
 * read on a page it's allowed to fetch.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
