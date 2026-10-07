import type { NextConfig } from "next";

/** First path segments of the members' area, kept out of search results. */
const PRIVATE_SECTIONS = [
  "home",
  "messages",
  "members",
  "u",
  "p",
  "profile",
  "settings",
  "kinkcoins",
  "saved",
  "notifications",
  "moderation",
  "offline",
  "verify-email",
  "reset-password",
  "forgot-password",
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the App Runner image.
  output: "standalone",
  // No sharp in the runtime image: the build stage runs on the builder's
  // native arch, so native binaries would not match the amd64 runtime.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        // The members' area never belongs in search results: profiles, posts,
        // chats and the directory are private, and a kinkster can be outed by
        // a search result. A header covers every page under these sections,
        // including ones that render in the browser.
        source: `/:section(${PRIVATE_SECTIONS.join("|")})/:rest*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Versioned brand assets (kinkord-splash-v1.*): ship a new animation as
        // -v2 rather than overwriting, so this can be cached for good.
        source: "/brand/splash/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/lectures",
        destination: "/",
        permanent: false,
      },
      {
        source: "/lectures/:path*",
        destination: "/",
        permanent: false,
      },
      {
        source: "/admin",
        destination: "/",
        permanent: false,
      },
      {
        source: "/admin/:path*",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
