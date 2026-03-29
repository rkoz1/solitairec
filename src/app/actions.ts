"use server";

import { getServerWixClient } from "@/lib/wix-server-client";

let cachedThreshold: number | null = null;
let cachedAt = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function getFreeShippingThreshold(): Promise<number> {
  if (cachedThreshold !== null && Date.now() - cachedAt < CACHE_TTL) {
    return cachedThreshold;
  }

  try {
    const wix = getServerWixClient();
    const result = await wix.shippingOptions.queryShippingOptions().find();
    const options = result.items ?? [];

    let lowestThreshold = Infinity;

    for (const option of options) {
      for (const rate of option.rates ?? []) {
        if (rate.amount !== "0") continue;

        for (const condition of rate.conditions ?? []) {
          if (
            condition.type === "BY_TOTAL_PRICE" &&
            condition.operator === "GT"
          ) {
            const value = parseFloat(condition.value ?? "0");
            if (value > 0 && value < lowestThreshold) {
              lowestThreshold = value;
            }
          }
        }
      }
    }

    const threshold = lowestThreshold === Infinity ? 0 : lowestThreshold;
    cachedThreshold = threshold;
    cachedAt = Date.now();
    return threshold;
  } catch {
    return 0;
  }
}

export interface VariantStockInfo {
  inStock: boolean;
  quantity: number;
}

export async function getProductVariantStock(
  productId: string
): Promise<Record<string, VariantStockInfo>> {
  try {
    const wix = getServerWixClient();
    const { items } = await wix.products
      .queryProducts()
      .eq("_id", productId)
      .limit(1)
      .find();

    const product = items[0];
    if (!product) return {};

    const variants = (product.variants ?? []) as {
      choices?: Record<string, string>;
      stock?: { inStock?: boolean; quantity?: number; trackQuantity?: boolean };
    }[];

    const stockMap: Record<string, VariantStockInfo> = {};
    for (const v of variants) {
      if (!v.choices || Object.keys(v.choices).length === 0) continue;
      // Key: sorted option pairs e.g. "Color:Black|Size:M"
      const key = Object.entries(v.choices)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => `${k}:${val}`)
        .join("|");
      const qty = v.stock?.quantity ?? 0;
      stockMap[key] = {
        inStock: (v.stock?.inStock ?? true) && qty !== 0,
        quantity: qty,
      };
    }
    return stockMap;
  } catch {
    return {};
  }
}
