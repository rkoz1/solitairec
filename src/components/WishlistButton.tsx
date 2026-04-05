"use client";

import { useEffect, useState, useCallback } from "react";
import { isInWishlist, toggleWishlist } from "@/lib/wishlist";
import { trackAnalytics } from "@/lib/analytics";
import { showToast } from "@/lib/toast";

interface WishlistButtonProps {
  productId: string;
}

export default function WishlistButton({ productId }: WishlistButtonProps) {
  const [inWishlist, setInWishlist] = useState(false);

  const sync = useCallback(() => {
    setInWishlist(isInWishlist(productId));
  }, [productId]);

  useEffect(() => {
    sync();
    window.addEventListener("wishlist-updated", sync);
    return () => window.removeEventListener("wishlist-updated", sync);
  }, [sync]);

  function handleToggle() {
    const nowIn = toggleWishlist(productId);
    setInWishlist(nowIn);
    trackAnalytics(nowIn ? "wishlist_add" : "wishlist_remove", {
      product_id: productId,
      source: "product_page",
    });
    if (nowIn) {
      showToast("Saved — find your favourites in Bag", "success");
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center justify-center gap-2 w-full py-3 transition-colors ${
        inWishlist
          ? "text-secondary"
          : "text-on-surface-variant hover:text-secondary"
      }`}
    >
      <span
        className="material-symbols-outlined text-[20px]"
        style={inWishlist ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        favorite
      </span>
      <span className="text-[10px] tracking-[0.2em] uppercase font-medium">
        {inWishlist ? "In Your Wishlist" : "Add to Wishlist"}
      </span>
    </button>
  );
}
