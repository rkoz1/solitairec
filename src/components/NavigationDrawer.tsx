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

        {/* Divider before site pages */}
        <div className="pt-4 mb-2" />

        {/* Site pages */}
        <div className="border-b border-outline-variant/15">
          <Link
            href="/our-mission"
            onClick={close}
            className="block py-4 font-serif text-lg tracking-tight text-on-surface"
          >
            Our Mission
          </Link>
        </div>
        <div className="border-b border-outline-variant/15">
          <Link
            href="/loyalty"
            onClick={close}
            className="block py-4 font-serif text-lg tracking-tight text-on-surface"
          >
            Rewards
          </Link>
        </div>
        <div className="border-b border-outline-variant/15">
          <Link
            href="/account"
            onClick={close}
            className="block py-4 font-serif text-lg tracking-tight text-on-surface"
          >
            Account
          </Link>
        </div>

        {/* Social */}
        <div className="pt-8 pb-4">
          <a
            href="https://www.instagram.com/solitairec"
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="inline-block text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="Instagram"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          </a>
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
