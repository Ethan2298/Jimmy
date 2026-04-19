import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/driveline", destination: "/driveline/index.html" },
    ];
  },
};

export default nextConfig;
