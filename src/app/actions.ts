"use server";

import { unstable_cache } from "next/cache";
import { getServerWixClient } from "@/lib/wix-server-client";
import type { ShippingRegionData, ShippingRegion } from "@/lib/shipping-regions";

export const getFreeShippingThreshold = unstable_cache(
  async (): Promise<number> => {
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

      return lowestThreshold === Infinity ? 0 : lowestThreshold;
    } catch {
      return 0;
    }
  },
  ["free-shipping-threshold"],
  { revalidate: 3600, tags: ["shipping"] }
);

export interface VariantStockInfo {
  inStock: boolean;
  quantity: number;
  variantId?: string;
}

export interface ProductVariantData {
  manageVariants: boolean;
  stock: Record<string, VariantStockInfo>;
}

export async function getProductVariantStock(
  productId: string
): Promise<ProductVariantData> {
  try {
    const wix = getServerWixClient();
    const { items } = await wix.products
      .queryProducts()
      .eq("_id", productId)
      .limit(1)
      .find();

    const product = items[0];
    if (!product) return { manageVariants: false, stock: {} };

    const variants = (product.variants ?? []) as {
      _id?: string;
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
      const trackQty = v.stock?.trackQuantity ?? false;
      const inStock = v.stock?.inStock ?? true;
      stockMap[key] = {
        inStock: trackQty ? inStock && qty !== 0 : inStock,
        quantity: qty,
        variantId: v._id,
      };
    }
    return { manageVariants: product.manageVariants ?? false, stock: stockMap };
  } catch {
    return { manageVariants: false, stock: {} };
  }
}

// --- Shipping regions ---

function getRegionDisplayName(title: string, countries: string[]): string {
  if (countries.includes("HK")) return "Hong Kong";
  if (countries.includes("MO") && countries.includes("TW")) return "Macau & Taiwan";
  if (countries.includes("US")) return "United States";
  if (countries.includes("AU")) return "Australia";
  if (countries.includes("JP") || countries.includes("SG") || countries.includes("KR")) return "Asia";
  if (countries.length === 0) return "Rest of World";
  return title;
}

export const getShippingRegions = unstable_cache(
  async (): Promise<ShippingRegionData> => {
    try {
      const wix = getServerWixClient();

      const [profiles, shippingOpts] = await Promise.all([
        wix.deliveryProfile.queryDeliveryProfiles().find(),
        wix.shippingOptions.queryShippingOptions().find(),
      ]);

      const regionCountries = new Map<string, string[]>();

      for (const profile of profiles.items ?? []) {
        for (const region of (profile.deliveryRegions ?? []) as {
          _id?: string;
          destinations?: { countryCode?: string }[];
        }[]) {
          const regionId = region._id ?? "";
          const countries = (region.destinations ?? [])
            .map((d) => d.countryCode ?? "")
            .filter(Boolean);
          regionCountries.set(regionId, countries);
        }
      }

      const regions: ShippingRegion[] = [];
      const countryToRegionId: Record<string, string> = {};

      for (const opt of (shippingOpts.items ?? []) as {
        deliveryRegionIds?: string[];
        title?: string;
        estimatedDeliveryTime?: string;
        rates?: { amount?: string; conditions?: { type?: string; value?: string; operator?: string }[] }[];
      }[]) {
        const regionId = opt.deliveryRegionIds?.[0] ?? "";
        if (!regionId) continue;

        const countries = regionCountries.get(regionId) ?? [];
        const rates = opt.rates ?? [];
        const paidRate = rates.find((r) => r.amount !== "0");
        const shippingCost = parseFloat(paidRate?.amount ?? "0");
        const freeRate = rates.find((r) => r.amount === "0");
        const freeCondition = freeRate?.conditions?.find(
          (c) => c.type === "BY_TOTAL_PRICE" && c.operator === "GT"
        );
        const freeThreshold = parseFloat(freeCondition?.value ?? "0");

        regions.push({
          id: regionId,
          name: getRegionDisplayName(opt.title ?? "", countries),
          countries,
          shippingCost,
          freeThreshold,
          estimatedDelivery: opt.estimatedDeliveryTime ?? "4-14 Days",
        });

        for (const cc of countries) {
          countryToRegionId[cc] = regionId;
        }
      }

      const hkRegion = regions.find((r) => r.countries.includes("HK"));
      return {
        regions,
        countryToRegionId,
        defaultRegionId: hkRegion?.id ?? regions[0]?.id ?? "",
      };
    } catch {
      return {
        regions: [{ id: "hk", name: "Hong Kong", countries: ["HK"], shippingCost: 35, freeThreshold: 900, estimatedDelivery: "1-2 Days" }],
        countryToRegionId: { HK: "hk" },
        defaultRegionId: "hk",
      };
    }
  },
  ["shipping-regions"],
  { revalidate: 3600, tags: ["shipping"] }
);

// --- Currency conversion ---

export interface CurrencyInfo {
  code: string;
  symbol: string;
}

export const getSupportedCurrencies = unstable_cache(
  async (): Promise<CurrencyInfo[]> => {
    try {
      const wix = getServerWixClient();
      const result = await wix.currencies.listCurrencies();
      return (result.currencies ?? []).map((c) => ({
        code: c.code ?? "",
        symbol: c.symbol ?? c.code ?? "",
      }));
    } catch {
      return [{ code: "HKD", symbol: "HK$" }];
    }
  },
  ["supported-currencies"],
  { revalidate: 86400, tags: ["currencies"] }
);

export const getConversionRate = unstable_cache(
  async (toCurrency: string): Promise<{ rate: number; symbol: string }> => {
    if (toCurrency === "HKD") return { rate: 1, symbol: "HK$" };

    try {
      const wix = getServerWixClient();
      const result = await wix.currencies.getConversionRate({ from: "HKD", to: toCurrency });
      const rateValue = result.rate?.value ?? "1";
      const decimalPlaces = result.rate?.decimalPlaces ?? 0;
      const rate = parseInt(rateValue, 10) / Math.pow(10, decimalPlaces);

      const currencies = await getSupportedCurrencies();
      const symbol = currencies.find((c) => c.code === toCurrency)?.symbol ?? toCurrency;
      return { rate, symbol };
    } catch {
      return { rate: 1, symbol: "HK$" };
    }
  },
  ["conversion-rate"],
  { revalidate: 1800, tags: ["currencies"] }
);
