import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the App Runner image.
  output: "standalone",
  // No sharp in the runtime image: the build stage runs on the builder's
  // native arch, so native binaries would not match the amd64 runtime.
  images: { unoptimized: true },
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
