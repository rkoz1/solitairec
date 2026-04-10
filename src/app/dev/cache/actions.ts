"use server";

import { revalidateTag } from "next/cache";

const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY || "solitaire-admin-2026";

const CACHE_TAGS = [
  { tag: "collections", label: "Collections", ttl: "1 hour" },
  { tag: "collection-products", label: "Collection Products", ttl: "10 min" },
  { tag: "product-catalog", label: "Product Catalog", ttl: "10 min" },
  { tag: "search-results", label: "Search Results", ttl: "10 min" },
  { tag: "shipping", label: "Shipping", ttl: "1 hour" },
  { tag: "currencies", label: "Currencies", ttl: "24 hours" },
  { tag: "loyalty", label: "Loyalty", ttl: "30 min" },
  { tag: "recommendations", label: "Recommendations", ttl: "30 min" },
  { tag: "banner-content", label: "Banner Content", ttl: "10 min" },
] as const;

export async function getCacheTags() {
  return CACHE_TAGS;
}

export async function revalidateCacheTag(
  passkey: string,
  tag: string,
): Promise<{ success: boolean; message: string }> {
  if (passkey !== ADMIN_PASSKEY) {
    return { success: false, message: "Invalid passkey." };
  }

  const valid = CACHE_TAGS.some((t) => t.tag === tag);
  if (!valid) {
    return { success: false, message: `Unknown tag: ${tag}` };
  }

  revalidateTag(tag, { expire: 0 });
  return { success: true, message: `Revalidated "${tag}"` };
}

export async function revalidateAllCacheTags(
  passkey: string,
): Promise<{ success: boolean; message: string }> {
  if (passkey !== ADMIN_PASSKEY) {
    return { success: false, message: "Invalid passkey." };
  }

  for (const { tag } of CACHE_TAGS) {
    revalidateTag(tag, { expire: 0 });
  }
  return {
    success: true,
    message: `Revalidated all ${CACHE_TAGS.length} cache tags`,
  };
}
