"use client";

import { useState } from "react";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import { showToast } from "@/lib/toast";

// Catalog V1 (products without variants)
const WIX_STORES_APP_ID = "1380b703-ce81-ff05-f115-39571d94dfcd";
// Catalog V3 (products with variant options like size/color)
const WIX_STORES_V3_APP_ID = "215238eb-22a5-4c36-9e7b-e7c08025e04e";

interface AddToCartButtonProps {
  productId: string;
  productName?: string;
  selectedOptions?: Record<string, string>;
}

export default function AddToCartButton({
  productId,
  productName,
  selectedOptions,
}: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAddToCart() {
    setLoading(true);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      const hasOptions =
        selectedOptions && Object.keys(selectedOptions).length > 0;

      const result = await wix.currentCart.addToCurrentCart({
        lineItems: [
          {
            catalogReference: {
              catalogItemId: productId,
              appId: hasOptions ? WIX_STORES_V3_APP_ID : WIX_STORES_APP_ID,
              options: hasOptions
                ? {
                    options: selectedOptions,
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
          li.catalogReference?.catalogItemId === productId
      );
      if (!addedItem) {
        throw new Error("Item was not added to cart. Please check size/variant selection.");
      }

      window.dispatchEvent(new Event("cart-updated"));

      // Fly-to-cart animation
      const btn = document.querySelector('[data-add-to-cart]');
      const rect = btn?.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent("cart-item-added", {
        detail: {
          imageUrl: "",
          sourceX: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
          sourceY: rect ? rect.top : window.innerHeight / 2,
          productName: productName ?? "",
        },
      }));

      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      showToast("This item couldn't be added. Please check your selection.", "error");
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
