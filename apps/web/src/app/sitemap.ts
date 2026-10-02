import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/seo";

/** The public pages. Nothing from the members' area, which never belongs in search results. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/about/team`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/invest`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
