import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/_api/:path*",
          destination:
            "https://dd4ab6dc-0e94-4aee-8a2e-b0320758fca1.siteproxy.wix.com/_api/:path*",
        },
        {
          source: "/__ecom/:path*",
          destination:
            "https://dd4ab6dc-0e94-4aee-8a2e-b0320758fca1.siteproxy.wix.com/__ecom/:path*",
        },
      ],
      fallback: [],
    };
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "fonts.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
