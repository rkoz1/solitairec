import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Old Wix product URLs
      {
        source: "/product-page/:slug",
        destination: "/products/:slug",
        permanent: true,
      },
      // Old Wix shop/store page
      {
        source: "/shop",
        destination: "/",
        permanent: true,
      },
      // Old Wix members area
      {
        source: "/members/:path*",
        destination: "/account",
        permanent: true,
      },
      // Old Wix category/group pages
      {
        source: "/category/:slug",
        destination: "/collections/:slug",
        permanent: true,
      },
      {
        source: "/so/:slug",
        destination: "/collections/:slug",
        permanent: true,
      },
      // Wix native store collection page
      {
        source: "/store/:slug",
        destination: "/collections/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
