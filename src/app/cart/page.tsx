"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import { getWixImageUrl } from "@/lib/wix-image";
import {
  getWishlistIds,
  removeFromWishlist,
} from "@/lib/wishlist";
import { getProductsByIds, type WishlistProduct } from "./actions";
import type { cart } from "@wix/ecom";
import LoadingIndicator from "@/components/LoadingIndicator";
import FreeShippingBar from "@/components/FreeShippingBar";

type Cart = cart.Cart;
type LineItem = cart.LineItem;

// Catalog V1 (products without variants)
const WIX_STORES_APP_ID = "1380b703-ce81-ff05-f115-39571d94dfcd";
// Catalog V3 (products with variant options like size/color)
const WIX_STORES_V3_APP_ID = "215238eb-22a5-4c36-9e7b-e7c08025e04e";

export default function CartPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "wishlist" ? "wishlist" : "bag";
  const [activeTab, setActiveTab] = useState<"bag" | "wishlist">(initialTab);

  return (
    <div className="px-6 pt-12">
      <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
        Your Bag
      </h1>
      <div className="mt-3 w-12 h-[2px] bg-secondary" />

      {/* Tabs */}
      <div className="mt-8 flex gap-8">
        <button
          onClick={() => setActiveTab("bag")}
          className={`pb-2 text-[10px] tracking-[0.25em] uppercase font-medium transition-colors ${
            activeTab === "bag"
              ? "text-on-surface border-b-2 border-on-surface"
              : "text-on-surface-variant"
          }`}
        >
          Bag
        </button>
        <button
          onClick={() => setActiveTab("wishlist")}
          className={`pb-2 text-[10px] tracking-[0.25em] uppercase font-medium transition-colors ${
            activeTab === "wishlist"
              ? "text-on-surface border-b-2 border-on-surface"
              : "text-on-surface-variant"
          }`}
        >
          Wishlist
        </button>
      </div>

      {activeTab === "bag" ? <BagTab /> : <WishlistTab />}
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
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(0);
  const [subtotalNum, setSubtotalNum] = useState(0);

  const [totals, setTotals] = useState<{
    subtotal?: string;
    shipping?: string;
    discount?: string;
    total?: string;
    discounts?: { name: string; amount: string }[];
  } | null>(null);

  const loadCart = useCallback(async () => {
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);
      const current = await wix.currentCart.getCurrentCart();
      setCartData(current);

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
    import("@/app/actions").then(({ getFreeShippingThreshold }) =>
      getFreeShippingThreshold().then(setFreeShippingThreshold)
    );

    // Refresh when items are added from wishlist (or elsewhere)
    const handler = () => loadCart();
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, [loadCart]);

  async function removeItem(lineItemId: string) {
    setRemovingId(lineItemId);
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
          thankYouPageUrl: `${window.location.origin}/order-confirmation`,
          postFlowUrl: `${window.location.origin}/cart`,
        },
      });

      const redirectUrl = redirectSession?.fullUrl;
      if (!redirectUrl) throw new Error("No redirect URL returned");

      window.dispatchEvent(new Event("cart-updated"));
      window.location.href = redirectUrl;
    } catch (error) {
      console.error("Failed to start checkout:", error);
      alert("Failed to proceed to checkout. Please try again.");
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
              <Image
                src={imageSrc}
                alt={item.productName?.original ?? "Product"}
                fill
                sizes="64px"
                className="object-cover"
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

                {/* Price — show line total when qty > 1 */}
                {(() => {
                  const full = item.fullPrice?.formattedAmount;
                  const unitPrice = item.price?.formattedAmount;
                  const unitAmount = parseFloat(item.price?.amount ?? "0");
                  const isDiscounted = full && unitPrice && full !== unitPrice;
                  const qty = item.quantity ?? 1;

                  // Extract currency prefix from formatted price
                  const prefix = unitPrice?.replace(/[\d.,]+/g, "").trim() ?? "";
                  const lineTotal = qty > 1
                    ? `${prefix}${(unitAmount * qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : null;

                  return (
                    <div className="mt-1 flex items-center gap-2">
                      {isDiscounted && (
                        <span className="text-[10px] tracking-widest text-on-surface-variant line-through">
                          {full}
                        </span>
                      )}
                      <span className={`text-[10px] tracking-widest ${isDiscounted ? "text-secondary font-medium" : "text-on-surface-variant"}`}>
                        {lineTotal ?? unitPrice ?? ""}
                      </span>
                      {qty > 1 && (
                        <span className="text-[10px] tracking-widest text-on-surface-variant/60">
                          ({unitPrice} each)
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
      {totals && (
        <div className="pt-8 space-y-2">
          <div className="flex justify-between">
            <span className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
              Subtotal
            </span>
            <span className="text-[10px] tracking-widest text-on-surface">
              {totals.subtotal ?? ""}
            </span>
          </div>

          {totals.discounts?.map((d, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-[10px] tracking-widest text-secondary">
                {d.name}
              </span>
              <span className="text-[10px] tracking-widest text-secondary">
                -{d.amount}
              </span>
            </div>
          ))}

          <div className="flex justify-between">
            <span className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
              {totals.shipping ? "Est. Shipping" : "Shipping"}
            </span>
            <span className="text-[10px] tracking-widest text-on-surface-variant">
              {totals.shipping ?? "Calculated at checkout"}
            </span>
          </div>

          <div className="flex justify-between pt-3 border-t border-outline-variant/20">
            <span className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface">
              Total
            </span>
            <span className="text-xs tracking-widest font-medium text-on-surface">
              {totals.total ?? ""}
            </span>
          </div>
        </div>
      )}

      <div className="pt-6">
        <button
          onClick={handleCheckout}
          disabled={checkingOut}
          className="w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {checkingOut ? "Redirecting..." : "Proceed to Checkout"}
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
    // Expand to show size selector, pre-select first option for each
    const defaults: Record<string, string> = {};
    for (const opt of product.productOptions) {
      const c = opt.choices[0];
      if (c) {
        defaults[opt.name] = c.description || c.value;
      }
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

      const hasOptions = product.hasRealVariants && Object.keys(opts).length > 0;

      const result = await wix.currentCart.addToCurrentCart({
        lineItems: [
          {
            catalogReference: {
              catalogItemId: product._id,
              appId: hasOptions ? WIX_STORES_V3_APP_ID : WIX_STORES_APP_ID,
              options: hasOptions
                ? {
                    options: opts,
                    variantId: "00000000-0000-0000-0000-000000000000",
                  }
                : undefined,
            },
            quantity: 1,
          },
        ],
      });

      // Verify the item was actually added (Wix may silently drop invalid items)
      const addedItem = result.cart?.lineItems?.some(
        (li: { catalogReference?: { catalogItemId?: string } }) =>
          li.catalogReference?.catalogItemId === product._id
      );
      if (!addedItem) {
        throw new Error("Item was not added. Please check size/variant selection.");
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
      console.error("Failed to add to bag:", error);
      setAddingId(null);
      alert("Failed to add to bag. Please try again.");
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
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="64px"
                  className="object-cover"
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
            {isExpanded && (
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
                            const isSelected =
                              selectedOptions[option.name] === (choice.description || choice.value);
                            return (
                              <button
                                key={choice.value}
                                onClick={() =>
                                  setSelectedOptions((prev) => ({
                                    ...prev,
                                    [option.name]: choice.description || choice.value,
                                  }))
                                }
                                className={`w-8 h-8 transition-colors ${
                                  isSelected
                                    ? "ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container-low"
                                    : "border border-outline-variant/20 hover:border-outline"
                                }`}
                                style={{ backgroundColor: choice.value }}
                                aria-label={choice.description || choice.value}
                              />
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
                          const isSelected =
                            selectedOptions[option.name] === (choice.description || choice.value);
                          return (
                            <button
                              key={choice.value}
                              onClick={() =>
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [option.name]: choice.description || choice.value,
                                }))
                              }
                              className={`h-10 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors border border-outline-variant/20 ${
                                isSelected
                                  ? "bg-on-surface text-on-primary"
                                  : "bg-transparent text-on-surface hover:bg-surface-container"
                              }`}
                            >
                              {choice.description || choice.value}
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
            )}
          </div>
        );
      })}
    </div>
  );
}
