"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CartBadge from "./CartBadge";

export default function BottomNav() {
  const pathname = usePathname();

  const isShop = pathname === "/" || pathname.startsWith("/collections") || pathname.startsWith("/products");
  const isBag = pathname === "/cart" || pathname === "/checkout";
  const isAccount = pathname.startsWith("/account");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-surface-container-high/40 lg:hidden">
      <div className="flex items-center justify-around h-16">
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 transition-colors ${isShop ? "text-secondary" : "text-on-surface"}`}
        >
          <span className="material-symbols-outlined text-[22px]">
            storefront
          </span>
          <span className="text-[10px] tracking-[0.15em] uppercase font-medium">
            Shop
          </span>
        </Link>
        <CartBadge label="Bag" active={isBag} />
        <Link
          href="/account"
          className={`flex flex-col items-center gap-0.5 transition-colors ${isAccount ? "text-secondary" : "text-on-surface"}`}
        >
          <span className="material-symbols-outlined text-[22px]">
            person
          </span>
          <span className="text-[10px] tracking-[0.15em] uppercase font-medium">
            Account
          </span>
        </Link>
      </div>
    </nav>
  );
}
