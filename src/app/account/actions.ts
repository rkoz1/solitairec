"use server";

import { getServerWixClient } from "@/lib/wix-server-client";

export interface AvailableReward {
  id: string;
  name: string;
  discountAmount: string;
  costInPoints: number;
}

export async function getAvailableRewards(): Promise<AvailableReward[]> {
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
          return {
            id: r._id ?? "",
            name: r.name ?? "Reward",
            discountAmount: `$${fixedBase.amount ?? 0}`,
            costInPoints: fixedBase.costInPoints ?? 0,
          };
        }
        if (pctBase) {
          return {
            id: r._id ?? "",
            name: r.name ?? "Reward",
            discountAmount: `${pctBase.percentage ?? 0}%`,
            costInPoints: pctBase.costInPoints ?? 0,
          };
        }
        return null;
      })
      .filter((r): r is AvailableReward => r !== null && r.costInPoints > 0);
  } catch {
    return [];
  }
}

export interface TrackingInfo {
  trackingNumber: string;
  shippingProvider: string;
  trackingLink?: string;
}

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
