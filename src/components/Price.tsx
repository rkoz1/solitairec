"use client";

import { useState, useEffect } from "react";
import {
  getDisplayCurrency,
  isConverted as checkConverted,
  formatHKD,
  formatPrice,
  formatDual,
  type DisplayCurrencyInfo,
} from "@/lib/currency";

// Always start with HKD to match server render and avoid hydration mismatch.
// useEffect reads the real preference from localStorage after hydration.
const SSR_DEFAULT: DisplayCurrencyInfo = { currency: "HKD", rate: 1, symbol: "HK$" };

interface PriceProps {
  amount: number;
  className?: string;
  showOriginal?: boolean;
}

export default function Price({ amount, className, showOriginal = false }: PriceProps) {
  const [info, setInfo] = useState<DisplayCurrencyInfo>(SSR_DEFAULT);

  useEffect(() => {
    setInfo(getDisplayCurrency());
    const handler = () => setInfo(getDisplayCurrency());
    window.addEventListener("region-changed", handler);
    return () => window.removeEventListener("region-changed", handler);
  }, []);

  if (!checkConverted(info)) {
    return <span className={className}>{formatHKD(amount)}</span>;
  }

  if (showOriginal) {
    const { primary, secondary } = formatDual(amount, info);
    return (
      <span className={className}>
        {primary}
        {secondary && (
          <span className="text-on-surface-variant/60 ml-1.5">({secondary})</span>
        )}
      </span>
    );
  }

  return <span className={className}>{formatPrice(amount, info)}</span>;
}

/**
 * Hook to get display currency info with reactive updates.
 * Initializes with HKD default (SSR-safe), reads localStorage after mount.
 */
export function useDisplayCurrency() {
  const [info, setInfo] = useState<DisplayCurrencyInfo>(SSR_DEFAULT);

  useEffect(() => {
    setInfo(getDisplayCurrency());
    const handler = () => setInfo(getDisplayCurrency());
    window.addEventListener("region-changed", handler);
    return () => window.removeEventListener("region-changed", handler);
  }, []);

  return {
    ...info,
    isConverted: checkConverted(info),
    format: (hkdAmount: number) => formatPrice(hkdAmount, info),
    formatHKD: (hkdAmount: number) => formatHKD(hkdAmount),
    formatDual: (hkdAmount: number) => formatDual(hkdAmount, info),
  };
}
