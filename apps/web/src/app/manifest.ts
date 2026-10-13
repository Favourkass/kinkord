import type { MetadataRoute } from "next";
import { SEO_COPY } from "@/constants/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SEO_COPY.site.title,
    short_name: "Kinkord",
    description: SEO_COPY.site.description,
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait",
    categories: ["social", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
      // The status-bar icon of the installed app. Android draws it from the
      // transparency alone, and an installed app ignores a notification's own
      // badge for this, so without these it shows a blank square.
      {
        src: "/icons/badge-96x96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "monochrome",
      },
      {
        src: "/icons/badge-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "monochrome",
      },
    ],
  };
}
