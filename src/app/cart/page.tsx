"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import type { cart } from "@wix/ecom";

type Cart = cart.Cart;
type LineItem = cart.LineItem;

export default function CartPage() {
  const [cartData, setCartData] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCart() {
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);
      const current = await wix.currentCart.getCurrentCart();
      setCartData(current);
    } catch (error) {
      console.error("Failed to load cart:", error);
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(lineItemId: string) {
    try {
      const wix = getBrowserWixClient();
      await wix.currentCart.removeLineItemsFromCurrentCart([lineItemId]);
      window.dispatchEvent(new Event("cart-updated"));
      await loadCart();
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  }

  async function handleCheckout() {
    try {
      const wix = getBrowserWixClient();
      const result =
        await wix.currentCart.createCheckoutFromCurrentCart({
          channelType: "WEB",
        });
      const checkoutId = result.checkoutId;
      if (!checkoutId) throw new Error("No checkout ID returned");
      const urlResult = await wix.checkout.getCheckoutUrl(checkoutId);
      if (!urlResult.checkoutUrl) throw new Error("No checkout URL returned");
      window.dispatchEvent(new Event("cart-updated"));
      window.location.href = urlResult.checkoutUrl;
    } catch (error) {
      console.error("Failed to create checkout:", error);
      alert("Failed to proceed to checkout. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="px-6 pt-12">
        <p className="text-on-surface-variant text-sm">Loading cart...</p>
      </div>
    );
  }

  const items: LineItem[] = cartData?.lineItems ?? [];

  return (
    <div className="px-6 pt-12">
      <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
        Your Bag
      </h1>
      <div className="mt-3 w-12 h-[2px] bg-secondary" />

      {items.length === 0 ? (
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
      ) : (
        <div className="mt-10 space-y-0">
          {items.map((item) => (
            <div
              key={item._id}
              className="flex items-center justify-between bg-surface-container-low px-5 py-5 mb-2"
            >
              <div className="flex-1">
                <h3 className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
                  {item.productName?.original ?? "Product"}
                </h3>
                <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
                  Qty: {item.quantity}
                </p>
                <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
                  {item.price?.formattedAmount ?? ""}
                </p>
              </div>
              <button
                onClick={() => removeItem(item._id ?? "")}
                className="ml-4 text-[10px] tracking-[0.15em] uppercase text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Remove
              </button>
            </div>
          ))}

          <div className="pt-10">
            <button
              onClick={handleCheckout}
              className="w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98]"
            >
              Proceed to Checkout
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
      )}
    </div>
  );
}
