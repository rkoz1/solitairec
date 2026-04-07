"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { isInWishlist, toggleWishlist } from "@/lib/wishlist";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import { addItemToCart, buildStockKey } from "@/lib/cart";
import { trackAnalytics } from "@/lib/analytics";
import { trackMetaEvent } from "@/lib/meta-track";
import { clarityEvent, clarityTag } from "@/lib/clarity";
import { showToast } from "@/lib/toast";

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
  const [variantStock, setVariantStock] = useState<Record<string, { inStock: boolean; quantity: number; variantId?: string }>>({});
  const [manageVariants, setManageVariants] = useState(false);
  const [variantDataLoaded, setVariantDataLoaded] = useState(false);

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
    trackAnalytics(nowIn ? "wishlist_add" : "wishlist_remove", {
      product_id: productId,
      source: "product_card",
    });
    if (nowIn) {
      showToast("Saved — find your favourites in Bag", "success");
    }
  }

  function handleBag(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // No options → add immediately with V1, no need to fetch variant data
    if (productOptions.length === 0) {
      addToBag({}, false);
      return;
    }

    const defaults: Record<string, string> = {};
    for (const opt of productOptions) {
      const c = opt.choices[0];
      if (c) defaults[opt.name] = c.description || c.value;
    }
    setSelectedOptions(defaults);
    setSheetOpen(true);
    setVariantDataLoaded(false);

    // Lazy-fetch variant stock + manageVariants flag
    import("@/app/actions").then(({ getProductVariantStock }) =>
      getProductVariantStock(productId).then((data) => {
        setVariantStock(data.stock);
        setManageVariants(data.manageVariants);
        setVariantDataLoaded(true);

        // Re-select defaults if current selection is out of stock
        if (data.manageVariants && Object.keys(data.stock).length > 0) {
          setSelectedOptions((prev) => {
            const updated = { ...prev };
            for (const opt of productOptions) {
              const currentKey = buildStockKey(updated);
              if (data.stock[currentKey]?.inStock === false) {
                for (const c of opt.choices) {
                  const label = c.description || c.value;
                  const testOpts = { ...updated, [opt.name]: label };
                  const testKey = buildStockKey(testOpts);
                  if (data.stock[testKey]?.inStock !== false) {
                    updated[opt.name] = label;
                    break;
                  }
                }
              }
            }
            return updated;
          });
        }
      })
    );
  }

  function getChoiceStock(optionName: string, choiceLabel: string): { inStock: boolean; quantity: number } | null {
    if (Object.keys(variantStock).length === 0) return null;
    const testOptions = { ...selectedOptions, [optionName]: choiceLabel };
    const key = buildStockKey(testOptions);
    return variantStock[key] ?? null;
  }

  async function addToBag(opts: Record<string, string>, useVariantData: boolean = true) {
    setAdding(true);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      // Resolve variant ID from stock data
      let resolvedVariantId: string | undefined;
      if (useVariantData && manageVariants && Object.keys(opts).length > 0) {
        const key = buildStockKey(opts);
        resolvedVariantId = variantStock[key]?.variantId;
      }

      const result = await addItemToCart(wix, {
        productId,
        productName,
        manageVariants: useVariantData ? manageVariants : false,
        selectedOptions: opts,
        variantId: resolvedVariantId,
      });

      if (!result.success) {
        const { showToast } = await import("@/lib/toast");
        showToast(result.error ?? "This item couldn't be added to your bag.", "error");
        return;
      }

      window.dispatchEvent(new Event("cart-updated"));
      trackMetaEvent("AddToCart", {
        content_ids: [productId],
        content_name: productName ?? "",
        content_type: "product",
        value: parseFloat(productPrice ?? "0"),
        currency: "HKD",
      });
      trackAnalytics("quick_add_to_cart", {
        product_id: productId,
        product_name: productName ?? "",
        source: "product_card",
      });
      clarityEvent("add_to_cart");
      clarityTag("last_added_product", productName ?? "");

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
      const { log } = await import("@/lib/logger");
      log({ level: "error", action: "quick-add-to-bag-failed", details: { productId, productName }, error });
      const { showToast } = await import("@/lib/toast");
      showToast("This item couldn't be added to your bag. It may be out of stock.", "error");
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
                  <img
                    src={productImage}
                    alt={productName ?? ""}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
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
                              onClick={() =>
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [option.name]: label,
                                }))
                              }
                              className={`relative w-8 h-8 transition-colors ${
                                oos
                                  ? isSelected
                                    ? "opacity-50 ring-2 ring-on-surface ring-offset-2 ring-offset-white"
                                    : "opacity-25"
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
                              onClick={() =>
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [option.name]: label,
                                }))
                              }
                              className={`px-3 py-2 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors border border-outline-variant/20 ${
                                oos
                                  ? isSelected
                                    ? "opacity-50 line-through bg-on-surface text-on-primary"
                                    : "opacity-30 line-through"
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
                disabled={adding || !variantDataLoaded}
                className="w-full bg-on-surface text-on-primary py-4 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {adding ? "Adding..." : !variantDataLoaded ? "Loading..." : "Add to Bag"}
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
        className={`absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 transition-opacity duration-200 ${
          inWishlist
            ? "opacity-100"
            : "opacity-60 lg:opacity-0 lg:group-hover:opacity-70"
        }`}
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
      >
        <span className="hidden lg:block text-[9px] tracking-[0.15em] uppercase font-medium text-white drop-shadow-sm">
          {inWishlist ? "Saved" : "Save"}
        </span>
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
        className={`absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1.5 transition-opacity duration-200 ${
          added
            ? "opacity-100"
            : "opacity-60 lg:opacity-0 lg:group-hover:opacity-70"
        }`}
        aria-label="Add to bag"
      >
        <span className="hidden lg:block text-[9px] tracking-[0.15em] uppercase font-medium text-white drop-shadow-sm">
          {added ? "Added" : "Add to Bag"}
        </span>
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
