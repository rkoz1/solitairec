"use server";

import { getServerWixClient } from "@/lib/wix-server-client";
import { getWixImageUrl } from "@/lib/wix-image";

export interface ProductOption {
  name: string;
  choices: Array<{ value: string; description: string }>;
}

export interface WishlistProduct {
  _id: string;
  name: string;
  slug: string;
  price: string;
  imageUrl: string;
  productOptions: ProductOption[];
  inStock: boolean;
  hasRealVariants: boolean;
}

export async function getProductsByIds(
  ids: string[]
): Promise<WishlistProduct[]> {
  if (ids.length === 0) return [];

  const wix = getServerWixClient();
  const { items } = await wix.products
    .queryProducts()
    .hasSome("_id", ids)
    .limit(ids.length)
    .find();

  return items.map((p) => ({
    _id: p._id ?? "",
    name: p.name ?? "Product",
    slug: p.slug ?? "",
    price: p.priceData?.formatted?.price ?? "",
    imageUrl: getWixImageUrl(p.media?.mainMedia?.image?.url, 200, 267),
    productOptions: (p.productOptions ?? []).map((opt) => ({
      name: opt.name ?? "",
      choices: (opt.choices ?? []).map((c) => ({
        value: c.value ?? "",
        description: c.description ?? "",
      })),
    })),
    inStock: (p.stock as { inventoryStatus?: string } | undefined)?.inventoryStatus !== "OUT_OF_STOCK",
    hasRealVariants: ((p.variants ?? []) as { choices?: Record<string, string> }[]).some(
      (v) => Object.keys(v.choices ?? {}).length > 0
    ),
  }));
}
