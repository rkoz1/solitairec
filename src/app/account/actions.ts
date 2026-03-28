"use server";

import { getServerWixClient } from "@/lib/wix-server-client";

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
