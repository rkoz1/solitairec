"use client";

import { useState, useMemo } from "react";
import AddToCartButton from "./AddToCartButton";
import ExpressCheckout from "./ExpressCheckout";
import PayPalCheckout from "./PayPalCheckout";
import WishlistButton from "@/components/WishlistButton";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import { showToast } from "@/lib/toast";
import { buildStockKey } from "@/lib/cart";
import { trackAnalytics } from "@/lib/analytics";

interface ProductOption {
  name?: string | null;
  choices?: Array<{
    value?: string | null;
    description?: string | null;
  }> | null;
}

interface VariantInfo {
  variantId: string;
  choices: Record<string, string>;
  inStock: boolean;
  quantity: number;
  trackQuantity: boolean;
}

interface ProductInfoProps {
  productId: string;
  productName?: string;
  productPrice?: string;
  productOptions: ProductOption[];
  variants?: VariantInfo[];
  productInStock?: boolean;
  productQuantity?: number;
  trackInventory?: boolean;
  manageVariants?: boolean;
}

export default function ProductInfo({
  productId,
  productName,
  productPrice,
  productOptions,
  variants = [],
  productInStock = true,
  productQuantity,
  trackInventory = false,
  manageVariants = false,
}: ProductInfoProps) {
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >(() => {
    // Build a quick in-stock set from variants for default selection
    const inStockChoices = new Set<string>();
    if (manageVariants) {
      for (const v of variants) {
        const isOos = v.trackQuantity ? !v.inStock || v.quantity === 0 : !v.inStock;
        if (!isOos) {
          for (const [k, val] of Object.entries(v.choices)) {
            inStockChoices.add(`${k}:${val}`);
          }
        }
      }
    }

    const defaults: Record<string, string> = {};
    for (const option of productOptions) {
      if (!option.name || !option.choices?.length) continue;
      // Pick first in-stock choice, fall back to first choice
      const firstInStock = manageVariants
        ? option.choices.find((c) => {
            const label = c.description || c.value || "";
            return inStockChoices.has(`${option.name}:${label}`);
          })
        : null;
      const c = firstInStock ?? option.choices[0];
      if (c) defaults[option.name] = c.description || c.value || "";
    }
    return defaults;
  });

  // Build variant stock + ID lookup keyed by sorted option string
  const { stockMap, variantIdMap } = useMemo(() => {
    const sMap = new Map<string, { inStock: boolean; quantity: number; trackQuantity: boolean }>();
    const idMap = new Map<string, string>();
    for (const v of variants) {
      const key = buildStockKey(v.choices);
      if (key) {
        sMap.set(key, { inStock: v.inStock, quantity: v.quantity, trackQuantity: v.trackQuantity });
        if (v.variantId) idMap.set(key, v.variantId);
      }
    }
    return { stockMap: sMap, variantIdMap: idMap };
  }, [variants]);

  function resolveInStock(stock: { inStock: boolean; quantity: number; trackQuantity: boolean }): boolean {
    // When quantity is tracked and is 0, treat as out of stock even if inStock flag says true
    if (stock.trackQuantity && stock.quantity === 0) return false;
    return stock.inStock;
  }

  // Check stock for a specific choice within current selection
  function isChoiceInStock(optionName: string, choiceLabel: string): { inStock: boolean; quantity: number } | null {
    if (stockMap.size === 0) return null; // no variant data
    const testOptions = { ...selectedOptions, [optionName]: choiceLabel };
    const key = buildStockKey(testOptions);
    const stock = stockMap.get(key);
    if (!stock) return null;
    return { inStock: resolveInStock(stock), quantity: stock.quantity };
  }

  // Current selected variant stock
  const selectedStock = useMemo(() => {
    if (stockMap.size === 0) return null;
    const key = buildStockKey(selectedOptions);
    const stock = stockMap.get(key);
    if (!stock) return null;
    return { inStock: resolveInStock(stock), quantity: stock.quantity };
  }, [stockMap, selectedOptions]);

  // Look up actual variant ID for the selected options
  const selectedVariantId = useMemo(() => {
    const key = buildStockKey(selectedOptions);
    return variantIdMap.get(key) ?? undefined;
  }, [variantIdMap, selectedOptions]);

  const isOutOfStock = !productInStock || (manageVariants && selectedStock !== null && !selectedStock.inStock);

  // Low stock: use variant stock for real variants, product-level stock for standalone
  // Only show when inventory is tracked (untracked products have unreliable quantity)
  const lowStockQty = manageVariants
    ? (selectedStock && selectedStock.inStock && selectedStock.quantity >= 1 && selectedStock.quantity <= 5 ? selectedStock.quantity : null)
    : (trackInventory && productInStock && productQuantity !== undefined && productQuantity >= 1 && productQuantity <= 5 ? productQuantity : null);

  return (
    <>
      {/* Variant/size selector */}
      {productOptions.length > 0 && (
        <div className="mt-10 space-y-6">
          {productOptions.map((option) => (
            <div key={option.name}>
              <label className="block text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface mb-3">
                {option.name}
              </label>
              {option.choices?.[0]?.value && /^(#|rgb)/.test(option.choices[0].value) ? (
                /* Color option — swatch squares */
                <div>
                  <div className="flex gap-2">
                    {option.choices?.map((choice) => {
                      const label = choice.description || choice.value || "";
                      const isSelected = selectedOptions[option.name ?? ""] === label;
                      const stock = manageVariants ? isChoiceInStock(option.name ?? "", label) : null;
                      const oos = stock !== null && !stock.inStock;

                      return (
                        <button
                          key={choice.value}
                          onClick={() => {
                            setSelectedOptions((prev) => ({
                              ...prev,
                              [option.name ?? ""]: label,
                            }));
                            trackAnalytics("variant_select", {
                              product_id: productId,
                              option_name: option.name ?? "",
                              option_value: label,
                            });
                          }}
                          className={`relative w-10 h-10 transition-colors ${
                            oos
                              ? isSelected
                                ? "opacity-50 ring-2 ring-on-surface ring-offset-2 ring-offset-surface"
                                : "opacity-25"
                              : isSelected
                                ? "ring-2 ring-on-surface ring-offset-2 ring-offset-surface"
                                : "border border-outline-variant/20 hover:border-outline"
                          }`}
                          style={{ backgroundColor: choice.value ?? undefined }}
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
                  <p className="mt-2 text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
                    {selectedOptions[option.name ?? ""] ?? ""}
                  </p>
                </div>
              ) : (
                /* Non-color option (Size, etc.) — text chips */
                <div className="grid grid-cols-4 gap-2">
                  {option.choices?.map((choice) => {
                    const label = choice.description || choice.value || "";
                    const isSelected = selectedOptions[option.name ?? ""] === label;
                    const stock = manageVariants ? isChoiceInStock(option.name ?? "", label) : null;
                    const oos = stock !== null && !stock.inStock;

                    return (
                      <button
                        key={choice.value}
                        onClick={() => {
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [option.name ?? ""]: label,
                          }));
                          trackAnalytics("variant_select", {
                            product_id: productId,
                            option_name: option.name ?? "",
                            option_value: label,
                          });
                        }}
                        className={`h-14 text-xs tracking-[0.15em] uppercase font-medium transition-colors border border-outline-variant/20 ${
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
          ))}

        </div>
      )}

      {/* Low stock warning — always visible above Add to Bag */}
      {lowStockQty !== null && (
        <p className="mt-6 text-[11px] tracking-[0.15em] text-secondary font-medium">
          Only {lowStockQty} left in stock
        </p>
      )}

      {/* Add to Bag / Notify Me */}
      <div className="mt-4">
        {isOutOfStock ? (
          <NotifyMeForm productId={productId} productName={productName ?? ""} productPrice={productPrice ?? "0"} />
        ) : (
          <>
            <AddToCartButton
              productId={productId}
              productName={productName}
              productPrice={productPrice}
              manageVariants={manageVariants}
              selectedOptions={selectedOptions}
              variantId={selectedVariantId}
            />
            <ExpressCheckout
              productId={productId}
              productName={productName}
              productPrice={productPrice ?? "0"}
              selectedOptions={selectedOptions}
              variantId={selectedVariantId}
              manageVariants={manageVariants}
            />
            <PayPalCheckout
              productId={productId}
              productName={productName}
              productPrice={productPrice ?? "0"}
              selectedOptions={selectedOptions}
              variantId={selectedVariantId}
              manageVariants={manageVariants}
            />
          </>
        )}
      </div>

      {/* Add to Wishlist */}
      <WishlistButton productId={productId} />
    </>
  );
}

const WIX_STORES_V1_APP_ID = "1380b703-ce81-ff05-f115-39571d94dfcd";

function NotifyMeForm({ productId, productName, productPrice }: { productId: string; productName: string; productPrice: string }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Prepopulate email from logged-in member
  const [emailLoaded, setEmailLoaded] = useState(false);
  if (!emailLoaded) {
    setEmailLoaded(true);
    getBrowserWixClient().members.getCurrentMember({ fieldsets: ["FULL"] })
      .then((response: unknown) => {
        const res = response as { member?: Record<string, unknown> } & Record<string, unknown>;
        const member = (res.member ?? res) as { loginEmail?: string; contact?: { emails?: string[] } };
        const memberEmail = member.loginEmail ?? member.contact?.emails?.[0];
        if (memberEmail) setEmail(memberEmail);
      })
      .catch(() => {});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      await wix.backInStockNotifications.createBackInStockNotificationRequest(
        {
          catalogReference: {
            appId: WIX_STORES_V1_APP_ID,
            catalogItemId: productId,
          },
          email: email.trim(),
        },
        {
          name: productName,
          price: productPrice,
        }
      );

      setSubmitted(true);
    } catch (err: unknown) {
      const errorCode = (err as { details?: { applicationError?: { code?: string } } })
        ?.details?.applicationError?.code;
      if (errorCode === "BACK_IN_STOCK_NOTIFICATION_REQUEST_ALREADY_EXISTS") {
        // Already subscribed — treat as success
        setSubmitted(true);
      } else {
        console.error("Failed to create notification request:", err);
        showToast("Unable to submit notification request. Please try again.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-5">
        <p className="text-[11px] tracking-[0.15em] uppercase font-medium text-secondary">
          Sold Out
        </p>
        <p className="mt-2 text-[11px] tracking-[0.15em] text-on-surface-variant">
          We&apos;ll notify you when this item is back in stock
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] tracking-[0.15em] uppercase font-medium text-secondary mb-3">
        Sold Out
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          className="flex-1 px-4 py-3.5 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3.5 bg-on-surface text-on-primary text-[10px] tracking-[0.2em] uppercase font-bold transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? "..." : "Notify Me"}
        </button>
      </form>
    </div>
  );
}
