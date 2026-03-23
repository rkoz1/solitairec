"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";

const TOKENS_KEY = "wix_tokens";

interface CartBadgeProps {
  className?: string;
  label?: string;
}

export default function CartBadge({ className, label }: CartBadgeProps) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    // Don't create a session just to check the cart — only fetch if tokens exist
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(TOKENS_KEY);
    if (!stored) return;

    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);
      const cart = await wix.currentCart.getCurrentCart();
      setCount(cart.lineItems?.length ?? 0);
    } catch {
      // cart may not exist yet — that's fine
    }
  }, []);

  useEffect(() => {
    fetchCount();

    const handler = () => fetchCount();
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, [fetchCount]);

  return (
    <Link
      href="/cart"
      className={`relative flex flex-col items-center gap-0.5 text-on-surface ${className ?? ""}`}
      aria-label="Shopping bag"
    >
      <span className="relative">
        <span className="material-symbols-outlined text-[22px]">
          shopping_bag
        </span>
        {count > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] flex items-center justify-center bg-secondary text-white text-[8px] font-bold px-0.5">
            {count}
          </span>
        )}
      </span>
      {label && (
        <span className="text-[10px] tracking-[0.15em] uppercase font-medium">
          {label}
        </span>
      )}
    </Link>
  );
}
