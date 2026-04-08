"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import { getWixImageUrl } from "@/lib/wix-image";
import {
  getWishlistIds,
  removeFromWishlist,
} from "@/lib/wishlist";
import { getRecentlyViewedIds } from "@/lib/recently-viewed";
import { getProductsByIds, type WishlistProduct } from "./actions";
import type { cart } from "@wix/ecom";
import LoadingIndicator from "@/components/LoadingIndicator";
import FreeShippingBar from "@/components/FreeShippingBar";
import { showToast } from "@/lib/toast";
import { addItemToCart, buildStockKey } from "@/lib/cart";
import { useDisplayCurrency } from "@/components/Price";
import { trackMetaEvent } from "@/lib/meta-track";
import { trackAnalytics } from "@/lib/analytics";
import { clarityEvent, clarityTag } from "@/lib/clarity";

type Cart = cart.Cart;
type LineItem = cart.LineItem;

export default function CartPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "wishlist" ? "wishlist" : tabParam === "recent" ? "recent" : "bag";
  const [activeTab, setActiveTab] = useState<"bag" | "wishlist" | "recent">(initialTab);

  return (
    <div className="px-6 pt-12 lg:px-10 xl:max-w-7xl xl:mx-auto">
      <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
        Your Bag
      </h1>
      <div className="mt-3 w-12 h-[2px] bg-secondary" />

      {/* Tabs */}
      <div className="mt-8 flex gap-8">
        <button
          onClick={() => { setActiveTab("bag"); trackAnalytics("cart_tab_switch", { tab: "bag" }); }}
          className={`pb-2 text-[10px] tracking-[0.25em] uppercase font-medium transition-colors ${
            activeTab === "bag"
              ? "text-on-surface border-b-2 border-on-surface"
              : "text-on-surface-variant"
          }`}
        >
          Bag
        </button>
        <button
          onClick={() => { setActiveTab("wishlist"); trackAnalytics("cart_tab_switch", { tab: "wishlist" }); }}
          className={`pb-2 text-[10px] tracking-[0.25em] uppercase font-medium transition-colors ${
            activeTab === "wishlist"
              ? "text-on-surface border-b-2 border-on-surface"
              : "text-on-surface-variant"
          }`}
        >
          Wishlist
        </button>
        <button
          onClick={() => { setActiveTab("recent"); trackAnalytics("cart_tab_switch", { tab: "recent" }); }}
          className={`pb-2 text-[10px] tracking-[0.25em] uppercase font-medium transition-colors ${
            activeTab === "recent"
              ? "text-on-surface border-b-2 border-on-surface"
              : "text-on-surface-variant"
          }`}
        >
          Recently Viewed
        </button>
      </div>

      {activeTab === "bag" ? <BagTab /> : activeTab === "wishlist" ? <WishlistTab /> : <RecentlyViewedTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bag Tab                                                           */
/* ------------------------------------------------------------------ */

function BagTab() {
  const [cartData, setCartData] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingQtyId, setUpdatingQtyId] = useState<string | null>(null);
  const displayCurrency = useDisplayCurrency();
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(0);
  const [subtotalNum, setSubtotalNum] = useState(0);

  const [totals, setTotals] = useState<{
    subtotal?: string;
    shipping?: string;
    discount?: string;
    total?: string;
    discounts?: { name: string; amount: string; rawAmount: number }[];
  } | null>(null);

  const loadCart = useCallback(async () => {
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);
      const current = await wix.currentCart.getCurrentCart();
      setCartData(current);
      const cartItems = current?.lineItems ?? [];
      if (cartItems.length > 0) {
        trackAnalytics("cart_view", {
          item_count: cartItems.length,
        });
        clarityTag("items_in_cart", cartItems.length);
      }

      // Estimate totals for the summary
      try {
        const est = await wix.currentCart.estimateCurrentCartTotals({});
        // Aggregate discounts by name (same rule applied to multiple items)
        const discountTotals = new Map<string, number>();
        let currencyPrefix = "";

        for (const d of (est.appliedDiscounts ?? []) as Record<string, unknown>[]) {
          const rule = d.discountRule as { name?: { original?: string }; amount?: { amount?: string; formattedAmount?: string } } | undefined;
          const coupon = d.coupon as { name?: string; amount?: { amount?: string; formattedAmount?: string } } | undefined;
          const name = rule?.name?.original ?? coupon?.name ?? "Discount";
          const rawAmount = parseFloat(rule?.amount?.amount ?? coupon?.amount?.amount ?? "0");

          if (!currencyPrefix && (rule?.amount?.formattedAmount || coupon?.amount?.formattedAmount)) {
            const formatted = rule?.amount?.formattedAmount ?? coupon?.amount?.formattedAmount ?? "";
            currencyPrefix = formatted.replace(/[\d.,]+/g, "").trim();
          }

          discountTotals.set(name, (discountTotals.get(name) ?? 0) + rawAmount);
        }

        const discountList = [...discountTotals.entries()]
          .filter(([, amount]) => amount > 0)
          .map(([name, amount]) => ({
            name,
            amount: `${currencyPrefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            rawAmount: amount,
          }));

        const ps = est.priceSummary as {
          subtotal?: { amount?: string; formattedAmount?: string };
          shipping?: { amount?: string; formattedAmount?: string };
          discount?: { amount?: string; formattedAmount?: string };
          total?: { amount?: string; formattedAmount?: string };
        } | undefined;

        // Compute discounted total if API total doesn't reflect discounts
        const parsedSubtotal = parseFloat(ps?.subtotal?.amount ?? "0");
        setSubtotalNum(parsedSubtotal);
        clarityTag("cart_value", parsedSubtotal);
        const subtotalNum = parsedSubtotal;
        const totalDiscountNum = [...discountTotals.values()].reduce((a, b) => a + b, 0);
        const apiTotal = parseFloat(ps?.total?.amount ?? "0");

        // If API total equals subtotal but we have discounts, compute it ourselves
        const computedTotal = totalDiscountNum > 0 && Math.abs(apiTotal - subtotalNum) < 0.01
          ? subtotalNum - totalDiscountNum
          : apiTotal;

        const totalFormatted = computedTotal !== apiTotal
          ? `${currencyPrefix}${computedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : ps?.total?.formattedAmount;

        const shippingAmount = parseFloat(ps?.shipping?.amount ?? "0");

        setTotals({
          subtotal: ps?.subtotal?.formattedAmount,
          shipping: shippingAmount > 0 ? ps?.shipping?.formattedAmount : undefined,
          discount: ps?.discount?.formattedAmount,
          total: totalFormatted,
          discounts: discountList,
        });
      } catch {
        // Totals estimation may not be available — continue without
      }
    } catch (error: unknown) {
      const isNoCart =
        error instanceof Object &&
        "details" in error &&
        (error as { details?: { applicationError?: { code?: string } } })
          .details?.applicationError?.code === "OWNED_CART_NOT_FOUND";
      if (!isNoCart) {
        console.error("Failed to load cart:", error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart();
    // Load region-specific free shipping threshold
    Promise.all([
      import("@/app/actions").then((m) => m.getShippingRegions()),
      import("@/lib/shipping-regions"),
    ]).then(([data, { getRegionForCountry }]) => {
      const countryCode = localStorage.getItem("shipping_country") || "HK";
      const region = getRegionForCountry(countryCode, data);
      setFreeShippingThreshold(region.freeThreshold);
    });

    // Refresh when items are added from wishlist (or elsewhere)
    const handler = () => loadCart();
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, [loadCart]);

  async function removeItem(lineItemId: string) {
    setRemovingId(lineItemId);
    const item = cartData?.lineItems?.find((i) => i._id === lineItemId);
    trackAnalytics("cart_remove_item", {
      product_name: item?.productName?.original ?? "",
      quantity: item?.quantity ?? 1,
    });
    try {
      const wix = getBrowserWixClient();
      await wix.currentCart.removeLineItemsFromCurrentCart([lineItemId]);
      window.dispatchEvent(new Event("cart-updated"));
    } catch (error) {
      console.error("Failed to remove item:", error);
      setRemovingId(null);
    }
  }

  const [stockMessage, setStockMessage] = useState<string | null>(null);

  async function updateQuantity(lineItemId: string, newQuantity: number) {
    if (newQuantity < 1) {
      removeItem(lineItemId);
      return;
    }
    setUpdatingQtyId(lineItemId);
    setStockMessage(null);
    const qtyItem = cartData?.lineItems?.find((i) => i._id === lineItemId);
    trackAnalytics("cart_update_quantity", {
      product_name: qtyItem?.productName?.original ?? "",
      new_quantity: newQuantity,
      direction: newQuantity > (qtyItem?.quantity ?? 1) ? "increase" : "decrease",
    });
    try {
      const wix = getBrowserWixClient();
      const result = await wix.currentCart.updateCurrentCartLineItemQuantity([
        { _id: lineItemId, quantity: newQuantity },
      ]);

      // Check if Wix capped the quantity due to stock limits
      const updatedItem = result.cart?.lineItems?.find(
        (li: { _id?: string }) => li._id === lineItemId
      );
      const actualQty = updatedItem?.quantity ?? newQuantity;
      if (actualQty < newQuantity) {
        setStockMessage(
          actualQty === 1
            ? "Only 1 item left in stock"
            : `Only ${actualQty} items left in stock`
        );
        setTimeout(() => setStockMessage(null), 3000);
      }

      window.dispatchEvent(new Event("cart-updated"));
    } catch (error) {
      console.error("Failed to update quantity:", error);
    } finally {
      setUpdatingQtyId(null);
    }
  }

  const [checkingOut, setCheckingOut] = useState(false);

  async function handleCheckout() {
    setCheckingOut(true);
    trackMetaEvent("InitiateCheckout", { currency: "HKD", value: subtotalNum });
    trackAnalytics("initiate_checkout", {
      item_count: cartData?.lineItems?.length ?? 0,
      cart_total: subtotalNum,
    });
    clarityEvent("initiate_checkout");
    clarityTag("checkout_value", subtotalNum);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      const result = await wix.currentCart.createCheckoutFromCurrentCart({
        channelType: "WEB",
      });
      const checkoutId = result.checkoutId;
      if (!checkoutId) throw new Error("No checkout ID returned");

      const { redirectSession } = await wix.redirects.createRedirectSession({
        ecomCheckout: { checkoutId },
        callbacks: {
          thankYouPageUrl: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/order-confirmation`,
          postFlowUrl: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/cart`,
        },
      });

      const redirectUrl = redirectSession?.fullUrl;
      if (!redirectUrl) throw new Error("No redirect URL returned");

      // Save Meta cookies before leaving solitairec.com (different subdomain loses them)
      try {
        const cookies = document.cookie;
        const fbc = cookies.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1];
        const fbp = cookies.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1];
        if (fbc || fbp) {
          sessionStorage.setItem("meta_cookies", JSON.stringify({ fbc, fbp }));
        }
      } catch { /* ignore */ }

      window.dispatchEvent(new Event("cart-updated"));
      window.location.href = redirectUrl;
    } catch (error) {
      const { log } = await import("@/lib/logger");
      log({ level: "error", action: "checkout-failed", error });
      showToast("Unable to proceed to checkout. Please try again.", "error");
      setCheckingOut(false);
    }
  }

  if (loading) return <LoadingIndicator />;

  const items: LineItem[] = cartData?.lineItems ?? [];

  if (items.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="text-on-surface-variant text-sm mb-6">
          Your bag is empty.
        </p>
        <Link
          href="/"
          className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-0">
      {items.map((item) => {
        // item.image is an object { url, id, ... } at runtime despite SDK typing it as string
        const imageObj = item.image as unknown as { url?: string } | string | undefined;
        const imageSrc = typeof imageObj === "string"
          ? getWixImageUrl(imageObj, 200, 267)
          : imageObj?.url ?? getWixImageUrl(null, 200, 267);

        // item.url is an object { relativePath, url } — extract slug for our internal route
        const urlObj = item.url as unknown as { relativePath?: string } | string | undefined;
        const relativePath = typeof urlObj === "string" ? urlObj : urlObj?.relativePath;
        const slug = relativePath?.split("/").pop() ?? "";
        const productUrl = slug ? `/products/${slug}` : "/";
        const isRemoving = removingId === item._id;

        return (
          <div
            key={item._id}
            className={`flex gap-4 bg-surface-container-low px-4 py-4 mb-2 transition-opacity ${
              isRemoving ? "opacity-50" : ""
            }`}
          >
            {/* Product thumbnail */}
            <Link
              href={productUrl}
              className="shrink-0 w-16 h-[85px] bg-surface-container relative"
            >
              <img
                src={imageSrc}
                alt={item.productName?.original ?? "Product"}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </Link>

            {/* Details */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <Link href={productUrl}>
                  <h3 className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface truncate">
                    {item.productName?.original ?? "Product"}
                  </h3>
                </Link>

                {/* Size / Color from descriptionLines */}
                {(() => {
                  const lines = (item.descriptionLines ?? []) as {
                    name?: { original?: string };
                    plainText?: { original?: string };
                    colorInfo?: { original?: string; code?: string };
                  }[];
                  if (lines.length === 0) return null;
                  return (
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {lines.map((line, i) => {
                        const label = line.name?.original ?? "";
                        if (line.colorInfo) {
                          const colorCode = line.colorInfo.code ?? "";
                          const hasHex = /^(#|rgb)/.test(colorCode);
                          return (
                            <span key={i} className="flex items-center gap-1 text-[10px] tracking-widest text-on-surface-variant">
                              {hasHex && (
                                <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: colorCode }} />
                              )}
                              {line.colorInfo.original}
                              {i < lines.length - 1 && <span className="ml-1">·</span>}
                            </span>
                          );
                        }
                        return (
                          <span key={i} className="text-[10px] tracking-widest text-on-surface-variant">
                            {label}: {line.plainText?.original ?? ""}
                            {i < lines.length - 1 && <span className="ml-1">·</span>}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="mt-1 flex items-center gap-0">
                  <button
                    onClick={() => updateQuantity(item._id ?? "", (item.quantity ?? 1) - 1)}
                    disabled={updatingQtyId === item._id}
                    className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">remove</span>
                  </button>
                  <span className="w-6 text-center text-[10px] tracking-widest text-on-surface-variant font-medium">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item._id ?? "", (item.quantity ?? 1) + 1)}
                    disabled={updatingQtyId === item._id}
                    className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                  </button>
                </div>

                {/* Price — show line total when qty > 1, in display currency */}
                {(() => {
                  const fullAmount = parseFloat(item.fullPrice?.amount ?? "0");
                  const unitAmount = parseFloat(item.price?.amount ?? "0");
                  const isDiscounted = fullAmount > 0 && unitAmount > 0 && fullAmount !== unitAmount;
                  const qty = item.quantity ?? 1;
                  const lineTotalAmount = unitAmount * qty;

                  return (
                    <div className="mt-1 flex items-center gap-2">
                      {isDiscounted && (
                        <span className="text-[10px] tracking-widest text-on-surface-variant line-through">
                          {displayCurrency.format(fullAmount)}
                        </span>
                      )}
                      <span className={`text-[10px] tracking-widest ${isDiscounted ? "text-secondary font-medium" : "text-on-surface-variant"}`}>
                        {qty > 1 ? displayCurrency.format(lineTotalAmount) : displayCurrency.format(unitAmount)}
                      </span>
                      {qty > 1 && (
                        <span className="text-[10px] tracking-widest text-on-surface-variant/60">
                          ({displayCurrency.format(unitAmount)} each)
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="mt-2">
                <button
                  onClick={() => removeItem(item._id ?? "")}
                  className="text-[10px] tracking-[0.15em] uppercase text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Stock limit message */}
      {stockMessage && (
        <p className="text-[10px] tracking-[0.15em] uppercase text-secondary font-medium text-center py-2">
          {stockMessage}
        </p>
      )}

      {/* Free shipping progress */}
      {freeShippingThreshold > 0 && (
        <FreeShippingBar subtotal={subtotalNum} threshold={freeShippingThreshold} />
      )}

      {/* Cart summary */}
      {totals && (() => {
        const isConverted = displayCurrency.isConverted;
        const totalAmount = parseFloat(
          (totals.total ?? "").replace(/[^0-9.]/g, "") || "0"
        );

        return (
        <div className="pt-8 space-y-2">
          <div className="flex justify-between">
            <span className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
              Subtotal
            </span>
            <span className="text-[10px] tracking-widest text-on-surface">
              {isConverted ? displayCurrency.format(subtotalNum) : totals.subtotal}
            </span>
          </div>

          {totals.discounts?.map((d, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-[10px] tracking-widest text-secondary">
                {d.name}
              </span>
              <span className="text-[10px] tracking-widest text-secondary">
                -{isConverted ? displayCurrency.format(d.rawAmount) : d.amount}
              </span>
            </div>
          ))}

          <div className="flex justify-between">
            <span className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
              {totals.shipping || (freeShippingThreshold > 0 && subtotalNum > freeShippingThreshold) ? "Est. Shipping" : "Shipping"}
            </span>
            <span className="text-[10px] tracking-widest text-on-surface-variant">
              {freeShippingThreshold > 0 && subtotalNum > freeShippingThreshold
                ? <span className="text-secondary font-medium">Free</span>
                : totals.shipping
                  ? isConverted
                    ? displayCurrency.format(parseFloat(totals.shipping.replace(/[^0-9.]/g, "") || "0"))
                    : totals.shipping
                  : "Calculated at checkout"}
            </span>
          </div>

          <div className="flex justify-between pt-3 border-t border-outline-variant/20">
            <span className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface">
              Total
            </span>
            <div className="text-right">
              <span className="text-xs tracking-widest font-medium text-on-surface block">
                {isConverted ? displayCurrency.format(totalAmount) : totals.total}
              </span>
              {isConverted && (
                <span className="text-[10px] tracking-widest text-on-surface-variant block mt-0.5">
                  {totals.total}
                </span>
              )}
            </div>
          </div>

          {isConverted && (
            <p className="text-[9px] tracking-wide text-on-surface-variant/60 text-right pt-1">
              Approximate conversion. Billed in HKD.
            </p>
          )}
        </div>
        );
      })()}

      <div className="pt-6">
        <button
          onClick={handleCheckout}
          disabled={checkingOut}
          className="w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {checkingOut ? "Opening Checkout…" : "Proceed to Checkout"}
        </button>
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface-variant underline underline-offset-4 hover:text-on-surface transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wishlist Tab                                                      */
/* ------------------------------------------------------------------ */

function WishlistTab() {
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const loadWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const ids = getWishlistIds();
      if (ids.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      const fetched = await getProductsByIds(ids);
      const productMap = new Map(fetched.map((p) => [p._id, p]));
      setProducts(ids.map((id) => productMap.get(id)).filter(Boolean) as WishlistProduct[]);
    } catch (err) {
      console.error("Failed to load wishlist products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWishlist();

    const handler = () => loadWishlist();
    window.addEventListener("wishlist-updated", handler);
    return () => window.removeEventListener("wishlist-updated", handler);
  }, [loadWishlist]);

  function handleAddToBagClick(product: WishlistProduct) {
    if (product.productOptions.length === 0) {
      confirmAddToBag(product, {});
      return;
    }
    // Expand to show size selector, pre-select first in-stock option
    const inStockKeys = new Set(
      product.variants.filter((v) => v.inStock).map((v) => v.key)
    );

    const defaults: Record<string, string> = {};
    for (const opt of product.productOptions) {
      const firstInStock = product.manageVariants
        ? opt.choices.find((c) => {
            const label = c.description || c.value;
            const testOpts = { ...defaults, [opt.name]: label };
            return inStockKeys.has(buildStockKey(testOpts));
          })
        : null;
      const c = firstInStock ?? opt.choices[0];
      if (c) defaults[opt.name] = c.description || c.value;
    }
    setSelectedOptions(defaults);
    setExpandedId(product._id);
  }

  async function confirmAddToBag(
    product: WishlistProduct,
    opts: Record<string, string>
  ) {
    setAddingId(product._id);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      // Look up real variant ID from product variant data
      let resolvedVariantId: string | undefined;
      if (product.manageVariants && product.variants.length > 0 && Object.keys(opts).length > 0) {
        const key = buildStockKey(opts);
        const match = product.variants.find((v) => v.key === key);
        if (match?.variantId) resolvedVariantId = match.variantId;
      }

      const result = await addItemToCart(wix, {
        productId: product._id,
        productName: product.name,
        manageVariants: product.manageVariants,
        selectedOptions: opts,
        variantId: resolvedVariantId,
      });

      if (!result.success) {
        showToast(result.error ?? "This item couldn't be added to your bag.", "error");
        setAddingId(null);
        return;
      }

      window.dispatchEvent(new Event("cart-updated"));

      // Show success state before removing
      setAddingId(null);
      setAddedId(product._id);
      setExpandedId(null);

      setTimeout(() => {
        removeFromWishlist(product._id);
        setAddedId(null);
      }, 1000);
    } catch (error) {
      const { log } = await import("@/lib/logger");
      log({ level: "error", action: "wishlist-add-to-bag-failed", details: { productId: product._id }, error });
      setAddingId(null);
      showToast("This item couldn't be added to your bag. It may be out of stock.", "error");
    }
  }

  if (loading) return <LoadingIndicator />;

  if (products.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="text-sm leading-relaxed text-on-surface-variant mb-6">
          Your wishlist is empty.
        </p>
        <Link
          href="/"
          className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4"
        >
          Browse Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-secondary mb-6">
        {products.length} {products.length === 1 ? "item" : "items"} saved
      </p>

      {products.map((product) => {
        const isExpanded = expandedId === product._id;
        const isAdding = addingId === product._id;
        const isAdded = addedId === product._id;

        const isSoldOut = !product.inStock;

        return (
          <div
            key={product._id}
            className={`bg-surface-container-low px-4 py-4 mb-2 transition-opacity ${
              isAdded ? "opacity-50" : ""
            }`}
          >
            <div className={`flex gap-4 ${isSoldOut ? "opacity-40" : ""}`}>
              {/* Product thumbnail */}
              <Link
                href={`/products/${product.slug}`}
                className="shrink-0 w-16 h-[85px] bg-surface-container relative"
              >
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </Link>

              {/* Details */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <Link href={`/products/${product.slug}`}>
                    <h3 className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface truncate">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
                    {product.price}
                  </p>
                </div>

                <div className="flex gap-4 mt-2">
                  {isSoldOut ? (
                    <span className="text-[10px] tracking-[0.15em] uppercase font-medium text-secondary">
                      Sold Out
                    </span>
                  ) : (
                    !isExpanded && (
                      <button
                        onClick={() => handleAddToBagClick(product)}
                        disabled={isAdding || isAdded}
                        className="text-[10px] tracking-[0.15em] uppercase font-medium text-on-surface hover:text-secondary transition-colors disabled:opacity-50"
                      >
                        {isAdding
                          ? "Adding..."
                          : isAdded
                            ? "Added \u2713"
                            : "Add to Bag"}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => removeFromWishlist(product._id)}
                    className="text-[10px] tracking-[0.15em] uppercase text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>

            {/* Inline variant selector — expanded state */}
            {isExpanded && (() => {
              // Stock check helper using product.variants
              function isChoiceOos(optName: string, choiceLabel: string): boolean {
                if (!product.manageVariants || product.variants.length === 0) return false;
                const testOpts = { ...selectedOptions, [optName]: choiceLabel };
                const match = product.variants.find((v) => v.key === buildStockKey(testOpts));
                return match ? !match.inStock : false;
              }

              return (
              <div className="mt-4 pt-4 border-t border-outline-variant/20">
                {product.productOptions.map((option) => (
                  <div key={option.name} className="mb-4">
                    <label className="block text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface mb-2">
                      {option.name}
                    </label>
                    {option.choices[0]?.value && /^(#|rgb)/.test(option.choices[0].value) ? (
                      <div>
                        <div className="flex gap-2">
                          {option.choices.map((choice) => {
                            const label = choice.description || choice.value;
                            const isSelected = selectedOptions[option.name] === label;
                            const oos = isChoiceOos(option.name, label);
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
                                      ? "opacity-50 ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container-low"
                                      : "opacity-25"
                                    : isSelected
                                      ? "ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container-low"
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
                        <p className="mt-1.5 text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
                          {selectedOptions[option.name] ?? ""}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {option.choices.map((choice) => {
                          const label = choice.description || choice.value;
                          const isSelected = selectedOptions[option.name] === label;
                          const oos = isChoiceOos(option.name, label);
                          return (
                            <button
                              key={choice.value}
                              onClick={() =>
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [option.name]: label,
                                }))
                              }
                              className={`h-10 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors border border-outline-variant/20 ${
                                oos
                                  ? isSelected
                                    ? "opacity-50 line-through bg-on-surface text-on-primary"
                                    : "opacity-30 line-through"
                                  : isSelected
                                    ? "bg-on-surface text-on-primary"
                                    : "bg-transparent text-on-surface hover:bg-surface-container"
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

                <button
                  onClick={() => confirmAddToBag(product, selectedOptions)}
                  disabled={isAdding}
                  className="w-full bg-on-surface text-on-primary py-4 text-[10px] tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  {isAdding ? "Adding..." : "Add to Bag"}
                </button>
              </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recently Viewed Tab                                               */
/* ------------------------------------------------------------------ */

function RecentlyViewedTab() {
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const ids = getRecentlyViewedIds();
        if (ids.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }
        const fetched = await getProductsByIds(ids);
        const productMap = new Map(fetched.map((p) => [p._id, p]));
        setProducts(
          ids.map((id) => productMap.get(id)).filter(Boolean) as WishlistProduct[]
        );
      } catch (err) {
        console.error("Failed to load recently viewed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleAddToBagClick(product: WishlistProduct) {
    if (product.productOptions.length === 0) {
      confirmAddToBag(product, {});
      return;
    }
    const inStockKeys = new Set(
      product.variants.filter((v) => v.inStock).map((v) => v.key)
    );
    const defaults: Record<string, string> = {};
    for (const opt of product.productOptions) {
      const firstInStock = product.manageVariants
        ? opt.choices.find((c) => {
            const label = c.description || c.value;
            const testOpts = { ...defaults, [opt.name]: label };
            return inStockKeys.has(buildStockKey(testOpts));
          })
        : null;
      const c = firstInStock ?? opt.choices[0];
      if (c) defaults[opt.name] = c.description || c.value;
    }
    setSelectedOptions(defaults);
    setExpandedId(product._id);
  }

  async function confirmAddToBag(
    product: WishlistProduct,
    opts: Record<string, string>
  ) {
    setAddingId(product._id);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      let resolvedVariantId: string | undefined;
      if (product.manageVariants && product.variants.length > 0 && Object.keys(opts).length > 0) {
        const key = buildStockKey(opts);
        const match = product.variants.find((v) => v.key === key);
        if (match?.variantId) resolvedVariantId = match.variantId;
      }

      const result = await addItemToCart(wix, {
        productId: product._id,
        productName: product.name,
        manageVariants: product.manageVariants,
        selectedOptions: opts,
        variantId: resolvedVariantId,
      });

      if (!result.success) {
        showToast(result.error ?? "This item couldn't be added to your bag.", "error");
        setAddingId(null);
        return;
      }

      window.dispatchEvent(new Event("cart-updated"));
      setAddingId(null);
      setAddedId(product._id);
      setExpandedId(null);
      setTimeout(() => setAddedId(null), 2000);
    } catch {
      setAddingId(null);
      showToast("This item couldn't be added to your bag. It may be out of stock.", "error");
    }
  }

  if (loading) return <LoadingIndicator />;

  if (products.length === 0) {
    return (
      <div className="pt-16 text-center">
        <span className="material-symbols-outlined text-[40px] text-outline-variant">
          history
        </span>
        <p className="mt-4 text-sm text-on-surface-variant">
          No recently viewed items yet.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-[10px] tracking-[0.15em] uppercase font-medium text-secondary underline underline-offset-4"
        >
          Start Browsing
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-secondary mb-6">
        {products.length} recently viewed
      </p>

      {products.map((product) => {
        const isExpanded = expandedId === product._id;
        const isAdding = addingId === product._id;
        const isAdded = addedId === product._id;
        const isSoldOut = !product.inStock;

        return (
          <div
            key={product._id}
            className="bg-surface-container-low px-4 py-4 mb-2"
          >
            <div className={`flex gap-4 ${isSoldOut ? "opacity-40" : ""}`}>
              <Link
                href={`/products/${product.slug}`}
                className="shrink-0 w-16 h-[85px] bg-surface-container relative"
              >
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </Link>

              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <Link href={`/products/${product.slug}`}>
                    <h3 className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface truncate">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
                    {product.price}
                  </p>
                </div>

                <div className="flex gap-4 mt-2">
                  {isSoldOut ? (
                    <span className="text-[10px] tracking-[0.15em] uppercase font-medium text-secondary">
                      Sold Out
                    </span>
                  ) : (
                    !isExpanded && (
                      <button
                        onClick={() => handleAddToBagClick(product)}
                        disabled={isAdding || isAdded}
                        className="text-[10px] tracking-[0.15em] uppercase font-medium text-on-surface hover:text-secondary transition-colors disabled:opacity-50"
                      >
                        {isAdding
                          ? "Adding..."
                          : isAdded
                            ? "Added \u2713"
                            : "Add to Bag"}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Inline variant selector */}
            {isExpanded && (() => {
              function isChoiceOos(optName: string, choiceLabel: string): boolean {
                if (!product.manageVariants || product.variants.length === 0) return false;
                const testOpts = { ...selectedOptions, [optName]: choiceLabel };
                const match = product.variants.find((v) => v.key === buildStockKey(testOpts));
                return match ? !match.inStock : false;
              }

              return (
              <div className="mt-4 pt-4 border-t border-outline-variant/20">
                {product.productOptions.map((option) => (
                  <div key={option.name} className="mb-4">
                    <label className="block text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface mb-2">
                      {option.name}
                    </label>
                    {option.choices[0]?.value && /^(#|rgb)/.test(option.choices[0].value) ? (
                      <div>
                        <div className="flex gap-2">
                          {option.choices.map((choice) => {
                            const label = choice.description || choice.value;
                            const isSelected = selectedOptions[option.name] === label;
                            const oos = isChoiceOos(option.name, label);
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
                                      ? "opacity-50 ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container-low"
                                      : "opacity-25"
                                    : isSelected
                                      ? "ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container-low"
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
                        <p className="mt-1.5 text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
                          {selectedOptions[option.name] ?? ""}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {option.choices.map((choice) => {
                          const label = choice.description || choice.value;
                          const isSelected = selectedOptions[option.name] === label;
                          const oos = isChoiceOos(option.name, label);
                          return (
                            <button
                              key={choice.value}
                              onClick={() =>
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [option.name]: label,
                                }))
                              }
                              className={`h-10 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors border border-outline-variant/20 ${
                                oos
                                  ? isSelected
                                    ? "opacity-50 line-through bg-on-surface text-on-primary"
                                    : "opacity-30 line-through"
                                  : isSelected
                                    ? "bg-on-surface text-on-primary"
                                    : "bg-transparent text-on-surface hover:bg-surface-container"
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

                <button
                  onClick={() => confirmAddToBag(product, selectedOptions)}
                  disabled={isAdding}
                  className="w-full bg-on-surface text-on-primary py-4 text-[10px] tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  {isAdding ? "Adding..." : "Add to Bag"}
                </button>
              </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
