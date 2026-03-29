"use server";

import { getServerWixClient } from "@/lib/wix-server-client";
import { getWixImageUrl } from "@/lib/wix-image";

export interface ProductOption {
  name: string;
  choices: Array<{ value: string; description: string }>;
}

export interface VariantMapping {
  key: string; // sorted option string e.g. "Color:Brown|Size:M"
  variantId: string;
  inStock: boolean;
}

export interface WishlistProduct {
  _id: string;
  name: string;
  slug: string;
  price: string;
  imageUrl: string;
  productOptions: ProductOption[];
  inStock: boolean;
  manageVariants: boolean;
  variants: VariantMapping[];
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
    manageVariants: p.manageVariants ?? false,
    variants: ((p.variants ?? []) as { _id?: string; choices?: Record<string, string>; stock?: { inStock?: boolean; quantity?: number; trackQuantity?: boolean } }[])
      .filter((v) => v.choices && Object.keys(v.choices).length > 0)
      .map((v) => {
        const key = Object.entries(v.choices!)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, val]) => `${k}:${val}`)
          .join("|");
        const trackQty = v.stock?.trackQuantity ?? false;
        const qty = v.stock?.quantity ?? 0;
        const inStock = v.stock?.inStock ?? true;
        return {
          key,
          variantId: v._id ?? "",
          inStock: trackQty ? inStock && qty !== 0 : inStock,
        };
      }),
  }));
}
