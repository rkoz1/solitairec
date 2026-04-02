"use client";

import { useEffect } from "react";
import { addRecentlyViewed } from "@/lib/recently-viewed";
import { trackEvent } from "@/lib/meta-pixel";

interface TrackViewProps {
  productId: string;
  productName: string;
  price: number;
  currency: string;
}

export default function TrackView({
  productId,
  productName,
  price,
  currency,
}: TrackViewProps) {
  useEffect(() => {
    addRecentlyViewed(productId);
    trackEvent("ViewContent", {
      content_ids: [productId],
      content_name: productName,
      content_type: "product",
      value: price,
      currency,
    });
  }, [productId, productName, price, currency]);

  return null;
}
