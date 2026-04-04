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
