"use client";

import { useEffect } from "react";
import { addRecentlyViewed } from "@/lib/recently-viewed";
import { trackViewProduct } from "@/lib/tracking";

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
    trackViewProduct({ productId, productName, price, currency });
  }, [productId, productName, price, currency]);

  return null;
}
