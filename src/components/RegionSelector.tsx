"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ShippingRegion, ShippingRegionData } from "@/lib/shipping-regions";
import { COUNTRY_LIST, COUNTRY_CURRENCY, getRegionForCountry } from "@/lib/shipping-regions";

const STORAGE_KEY_REGION = "shipping_region";
const STORAGE_KEY_COUNTRY = "shipping_country";
const STORAGE_KEY_CURRENCY = "display_currency";
const STORAGE_KEY_RATE = "display_currency_rate";
const STORAGE_KEY_SYMBOL = "display_currency_symbol";
const STORAGE_KEY_DISMISSED = "shipping_modal_dismissed";

// Common currencies for the selector
const CURRENCY_OPTIONS = [
  "HKD", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY",
  "KRW", "CNY", "TWD", "THB", "MYR", "PHP", "CHF", "NZD",
];

interface RegionSelectorProps {
  detectedCountry: string;
}

export default function RegionSelector({ detectedCountry }: RegionSelectorProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(detectedCountry || "HK");
  const [selectedCurrency, setSelectedCurrency] = useState("HKD");
  const [currentRegion, setCurrentRegion] = useState<ShippingRegion | null>(null);
  const [regionData, setRegionData] = useState<ShippingRegionData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [previewRate, setPreviewRate] = useState(1);
  const [previewSymbol, setPreviewSymbol] = useState("HK$");

  useEffect(() => {
    setMounted(true);

    import("@/app/actions").then(({ getShippingRegions }) => {
      getShippingRegions().then((data) => {
        setRegionData(data);

        const savedCountry = localStorage.getItem(STORAGE_KEY_COUNTRY);
        const savedCurrency = localStorage.getItem(STORAGE_KEY_CURRENCY);
        const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED);

        const country = savedCountry || detectedCountry || "HK";
        setSelectedCountry(country);

        const currency = savedCurrency || COUNTRY_CURRENCY[country] || "HKD";
        setSelectedCurrency(currency);

        const region = getRegionForCountry(country, data);
        setCurrentRegion(region);

        if (!savedCountry) {
          localStorage.setItem(STORAGE_KEY_COUNTRY, country);
          localStorage.setItem(STORAGE_KEY_REGION, region.id);
        }

        // Fetch conversion rate if not HKD — for both localStorage persistence and modal preview
        if (currency !== "HKD") {
          // Preview rate for modal
          import("@/app/actions").then(({ getConversionRate }) =>
            getConversionRate(currency).then(({ rate, symbol }) => {
              setPreviewRate(rate);
              setPreviewSymbol(symbol);
              // Also save to localStorage if first visit
              if (!savedCurrency) {
                localStorage.setItem(STORAGE_KEY_RATE, String(rate));
                localStorage.setItem(STORAGE_KEY_SYMBOL, symbol);
                window.dispatchEvent(new Event("region-changed"));
              }
            })
          );
        }

        if (!savedCountry && !dismissed && country !== "HK") {
          setModalOpen(true);
        }
      });
    });
  }, [detectedCountry]);

  function handleCountryChange(code: string) {
    setSelectedCountry(code);
    const currency = COUNTRY_CURRENCY[code] || "HKD";
    setSelectedCurrency(currency);
    fetchPreviewRate(currency);
    if (regionData) {
      setCurrentRegion(getRegionForCountry(code, regionData));
    }
  }

  function fetchPreviewRate(currency: string) {
    if (currency === "HKD") {
      setPreviewRate(1);
      setPreviewSymbol("HK$");
      return;
    }
    import("@/app/actions").then(({ getConversionRate }) =>
      getConversionRate(currency).then(({ rate, symbol }) => {
        setPreviewRate(rate);
        setPreviewSymbol(symbol);
      })
    );
  }

  async function fetchAndSaveRate(currency: string) {
    if (currency === "HKD") {
      localStorage.setItem(STORAGE_KEY_RATE, "1");
      localStorage.setItem(STORAGE_KEY_SYMBOL, "HK$");
      return;
    }
    const { getConversionRate } = await import("@/app/actions");
    const { rate, symbol } = await getConversionRate(currency);
    localStorage.setItem(STORAGE_KEY_RATE, String(rate));
    localStorage.setItem(STORAGE_KEY_SYMBOL, symbol);
  }

  async function handleConfirm() {
    localStorage.setItem(STORAGE_KEY_COUNTRY, selectedCountry);
    localStorage.setItem(STORAGE_KEY_REGION, currentRegion?.id ?? "");
    localStorage.setItem(STORAGE_KEY_CURRENCY, selectedCurrency);
    localStorage.setItem(STORAGE_KEY_DISMISSED, "true");

    // Wait for rate to be saved before notifying other components
    await fetchAndSaveRate(selectedCurrency);

    setModalOpen(false);
    window.dispatchEvent(new Event("region-changed"));
  }

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY_DISMISSED, "true");
    setModalOpen(false);
  }

  const countryName =
    COUNTRY_LIST.find((c) => c.code === selectedCountry)?.name ?? selectedCountry;

  const indicator = mounted && currentRegion ? (
    <button
      onClick={() => setModalOpen(true)}
      className="text-[10px] tracking-[0.15em] text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
    >
      <span className="material-symbols-outlined text-[14px]">location_on</span>
      <span>
        {countryName} · {selectedCurrency}
      </span>
    </button>
  ) : null;

  const modal =
    modalOpen && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center animate-[fadeIn_200ms_ease-out]"
            onClick={handleDismiss}
          >
            <div className="absolute inset-0 bg-black/30" />
            <div
              className="relative bg-white w-full max-w-md mx-5 animate-[slideUp_300ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-8 pt-10 pb-8">
                <h2 className="font-serif italic text-xl tracking-tight text-on-surface text-center mb-6">
                  I&apos;m shipping to
                </h2>

                {/* Country dropdown */}
                <select
                  value={selectedCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary appearance-none"
                >
                  {COUNTRY_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Currency selector */}
                <div className="mt-4">
                  <label className="text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
                    Display prices in
                  </label>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => {
                      const cur = e.target.value;
                      setSelectedCurrency(cur);
                      fetchPreviewRate(cur);
                    }}
                    className="w-full mt-1.5 px-4 py-3 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary appearance-none"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shipping info — converted live as currency changes */}
                {currentRegion && (() => {
                  const fmt = (amount: number) =>
                    previewRate === 1
                      ? `HK$${amount.toLocaleString()}`
                      : `${previewSymbol}${Math.round(amount * previewRate).toLocaleString()}`;
                  return (
                  <div className="mt-5 bg-surface-container-low px-4 py-4 space-y-2">
                    <div className="flex justify-between text-[11px] tracking-wide">
                      <span className="text-on-surface-variant">
                        Estimated delivery
                      </span>
                      <span className="text-on-surface font-medium">
                        {currentRegion.estimatedDelivery}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] tracking-wide">
                      <span className="text-on-surface-variant">
                        Shipping from
                      </span>
                      <span className="text-on-surface font-medium">
                        {currentRegion.shippingCost > 0
                          ? fmt(currentRegion.shippingCost)
                          : "Free"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] tracking-wide">
                      <span className="text-on-surface-variant">
                        Free shipping over
                      </span>
                      <span className="text-on-surface font-medium">
                        {fmt(currentRegion.freeThreshold)}
                      </span>
                    </div>
                  </div>
                  );
                })()}

                <p className="mt-5 text-[10px] tracking-wide text-secondary text-center">
                  {selectedCurrency !== "HKD"
                    ? `Prices shown in ${selectedCurrency} are approximate. Your order will be billed in HKD.`
                    : "Your order will be billed in HKD"}
                </p>

                <button
                  onClick={handleConfirm}
                  className="w-full mt-6 bg-on-surface text-on-primary py-4 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98]"
                >
                  Continue
                </button>

                <button
                  onClick={handleDismiss}
                  className="w-full mt-3 text-center text-xs tracking-[0.15em] text-on-surface-variant underline underline-offset-4 hover:text-on-surface transition-colors py-2"
                >
                  Stay on this website
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {indicator}
      {modal}
    </>
  );
}

export function getSavedShippingRegionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY_REGION);
}

export function getSavedCountryCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY_COUNTRY);
}

