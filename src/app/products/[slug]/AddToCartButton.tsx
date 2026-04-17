"use client";

import { useState } from "react";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import { showToast } from "@/lib/toast";
import { addItemToCart } from "@/lib/cart";
import { trackMetaEvent } from "@/lib/meta-track";
import { trackAnalytics } from "@/lib/analytics";
import { clarityEvent, clarityTag, clarityUpgrade } from "@/lib/clarity";

interface AddToCartButtonProps {
  productId: string;
  productName?: string;
  productPrice?: string;
  manageVariants: boolean;
  selectedOptions?: Record<string, string>;
  variantId?: string;
}

export default function AddToCartButton({
  productId,
  productName,
  productPrice,
  manageVariants,
  selectedOptions,
  variantId,
}: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAddToCart() {
    setLoading(true);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      const result = await addItemToCart(wix, {
        productId,
        productName,
        manageVariants,
        selectedOptions,
        variantId,
      });

      if (!result.success) {
        showToast(
          result.error ?? "This item couldn't be added to your bag.",
          "error"
        );
        return;
      }

      window.dispatchEvent(new Event("cart-updated"));

      trackMetaEvent("AddToCart", {
        content_ids: [productId],
        content_name: productName,
        content_type: "product",
        value: productPrice ? parseFloat(productPrice) : undefined,
        currency: "HKD",
      });
      trackAnalytics("add_to_cart", {
        product_name: productName ?? "",
        price: productPrice ? parseFloat(productPrice) : 0,
        currency: "HKD",
      });
      clarityEvent("add_to_cart");
      clarityTag("last_added_product", productName ?? "");
      clarityUpgrade("add_to_cart");

      // Fly-to-cart animation
      const btn = document.querySelector("[data-add-to-cart]");
      const rect = btn?.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent("cart-item-added", {
          detail: {
            imageUrl: "",
            sourceX: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
            sourceY: rect ? rect.top : window.innerHeight / 2,
            productName: productName ?? "",
          },
        })
      );

      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      const { log } = await import("@/lib/logger");
      log({
        level: "error",
        action: "add-to-cart-failed",
        details: { productId, productName },
        error,
      });
      showToast(
        "This item couldn't be added to your bag. It may be out of stock or unavailable in the selected option.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleAddToCart}
      disabled={loading}
      data-add-to-cart
      className="w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
    >
      {loading ? "Adding..." : added ? "Added to Bag!" : "Add to Bag"}
    </button>
  );
}
