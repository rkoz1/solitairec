"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getWishlistIds } from "@/lib/wishlist";

interface WishlistBadgeProps {
  className?: string;
}

export default function WishlistBadge({ className }: WishlistBadgeProps) {
  const [count, setCount] = useState(0);
  const [bouncing, setBouncing] = useState(false);

  const refresh = useCallback(() => {
    setCount(getWishlistIds().length);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("wishlist-updated", refresh);
    return () => window.removeEventListener("wishlist-updated", refresh);
  }, [refresh]);

  useEffect(() => {
    const handler = () => {
      setBouncing(true);
      setTimeout(() => setBouncing(false), 400);
    };
    window.addEventListener("wishlist-badge-bounce", handler);
    return () => window.removeEventListener("wishlist-badge-bounce", handler);
  }, []);

  return (
    <Link
      href="/cart?tab=wishlist"
      className={`relative flex items-center justify-center w-10 h-10 text-on-surface hover:text-secondary transition-colors ${className ?? ""}`}
      aria-label="Wishlist"
      title="Wishlist"
    >
      <span
        className={`material-symbols-outlined text-[22px] transition-transform ${bouncing ? "animate-[badgeBounce_400ms_ease-out]" : ""}`}
        style={count > 0 ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        favorite
      </span>
      {count > 0 && (
        <span className="absolute top-0.5 right-0 min-w-[16px] h-[16px] flex items-center justify-center bg-secondary text-white text-[8px] font-bold px-0.5">
          {count}
        </span>
      )}
    </Link>
  );
}
