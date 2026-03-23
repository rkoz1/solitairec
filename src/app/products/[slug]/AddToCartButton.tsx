"use client";

import { useState } from "react";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";

const WIX_STORES_APP_ID = "1380b703-ce81-ff05-f115-39571d94dfcd";

interface AddToCartButtonProps {
  productId: string;
  selectedOptions?: Record<string, string>;
}

export default function AddToCartButton({
  productId,
  selectedOptions,
}: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAddToCart() {
    setLoading(true);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      await wix.currentCart.addToCurrentCart({
        lineItems: [
          {
            catalogReference: {
              catalogItemId: productId,
              appId: WIX_STORES_APP_ID,
              options:
                selectedOptions && Object.keys(selectedOptions).length > 0
                  ? { options: selectedOptions }
                  : undefined,
            },
            quantity: 1,
          },
        ],
      });

      window.dispatchEvent(new Event("cart-updated"));
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      alert("Failed to add to cart. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleAddToCart}
      disabled={loading}
      className="w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
    >
      {loading ? "Adding..." : added ? "Added to Bag!" : "Add to Bag"}
    </button>
  );
}
