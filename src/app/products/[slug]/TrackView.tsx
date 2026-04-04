"use client";

import { useEffect } from "react";
import { addRecentlyViewed } from "@/lib/recently-viewed";
import { trackEvent } from "@/lib/meta-pixel";
import { trackAnalytics } from "@/lib/analytics";
import { clarityTag } from "@/lib/clarity";

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
    trackAnalytics("product_view", {
      product_id: productId,
      product_name: productName,
      price,
      currency,
    });
    clarityTag("last_product_viewed", productName);
    clarityTag("last_product_price", price);
  }, [productId, productName, price, currency]);

  return null;
}
