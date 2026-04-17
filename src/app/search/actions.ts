"use server";

import { safeCache } from "@/lib/fetch-retry";
import { getServerWixClient } from "@/lib/wix-server-client";
import { fetchRetry } from "@/lib/fetch-retry";
import { getWixImageUrl } from "@/lib/wix-image";

export interface SearchResult {
  _id: string;
  name: string;
  slug: string;
  price: string;
  imageUrl: string;
}

interface CatalogProduct {
  _id: string;
  name: string;
  nameLower: string;
  slug: string;
  price: string;
  imageUrl: string;
  descriptionLower: string;
}

async function fetchFullCatalog(): Promise<CatalogProduct[]> {
  const wix = getServerWixClient();
  const allProducts: CatalogProduct[] = [];
  let offset = 0;
  const PAGE_SIZE = 100;

  while (true) {
    const { items } = await fetchRetry(() =>
      wix.products
        .queryProducts()
        .limit(PAGE_SIZE)
        .skip(offset)
        .find()
    );

    for (const p of items) {
      // Skip out-of-stock products
      const stock = p.stock as { inventoryStatus?: string } | undefined;
      if (stock?.inventoryStatus === "OUT_OF_STOCK") continue;

      allProducts.push({
        _id: p._id ?? "",
        name: p.name ?? "",
        nameLower: (p.name ?? "").toLowerCase(),
        slug: p.slug ?? "",
        price: p.priceData?.formatted?.price ?? "",
        imageUrl: getWixImageUrl(p.media?.mainMedia?.image?.url, 200, 267),
        descriptionLower: (p.description ?? "").toLowerCase(),
      });
    }

    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allProducts;
}

export const getProductCatalog = safeCache(
  fetchFullCatalog,
  ["product-catalog"],
  { revalidate: 600, tags: ["product-catalog"] }
);

export async function searchProducts(
  query: string
): Promise<SearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const catalog = await getProductCatalog();
  const words = trimmed.split(/\s+/).filter(Boolean);

  const scored = catalog
    .map((p) => {
      const allMatch = words.every(
        (w) => p.nameLower.includes(w) || p.descriptionLower.includes(w)
      );
      if (!allMatch) return null;

      let score = 0;
      for (const w of words) {
        if (p.nameLower.includes(w)) score += 10;
        if (p.nameLower.startsWith(w)) score += 5;
        if (p.descriptionLower.includes(w)) score += 1;
      }

      return { product: p, score };
    })
    .filter(Boolean) as { product: CatalogProduct; score: number }[];

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 8).map(({ product }) => ({
    _id: product._id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    imageUrl: product.imageUrl,
  }));
}

export async function searchProductsCount(query: string): Promise<number> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return 0;
  const catalog = await getProductCatalog();
  const words = trimmed.split(/\s+/).filter(Boolean);
  return catalog.filter((p) =>
    words.every((w) => p.nameLower.includes(w) || p.descriptionLower.includes(w))
  ).length;
}
