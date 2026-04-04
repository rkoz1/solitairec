"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { fetchNavCategories } from "@/app/collections/actions";
import { displayName } from "@/lib/collections";
import type { NavCategory } from "@/lib/collections";
import { trackAnalytics } from "@/lib/analytics";

export default function DesktopNav() {
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchNavCategories().then(setCategories);
  }, []);

  function handleEnter(slug: string) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHoveredSlug(slug);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setHoveredSlug(null), 150);
  }

  return (
    <div className="hidden lg:flex items-center gap-6">
      {categories.map((cat) => {
        const hasChildren = cat.children && cat.children.length > 0;
        const isOpen = hoveredSlug === cat.slug;

        return (
          <div
            key={cat.slug}
            className="relative"
            onMouseEnter={() => handleEnter(cat.slug)}
            onMouseLeave={handleLeave}
          >
            <Link
              href={`/collections/${cat.slug}`}
              onClick={() => trackAnalytics("nav_category_click", { category: displayName(cat.name), source: "desktop" })}
              className="text-[11px] tracking-[0.15em] uppercase font-medium text-on-surface hover:text-secondary transition-colors py-4 block"
            >
              {displayName(cat.name)}
            </Link>

            {hasChildren && isOpen && (
              <div className="absolute top-full left-0 bg-white shadow-sm py-3 min-w-[180px] z-50">
                <Link
                  href={`/collections/${cat.slug}`}
                  className="block px-5 py-2 text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface hover:text-secondary transition-colors"
                >
                  All {displayName(cat.name)}
                </Link>
                {cat.children!.map((child) => (
                  <Link
                    key={child.slug}
                    href={`/collections/${child.slug}`}
                    className="block px-5 py-2 text-[11px] tracking-[0.12em] uppercase text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    {displayName(child.name)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
