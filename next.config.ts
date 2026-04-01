import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "x-custom-header", value: "true" }],
      },
    ];
  },
};

export default nextConfig;
