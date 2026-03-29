"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { isInWishlist, toggleWishlist } from "@/lib/wishlist";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";

const WIX_STORES_APP_ID = "1380b703-ce81-ff05-f115-39571d94dfcd";
const WIX_STORES_V3_APP_ID = "215238eb-22a5-4c36-9e7b-e7c08025e04e";

interface ProductOption {
  name: string;
  choices: { value: string; description: string }[];
}

interface ProductCardActionsProps {
  productId: string;
  productName?: string;
  productPrice?: string;
  productImage?: string;
  productOptions?: ProductOption[];
}

export default memo(function ProductCardActions({
  productId,
  productName,
  productPrice,
  productImage,
  productOptions = [],
}: ProductCardActionsProps) {
  const [inWishlist, setInWishlist] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [variantStock, setVariantStock] = useState<Record<string, { inStock: boolean; quantity: number }>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const sync = useCallback(() => {
    setInWishlist(isInWishlist(productId));
  }, [productId]);

  useEffect(() => {
    sync();
    window.addEventListener("wishlist-updated", sync);
    return () => window.removeEventListener("wishlist-updated", sync);
  }, [sync]);

  function handleHeart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const nowIn = toggleWishlist(productId);
    setInWishlist(nowIn);
  }

  function handleBag(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (productOptions.length === 0) {
      addToBag({});
      return;
    }

    const defaults: Record<string, string> = {};
    for (const opt of productOptions) {
      const c = opt.choices[0];
      if (c) defaults[opt.name] = c.description || c.value;
    }
    setSelectedOptions(defaults);
    setSheetOpen(true);

    // Lazy-fetch variant stock
    import("@/app/actions").then(({ getProductVariantStock }) =>
      getProductVariantStock(productId).then(setVariantStock)
    );
  }

  function getChoiceStock(optionName: string, choiceLabel: string): { inStock: boolean; quantity: number } | null {
    if (Object.keys(variantStock).length === 0) return null;
    const testOptions = { ...selectedOptions, [optionName]: choiceLabel };
    const key = Object.entries(testOptions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join("|");
    return variantStock[key] ?? null;
  }

  async function addToBag(opts: Record<string, string>) {
    setAdding(true);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      // Only use V3 + options if product has real variant choices (not standalone products with informational options)
      const hasRealVariants = Object.keys(variantStock).length > 0;
      const hasOptions = hasRealVariants && Object.keys(opts).length > 0;

      await wix.currentCart.addToCurrentCart({
        lineItems: [
          {
            catalogReference: {
              catalogItemId: productId,
              appId: hasOptions ? WIX_STORES_V3_APP_ID : WIX_STORES_APP_ID,
              options: hasOptions
                ? { options: opts, variantId: "00000000-0000-0000-0000-000000000000" }
                : undefined,
            },
            quantity: 1,
          },
        ],
      });

      window.dispatchEvent(new Event("cart-updated"));

      // Fly-to-cart animation
      const cardEl = document.querySelector(`[data-product-id="${productId}"]`);
      const rect = cardEl?.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent("cart-item-added", {
        detail: {
          imageUrl: productImage,
          sourceX: rect ? rect.left + rect.width / 2 - 24 : window.innerWidth / 2,
          sourceY: rect ? rect.top + rect.height / 3 : window.innerHeight / 2,
          productName: productName ?? "",
        },
      }));

      setAdded(true);
      setSheetOpen(false);
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      console.error("Failed to add to bag:", error);
    } finally {
      setAdding(false);
    }
  }

  const sheet = sheetOpen && mounted
    ? createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center animate-[fadeIn_200ms_ease-out]"
          onClick={() => setSheetOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-lg lg:max-w-2xl bg-white animate-[slideUp_300ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Product info header */}
            <div className="flex gap-4 lg:gap-6 px-6 lg:px-8 pt-6 lg:pt-8 pb-4">
              {productImage && (
                <div className="shrink-0 w-20 h-[107px] lg:w-28 lg:h-[150px] bg-surface-container-low relative">
                  <Image
                    src={productImage}
                    alt={productName ?? ""}
                    fill
                    sizes="(max-width: 1024px) 80px, 112px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="text-[11px] lg:text-sm tracking-[0.12em] uppercase font-medium text-on-surface">
                  {productName}
                </h3>
                <p className="mt-1 text-[10px] lg:text-xs tracking-widest text-on-surface-variant">
                  {productPrice}
                </p>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="self-start shrink-0 w-8 h-8 flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Options */}
            <div className="px-6 lg:px-8 pb-6 lg:pb-8">
              {productOptions.map((option) => {
                const isColor = option.choices[0]?.value && /^(#|rgb)/.test(option.choices[0].value);
                return (
                  <div key={option.name} className="mb-5">
                    <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface mb-2">
                      {option.name}
                      {selectedOptions[option.name] && (
                        <span className="ml-2 text-on-surface-variant font-normal">
                          — {selectedOptions[option.name]}
                        </span>
                      )}
                    </p>
                    {isColor ? (
                      <div className="flex flex-wrap gap-2">
                        {option.choices.map((choice) => {
                          const label = choice.description || choice.value;
                          const isSelected = selectedOptions[option.name] === label;
                          const stock = getChoiceStock(option.name, label);
                          const oos = stock !== null && !stock.inStock;
                          return (
                            <button
                              key={choice.value}
                              onClick={() => {
                                if (oos) return;
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [option.name]: label,
                                }));
                              }}
                              disabled={oos}
                              className={`relative w-8 h-8 transition-colors ${
                                oos
                                  ? "opacity-25 cursor-not-allowed"
                                  : isSelected
                                    ? "ring-2 ring-on-surface ring-offset-2 ring-offset-white"
                                    : "border border-outline-variant/20 hover:border-outline"
                              }`}
                              style={{ backgroundColor: choice.value }}
                              aria-label={`${label}${oos ? " (Sold Out)" : ""}`}
                            >
                              {oos && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <span className="block w-[140%] h-[1px] bg-on-surface/50 rotate-45 origin-center" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {option.choices.map((choice) => {
                          const label = choice.description || choice.value;
                          const isSelected = selectedOptions[option.name] === label;
                          const stock = getChoiceStock(option.name, label);
                          const oos = stock !== null && !stock.inStock;
                          return (
                            <button
                              key={choice.value}
                              onClick={() => {
                                if (oos) return;
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [option.name]: label,
                                }));
                              }}
                              disabled={oos}
                              className={`px-3 py-2 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors border border-outline-variant/20 ${
                                oos
                                  ? "opacity-30 line-through cursor-not-allowed"
                                  : isSelected
                                    ? "bg-on-surface text-on-primary"
                                    : "bg-transparent text-on-surface hover:bg-surface-container-low"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => addToBag(selectedOptions)}
                disabled={adding}
                className="w-full bg-on-surface text-on-primary py-4 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add to Bag"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {/* Heart — top-right */}
      <button
        onClick={handleHeart}
        className={`absolute top-2.5 right-2.5 z-20 w-7 h-7 lg:w-9 lg:h-9 flex items-center justify-center transition-opacity duration-200 ${
          inWishlist
            ? "opacity-100"
            : "opacity-60 lg:opacity-0 lg:group-hover:opacity-70"
        }`}
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
      >
        <span
          className={`material-symbols-outlined text-[20px] lg:text-[24px] drop-shadow-sm ${
            inWishlist ? "text-secondary" : "text-white"
          }`}
          style={inWishlist ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          favorite
        </span>
      </button>

      {/* Bag — bottom-right */}
      <button
        onClick={handleBag}
        className={`absolute bottom-2.5 right-2.5 z-20 w-7 h-7 lg:w-9 lg:h-9 flex items-center justify-center transition-opacity duration-200 ${
          added
            ? "opacity-100"
            : "opacity-60 lg:opacity-0 lg:group-hover:opacity-70"
        }`}
        aria-label="Add to bag"
      >
        <span className={`material-symbols-outlined text-[20px] lg:text-[24px] drop-shadow-sm ${
          added ? "text-secondary" : "text-white"
        }`}
          style={added ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {added ? "check_circle" : "shopping_bag"}
        </span>
      </button>

      {sheet}
    </>
  );
});
