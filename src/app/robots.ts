import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/", "/cart", "/checkout", "/account", "/order-confirmation", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
