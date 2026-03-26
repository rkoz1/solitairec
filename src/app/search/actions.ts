"use server";

import { getServerWixClient } from "@/lib/wix-server-client";
import { getWixImageUrl } from "@/lib/wix-image";

export interface SearchResult {
  _id: string;
  name: string;
  slug: string;
  price: string;
  imageUrl: string;
}

export async function searchProducts(
  query: string
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const wix = getServerWixClient();

  // startsWith is the only text search operator available in Wix SDK
  const { items } = await wix.products
    .queryProducts()
    .startsWith("name", trimmed)
    .limit(8)
    .find();

  return items.map((p) => ({
    _id: p._id ?? "",
    name: p.name ?? "Product",
    slug: p.slug ?? "",
    price: p.priceData?.formatted?.price ?? "",
    imageUrl: getWixImageUrl(p.media?.mainMedia?.image?.url, 200, 267),
  }));
}
