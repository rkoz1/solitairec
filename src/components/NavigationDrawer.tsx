"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { fetchNavCategories } from "@/app/collections/actions";
import type { NavCategory } from "@/lib/collections";

export default function NavigationDrawer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && categories.length === 0) {
      fetchNavCategories().then(setCategories);
    }
  }, [open, categories.length]);

  function close() {
    setOpen(false);
    setExpandedSlug(null);
  }

  function toggleExpand(slug: string) {
    setExpandedSlug((prev) => (prev === slug ? null : slug));
  }

  const overlay = open ? (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* Top bar */}
      <div className="relative flex items-center justify-between px-5 h-14">
        <button
          type="button"
          aria-label="Close menu"
          className="flex items-center justify-center w-10 h-10"
          onClick={close}
        >
          <span className="material-symbols-outlined text-on-surface">
            close
          </span>
        </button>

        <span className="absolute left-1/2 -translate-x-1/2 font-serif font-bold text-lg tracking-[0.3em] text-on-surface">
          SOLITAIREC
        </span>

        <div className="w-10 h-10" />
      </div>

      {/* Category list */}
      <nav className="flex-1 overflow-y-auto px-8 pt-6 pb-24">
        {categories.map((cat) => {
          const hasChildren = cat.children && cat.children.length > 0;
          const isExpanded = expandedSlug === cat.slug;

          return (
            <div key={cat.slug} className="border-b border-outline-variant/15">
              <div className="flex items-center justify-between">
                <Link
                  href={`/collections/${cat.slug}`}
                  onClick={close}
                  className="flex-1 py-4 font-serif text-lg tracking-tight text-on-surface"
                >
                  {cat.name}
                </Link>
                {hasChildren && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(cat.slug)}
                    className="flex items-center justify-center w-10 h-10"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    <span
                      className="material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-300"
                      style={{ transform: isExpanded ? "rotate(180deg)" : undefined }}
                    >
                      expand_more
                    </span>
                  </button>
                )}
              </div>

              {hasChildren && isExpanded && (
                <div className="pb-3 pl-4">
                  <Link
                    href={`/collections/${cat.slug}`}
                    onClick={close}
                    className="block py-2 text-sm tracking-wide text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    All {cat.name}
                  </Link>
                  {cat.children!.map((child) => (
                    <Link
                      key={child.slug}
                      href={`/collections/${child.slug}`}
                      onClick={close}
                      className="block py-2 text-sm tracking-wide text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Account link */}
        <div className="border-b border-outline-variant/15">
          <Link
            href="/account"
            onClick={close}
            className="block py-4 font-serif text-lg tracking-tight text-on-surface"
          >
            Account
          </Link>
        </div>
      </nav>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        className="flex items-center justify-center w-10 h-10"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined text-on-surface">menu</span>
      </button>

      {mounted && overlay && createPortal(overlay, document.body)}
    </>
  );
}
