import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
