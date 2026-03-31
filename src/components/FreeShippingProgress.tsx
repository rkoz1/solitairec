"use client";

import { useState, useEffect, useCallback } from "react";
import { getBrowserWixClient, ensureVisitorTokens } from "@/lib/wix-browser-client";
import { getRegionForCountry } from "@/lib/shipping-regions";
import FreeShippingBar from "./FreeShippingBar";

export default function FreeShippingProgress() {
  const [subtotal, setSubtotal] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      // Get threshold from region
      const [{ getShippingRegions }, shippingRegions] = await Promise.all([
        import("@/app/actions"),
        import("@/lib/shipping-regions"),
      ]);
      const data = await getShippingRegions();
      const countryCode = localStorage.getItem("shipping_country") || "HK";
      const region = shippingRegions.getRegionForCountry(countryCode, data);
      setThreshold(region.freeThreshold);

      // Get current cart subtotal
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);
      const est = await wix.currentCart.estimateCurrentCartTotals({});
      const ps = est.priceSummary as { subtotal?: { amount?: string } } | undefined;
      setSubtotal(parseFloat(ps?.subtotal?.amount ?? "0"));
      setLoaded(true);
    } catch {
      // No cart or error — show threshold-only bar with 0 subtotal
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("cart-updated", load);
    window.addEventListener("region-changed", load);
    return () => {
      window.removeEventListener("cart-updated", load);
      window.removeEventListener("region-changed", load);
    };
  }, [load]);

  if (!loaded || threshold <= 0) return null;

  return <FreeShippingBar subtotal={subtotal} threshold={threshold} />;
}
