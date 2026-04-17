"use server";

import { safeCache } from "@/lib/fetch-retry";
import { getServerWixClient } from "@/lib/wix-server-client";

export interface AvailableReward {
  id: string;
  name: string;
  discountAmount: string;
  costInPoints: number;
  restrictedToTierId?: string;
}

export const getAvailableRewards = safeCache(
  async (): Promise<AvailableReward[]> => {
    try {
      const wix = getServerWixClient();
      const result = await wix.loyaltyRewards.listRewards();
      const rewards = (result?.rewards ?? []) as {
        _id?: string;
        name?: string;
        active?: boolean;
        couponReward?: {
          fixedAmount?: {
            configsByTier?: {
              amount?: number;
              costInPoints?: number;
              tierId?: string;
            }[];
          };
          percentage?: {
            configsByTier?: {
              percentage?: number;
              costInPoints?: number;
              tierId?: string;
            }[];
          };
        };
      }[];

      return rewards
        .filter((r) => r.active)
        .map((r) => {
          // Use the base tier config (no tierId) or first available
          const fixedConfigs = r.couponReward?.fixedAmount?.configsByTier ?? [];
          const pctConfigs = r.couponReward?.percentage?.configsByTier ?? [];

          const fixedBase = fixedConfigs.find((c) => !c.tierId) ?? fixedConfigs[0];
          const pctBase = pctConfigs.find((c) => !c.tierId) ?? pctConfigs[0];

          if (fixedBase) {
            // If ALL configs have a tierId, this reward is tier-restricted
            const allFixed = fixedConfigs.every((c) => c.tierId);
            return {
              id: r._id ?? "",
              name: r.name ?? "Reward",
              discountAmount: `$${fixedBase.amount ?? 0}`,
              costInPoints: fixedBase.costInPoints ?? 0,
              restrictedToTierId: allFixed ? fixedBase.tierId : undefined,
            };
          }
          if (pctBase) {
            const allPct = pctConfigs.every((c) => c.tierId);
            return {
              id: r._id ?? "",
              name: r.name ?? "Reward",
              discountAmount: `${pctBase.percentage ?? 0}%`,
              costInPoints: pctBase.costInPoints ?? 0,
              restrictedToTierId: allPct ? pctBase.tierId : undefined,
            };
          }
          return null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null && r.costInPoints > 0);
    } catch {
      return [];
    }
  },
  ["available-rewards"],
  { revalidate: 1800, tags: ["loyalty"] }
);

export interface TierData {
  id: string | null;
  name: string;
  requiredPoints: number;
}

export interface TierInfo {
  tiers: TierData[];
  baseTierName: string;
}

export const getTierInfo = safeCache(
  async (): Promise<TierInfo> => {
    try {
      const wix = getServerWixClient();
      const [tiersResult, settingsResult] = await Promise.all([
        wix.loyaltyTiers.listTiers().catch(() => ({ tiers: [] })),
        wix.loyaltyTiers.getTiersProgramSettings().catch(() => null),
      ]);

      const tiers = ((tiersResult?.tiers ?? []) as {
        _id?: string | null;
        tierDefinition?: { name?: string };
        requiredPoints?: number;
      }[])
        .map((t) => ({
          id: t._id ?? null,
          name: t.tierDefinition?.name ?? "Tier",
          requiredPoints: t.requiredPoints ?? 0,
        }))
        .sort((a, b) => a.requiredPoints - b.requiredPoints);

      const settings = settingsResult as {
        programSettings?: { baseTierDefinition?: { name?: string } };
      } | null;
      const baseTierName =
        settings?.programSettings?.baseTierDefinition?.name ?? "Green";

      return { tiers, baseTierName };
    } catch {
      return { tiers: [], baseTierName: "Green" };
    }
  },
  ["tier-info"],
  { revalidate: 3600, tags: ["loyalty"] }
);

export interface TrackingInfo {
  trackingNumber: string;
  shippingProvider: string;
  trackingLink?: string;
}

// NOT cached — user-specific, real-time data
export async function getOrderTracking(
  orderId: string
): Promise<TrackingInfo[]> {
  try {
    const wix = getServerWixClient();
    const result =
      await wix.orderFulfillments.listFulfillmentsForSingleOrder(orderId);

    const fulfillments = result.orderWithFulfillments?.fulfillments ?? [];

    return fulfillments
      .map((f) => {
        const info = f.trackingInfo;
        if (!info?.trackingNumber) return null;
        return {
          trackingNumber: info.trackingNumber,
          shippingProvider: info.shippingProvider ?? "Carrier",
          trackingLink: info.trackingLink ?? undefined,
        };
      })
      .filter(Boolean) as TrackingInfo[];
  } catch {
    return [];
  }
}
