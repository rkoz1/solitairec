import type { MetadataRoute } from "next";
import { safeCache } from "@/lib/fetch-retry";
import { getServerWixClient } from "@/lib/wix-server-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

const getSitemapData = safeCache(
  async () => {
    const wix = getServerWixClient();
    const entries: { url: string; lastModified?: string; changeFrequency: string; priority: number }[] = [];

    // Collections
    try {
      const { items: collections } = await wix.collections
        .queryCollections()
        .limit(100)
        .find();

      for (const c of collections) {
        if (c.slug) {
          entries.push({
            url: `${SITE_URL}/collections/${c.slug}`,
            changeFrequency: "daily",
            priority: 0.7,
          });
        }
      }
    } catch {
      // Continue without collections
    }

    // Products (paginated)
    try {
      let offset = 0;
      const PAGE_SIZE = 100;

      while (true) {
        const { items } = await wix.products
          .queryProducts()
          .limit(PAGE_SIZE)
          .skip(offset)
          .find();

        for (const p of items) {
          // Skip out-of-stock products
          const stock = p.stock as { inventoryStatus?: string } | undefined;
          if (stock?.inventoryStatus === "OUT_OF_STOCK") continue;

          if (p.slug) {
            entries.push({
              url: `${SITE_URL}/products/${p.slug}`,
              lastModified: p.lastUpdated ? new Date(p.lastUpdated as unknown as string).toISOString() : undefined,
              changeFrequency: "weekly",
              priority: 0.8,
            });
          }
        }

        if (items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    } catch {
      // Continue without products
    }

    return entries;
  },
  ["sitemap-data"],
  { revalidate: 3600, tags: ["product-catalog", "collections"] }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/our-mission", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "monthly" as const },
    { path: "/gift-cards", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/loyalty", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/refer-friends", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "monthly" as const },
    { path: "/newsletter", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/search", priority: 0.4, changeFrequency: "daily" as const },
  ];

  const entries: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const dynamicEntries = await getSitemapData();
  for (const entry of dynamicEntries) {
    entries.push({
      url: entry.url,
      lastModified: entry.lastModified ? new Date(entry.lastModified) : undefined,
      changeFrequency: entry.changeFrequency as "daily" | "weekly",
      priority: entry.priority,
    });
  }

  return entries;
}
