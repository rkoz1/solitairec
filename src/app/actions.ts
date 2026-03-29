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
