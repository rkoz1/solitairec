"use client";

import { useState, useEffect } from "react";
import type { ShippingRegion } from "@/lib/shipping-regions";
import { getRegionForCountry } from "@/lib/shipping-regions";
import { useDisplayCurrency } from "./Price";

export default function ShippingInfo() {
  const [region, setRegion] = useState<ShippingRegion | null>(null);
  const { format } = useDisplayCurrency();

  useEffect(() => {
    loadRegion();
    window.addEventListener("region-changed", loadRegion);
    return () => window.removeEventListener("region-changed", loadRegion);
  }, []);

  function loadRegion() {
    const regionId = localStorage.getItem("shipping_region");
    const countryCode = localStorage.getItem("shipping_country") || "HK";

    import("@/app/actions").then(({ getShippingRegions }) => {
      getShippingRegions().then((data) => {
        if (regionId) {
          const r = data.regions.find((reg) => reg.id === regionId);
          if (r) { setRegion(r); return; }
        }
        setRegion(getRegionForCountry(countryCode, data));
      });
    });
  }

  if (!region) return null;

  return (
    <div className="flex items-center gap-3 py-3 text-[10px] tracking-[0.15em] text-on-surface-variant">
      <span className="material-symbols-outlined text-[16px] text-secondary">
        local_shipping
      </span>
      <span>
        {region.estimatedDelivery}
        {" · "}
        {region.shippingCost > 0 ? (
          <>
            From {format(region.shippingCost)}
            {" · "}
            <span className="text-secondary font-medium">
              Free over {format(region.freeThreshold)}
            </span>
          </>
        ) : (
          <span className="text-secondary font-medium">Free shipping</span>
        )}
      </span>
    </div>
  );
}
