import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the App Runner image.
  output: "standalone",
  // No sharp in the runtime image: the build stage runs on the builder's
  // native arch, so native binaries would not match the amd64 runtime.
  images: { unoptimized: true },
  async rewrites() {
    // Local public previews need browser API calls on the preview origin.
    // This route is absent from normal builds and deployments.
    return process.env.LOCAL_PREVIEW_PROXY === "1"
      ? [{ source: "/__api/:path*", destination: "http://127.0.0.1:4000/:path*" }]
      : [];
  },
  async headers() {
    return [
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
